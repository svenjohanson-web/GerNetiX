import Foundation
import Network
import Security
import Darwin

typealias JSONObject = [String: Any]

private let defaultOrigins = [
    "http://localhost:4300",
    "http://127.0.0.1:4300",
    "http://localhost:14300",
    "http://127.0.0.1:14300",
    "https://gernetix.com",
    "https://www.gernetix.com",
    "https://gernetix.de",
    "https://www.gernetix.de",
    "https://gernetix.nl",
    "https://www.gernetix.nl",
]

struct ServiceConfig {
    let host = "127.0.0.1"
    let port: UInt16
    let origins: Set<String>
    let maximumBodyBytes: Int
    let sessionLifetimeMilliseconds: Int64
    let pkcs12Path: String
    let pkcs12PasswordPath: String
    let espflashPath: String

    static func load() -> ServiceConfig {
        let environment = ProcessInfo.processInfo.environment
        let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
        let resources = executable.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Resources")
        let configuredOrigins = environment["GERNETIX_PLATFORM_ORIGINS"]?
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        return ServiceConfig(
            port: UInt16(environment["GERNETIX_SERIAL_SERVICE_PORT"] ?? "") ?? 43123,
            origins: Set(configuredOrigins?.isEmpty == false ? configuredOrigins! : defaultOrigins),
            maximumBodyBytes: positiveInteger(environment["GERNETIX_SERIAL_MAX_BODY_BYTES"], fallback: 64 * 1024 * 1024),
            sessionLifetimeMilliseconds: Int64(positiveInteger(environment["GERNETIX_SERIAL_SESSION_TTL_MS"], fallback: 15 * 60 * 1000)),
            pkcs12Path: environment["GERNETIX_SERIAL_TLS_PKCS12"] ?? "",
            pkcs12PasswordPath: environment["GERNETIX_SERIAL_TLS_PKCS12_PASSWORD_FILE"] ?? "",
            espflashPath: environment["GERNETIX_ESPFLASH_PATH"] ?? resources.appendingPathComponent("espflash").path
        )
    }
}

struct HTTPRequest {
    let method: String
    let path: String
    let headers: [String: String]
    let body: Data
}

struct HTTPResponse {
    let status: Int
    let headers: [String: String]
    let body: Data
}

final class SessionStore {
    private struct Session {
        let origin: String
        let expiresAt: Int64
    }

    private let lock = NSLock()
    private var sessions: [String: Session] = [:]
    private let lifetime: Int64

    init(lifetime: Int64) {
        self.lifetime = lifetime
    }

    func issue(origin: String) throws -> JSONObject {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw ServiceError("session_generation_failed", "Die lokale Sitzung konnte nicht erzeugt werden.")
        }
        let token = Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let expiresAt = nowMilliseconds() + lifetime
        lock.withLock { sessions[token] = Session(origin: origin, expiresAt: expiresAt) }
        return ["token": token, "expiresAt": expiresAt]
    }

    func authorize(token: String, origin: String) -> Bool {
        lock.withLock {
            guard let session = sessions[token],
                  session.origin == origin,
                  session.expiresAt > nowMilliseconds() else {
                sessions.removeValue(forKey: token)
                return false
            }
            return true
        }
    }
}

final class FlashJob {
    let id: String
    let createdAt: String
    var status = "queued"
    var logs: [String] = []
    var error = ""
    var chipName = ""
    var process: Process?

    init() {
        id = "flash_\(Int64(Date().timeIntervalSince1970 * 1000))_\(UUID().uuidString.prefix(8).lowercased())"
        createdAt = ISO8601DateFormatter().string(from: Date())
    }

    func publicValue() -> JSONObject {
        [
            "id": id,
            "status": status,
            "logs": Array(logs.suffix(100)),
            "error": error,
            "chipName": chipName,
            "createdAt": createdAt,
        ]
    }
}

final class SerialService {
    private let config: ServiceConfig
    private let sessions: SessionStore
    private let lock = NSLock()
    private var jobs: [String: FlashJob] = [:]

    init(config: ServiceConfig) {
        self.config = config
        sessions = SessionStore(lifetime: config.sessionLifetimeMilliseconds)
    }

    func handle(_ request: HTTPRequest) -> HTTPResponse {
        let origin = normalizedOrigin(request.headers["origin"] ?? "")
        let expectedHosts = ["\(config.host):\(config.port)", "localhost:\(config.port)"]
        guard !origin.isEmpty,
              config.origins.contains(origin),
              expectedHosts.contains(request.headers["host"] ?? "") else {
            return jsonResponse(403, ["error": "origin_not_allowed"])
        }
        let cors = corsHeaders(origin)
        if request.method == "OPTIONS" {
            return HTTPResponse(status: 204, headers: cors, body: Data())
        }

        do {
            if request.method == "GET" && request.path == "/v1/status" {
                return jsonResponse(200, [
                    "service": "gernetix-serial-service",
                    "version": "0.3.3",
                    "protocolVersion": 1,
                    "runtime": "native-swift",
                    "capabilities": ["ports", "probe", "flash", "serial_provisioning"],
                ], cors)
            }
            if request.method == "POST" && request.path == "/v1/sessions" {
                return jsonResponse(201, try sessions.issue(origin: origin), cors)
            }

            let token = request.headers["x-gernetix-serial-session"] ?? ""
            guard sessions.authorize(token: token, origin: origin) else {
                return jsonResponse(401, ["error": "serial_session_invalid"], cors)
            }

            if request.method == "GET" && request.path == "/v1/ports" {
                return jsonResponse(200, ["items": listSerialPorts()], cors)
            }
            if request.method == "POST" && request.path == "/v1/probe" {
                let body = try decodeObject(request.body)
                let port = try requiredPort(body["port"])
                return jsonResponse(200, try probe(port: port), cors)
            }
            if request.method == "POST" && request.path == "/v1/flash-jobs" {
                let body = try decodeObject(request.body)
                let port = try requiredPort(body["port"])
                let files = try flashFiles(body["files"])
                let job = createFlashJob(port: port, files: files)
                return jsonResponse(202, lock.withLock { job.publicValue() }, cors)
            }
            if let id = routeIdentifier(request.path, prefix: "/v1/flash-jobs/") {
                if request.method == "GET" {
                    guard let value = lock.withLock({ jobs[id]?.publicValue() }) else {
                        return jsonResponse(404, ["error": "flash_job_not_found"], cors)
                    }
                    return jsonResponse(200, value, cors)
                }
                if request.method == "DELETE" {
                    let cancelled = cancelJob(id)
                    return cancelled
                        ? HTTPResponse(status: 204, headers: cors, body: Data())
                        : jsonResponse(409, ["error": "flash_job_not_running"], cors)
                }
            }
            if request.method == "POST" && request.path == "/v1/serial/requests" {
                let body = try decodeObject(request.body)
                let port = try requiredPort(body["port"])
                guard var serialRequest = body["request"] as? JSONObject else {
                    throw ServiceError("invalid_serial_request", "Die serielle Anfrage fehlt.")
                }
                let requestID = (serialRequest["request_id"] as? String) ?? UUID().uuidString
                serialRequest["request_id"] = requestID
                serialRequest["type"] = "gernetix.serial_provisioning"
                let timeout = boundedTimeout(body["timeoutMs"], fallback: 15_000, maximum: 60_000)
                return jsonResponse(200, try serialJSONRequest(port: port, request: serialRequest, timeoutMilliseconds: timeout), cors)
            }
            if request.method == "POST" && request.path == "/v1/serial/wait-ready" {
                let body = try decodeObject(request.body)
                let port = try requiredPort(body["port"])
                let timeout = boundedTimeout(body["timeoutMs"], fallback: 30_000, maximum: 120_000)
                let line = try waitForSerialLine(
                    port: port,
                    patterns: ["publishStatus: Status: running", "Local USB WiFi provisioning is ready"],
                    timeoutMilliseconds: timeout
                )
                return jsonResponse(200, ["ready": true, "line": line], cors)
            }
            return jsonResponse(404, ["error": "not_found"], cors)
        } catch let error as ServiceError {
            return jsonResponse(error.status, ["error": error.code, "message": error.message], cors)
        } catch {
            return jsonResponse(500, ["error": "serial_service_error", "message": error.localizedDescription], cors)
        }
    }

    private func probe(port: String) throws -> JSONObject {
        try assertPortAvailable(port)
        let result = try runEspflash(command: "board-info", port: port)
        let output = stripANSI(result.output)
        let chip = firstMatch(output, patterns: [
            #"(?im)^\s*Chip type:\s*(ESP32[^\r\n]*)"#,
            #"(?im)^\s*Chip:\s*(ESP32[^\r\n]*)"#,
            #"\b(ESP32(?:-S3|-C6|-C3|-S2|-C2|-H2|-P4)?)\b"#,
        ]) ?? "Espressif"
        let flashSize = firstMatch(output, patterns: [#"(?im)^\s*Flash size:\s*([^\r\n]+)"#]) ?? ""
        return [
            "detected": true,
            "chipName": chip,
            "hardwareProfileId": hardwareProfile(chip),
            "detail": [chip, flashSize.isEmpty ? nil : "\(flashSize) Flash"].compactMap { $0 }.joined(separator: " · "),
            "flashSize": flashSize,
        ]
    }

    private func createFlashJob(port: String, files: [FlashFile]) -> FlashJob {
        let job = FlashJob()
        lock.withLock { jobs[job.id] = job }
        DispatchQueue.global(qos: .userInitiated).async { [weak self, weak job] in
            guard let self, let job else { return }
            self.executeFlashJob(job, port: port, files: files)
        }
        return job
    }

    private func executeFlashJob(_ job: FlashJob, port: String, files: [FlashFile]) {
        lock.withLock { job.status = "running" }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("gernetix-\(job.id)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let merged = try mergeFlashFiles(files)
            let image = directory.appendingPathComponent("firmware.bin")
            try merged.data.write(to: image, options: .atomic)
            let result = try runEspflash(command: "write-bin", port: port, extraArguments: [
                "--baud", "460800",
                String(format: "0x%x", merged.address),
                image.path,
            ], job: job)
            let output = stripANSI(result.output)
            lock.withLock {
                appendJobLog(job, output)
                if job.status != "cancelled" {
                    job.status = "succeeded"
                    job.logs.append("Firmware wurde erfolgreich geschrieben.")
                }
            }
        } catch {
            lock.withLock {
                if job.status != "cancelled" {
                    job.status = "failed"
                    job.error = error.localizedDescription
                }
                job.process = nil
            }
        }
    }

    private func cancelJob(_ id: String) -> Bool {
        lock.withLock {
            guard let job = jobs[id], ["queued", "running"].contains(job.status) else { return false }
            job.status = "cancelled"
            job.process?.terminate()
            return true
        }
    }

    private func runEspflash(command: String, port: String, extraArguments: [String] = [], job: FlashJob? = nil) throws -> (output: String, status: Int32) {
        guard FileManager.default.isExecutableFile(atPath: config.espflashPath) else {
            throw ServiceError("espflash_unavailable", "Die native ESP-Flash-Komponente fehlt.")
        }
        var lastError: Error?
        for before in ["default-reset", "usb-reset"] {
            let process = Process()
            let pipe = Pipe()
            process.executableURL = URL(fileURLWithPath: config.espflashPath)
            process.arguments = [
                "--skip-update-check",
                command,
                "--port", port,
                "--non-interactive",
                "--before", before,
            ] + extraArguments
            process.standardOutput = pipe
            process.standardError = pipe
            lock.withLock { job?.process = process }
            do {
                try process.run()
                process.waitUntilExit()
                let output = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                lock.withLock { job?.process = nil }
                if process.terminationStatus == 0 {
                    return (output, process.terminationStatus)
                }
                lastError = ServiceError("espflash_failed", meaningfulEspflashError(output))
            } catch {
                lock.withLock { job?.process = nil }
                lastError = error
            }
            if lock.withLock({ job?.status == "cancelled" }) {
                throw ServiceError("flash_cancelled", "Der Flash-Vorgang wurde abgebrochen.")
            }
        }
        throw lastError ?? ServiceError("espflash_failed", "Das Board konnte nicht angesprochen werden.")
    }
}

struct FlashFile {
    let address: Int
    let data: Data
}

final class HTTPServer {
    private let config: ServiceConfig
    private let service: SerialService
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.gernetix.serial-service.listener")

    init(config: ServiceConfig, service: SerialService) {
        self.config = config
        self.service = service
    }

    func start() throws {
        let parameters: NWParameters
        if !config.pkcs12Path.isEmpty {
            parameters = NWParameters(tls: try tlsOptions(config), tcp: NWProtocolTCP.Options())
        } else {
            parameters = .tcp
        }
        parameters.requiredLocalEndpoint = .hostPort(host: NWEndpoint.Host(config.host), port: NWEndpoint.Port(rawValue: config.port)!)
        let listener = try NWListener(using: parameters)
        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                fputs("[gernetix-serial-service] bereit auf \(self.config.host):\(self.config.port)\n", stderr)
            case .failed(let error):
                fputs("[gernetix-serial-service] Listener-Fehler: \(error)\n", stderr)
                exit(1)
            default:
                break
            }
        }
        self.listener = listener
        listener.start(queue: queue)
    }

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        receive(connection, buffer: Data())
    }

    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, complete, error in
            guard let self else { return }
            var next = buffer
            if let data { next.append(data) }
            if next.count > self.config.maximumBodyBytes + 64 * 1024 {
                self.send(connection, jsonResponse(413, ["error": "body_too_large"]))
                return
            }
            if let request = try? parseHTTPRequest(next, maximumBodyBytes: self.config.maximumBodyBytes) {
                DispatchQueue.global(qos: .userInitiated).async {
                    self.send(connection, self.service.handle(request))
                }
                return
            }
            if complete || error != nil {
                self.send(connection, jsonResponse(400, ["error": "invalid_http_request"]))
                return
            }
            self.receive(connection, buffer: next)
        }
    }

    private func send(_ connection: NWConnection, _ response: HTTPResponse) {
        var headers = response.headers
        headers["Content-Length"] = String(response.body.count)
        headers["Connection"] = "close"
        let head = "HTTP/1.1 \(response.status) \(statusText(response.status))\r\n"
            + headers.map { "\($0.key): \($0.value)\r\n" }.joined()
            + "\r\n"
        var data = Data(head.utf8)
        data.append(response.body)
        connection.send(content: data, completion: .contentProcessed { _ in connection.cancel() })
    }
}

struct ServiceError: LocalizedError {
    let code: String
    let message: String
    let status: Int

    init(_ code: String, _ message: String, status: Int = 400) {
        self.code = code
        self.message = message
        self.status = status
    }

    var errorDescription: String? { message }
}

func listSerialPorts() -> [JSONObject] {
    let directory = "/dev"
    let names = (try? FileManager.default.contentsOfDirectory(atPath: directory)) ?? []
    return preferredSerialPortPaths(names).map { path in
        return [
            "path": path,
            "manufacturer": "",
            "serialNumber": "",
            "vendorId": "",
            "productId": "",
            "label": path,
        ]
    }.sorted { ($0["path"] as? String ?? "") < ($1["path"] as? String ?? "") }
}

func preferredSerialPortPaths(_ names: [String]) -> [String] {
    var selectedByDevice: [String: String] = [:]
    for name in names {
        let path = "/dev/\(name)"
        guard validSerialPort(path), let separator = name.firstIndex(of: ".") else { continue }
        let deviceKey = String(name[name.index(after: separator)...]).lowercased()
        let current = selectedByDevice[deviceKey] ?? ""
        if current.isEmpty || name.lowercased().hasPrefix("cu.") {
            selectedByDevice[deviceKey] = path
        }
    }
    return selectedByDevice.values.sorted()
}

func validSerialPort(_ value: String) -> Bool {
    value.range(
        of: #"^/dev/(cu|tty)\.(usbmodem|usbserial|SLAB_USBtoUART|wchusbserial|usb-serial)[A-Za-z0-9._-]*$"#,
        options: [.regularExpression, .caseInsensitive]
    ) != nil
}

func assertPortAvailable(_ path: String) throws {
    guard validSerialPort(path), FileManager.default.fileExists(atPath: path) else {
        throw ServiceError("serial_port_not_available", "Der serielle Port ist nicht verfügbar.", status: 409)
    }
}

func openSerialPort(_ path: String) throws -> Int32 {
    try assertPortAvailable(path)
    let descriptor = Darwin.open(path, O_RDWR | O_NOCTTY | O_NONBLOCK)
    guard descriptor >= 0 else {
        throw ServiceError("serial_port_open_failed", "Der serielle Port konnte nicht geöffnet werden.", status: 409)
    }
    _ = fcntl(descriptor, F_SETFL, 0)
    var options = termios()
    guard tcgetattr(descriptor, &options) == 0 else {
        Darwin.close(descriptor)
        throw ServiceError("serial_port_configuration_failed", "Der serielle Port konnte nicht konfiguriert werden.")
    }
    cfmakeraw(&options)
    _ = cfsetspeed(&options, speed_t(B115200))
    options.c_cflag |= tcflag_t(CLOCAL | CREAD)
    options.c_cflag &= ~tcflag_t(CRTSCTS)
    guard tcsetattr(descriptor, TCSANOW, &options) == 0 else {
        Darwin.close(descriptor)
        throw ServiceError("serial_port_configuration_failed", "Der serielle Port konnte nicht konfiguriert werden.")
    }
    tcflush(descriptor, TCIOFLUSH)
    return descriptor
}

func serialJSONRequest(port: String, request: JSONObject, timeoutMilliseconds: Int) throws -> JSONObject {
    let descriptor = try openSerialPort(port)
    defer { Darwin.close(descriptor) }
    let data = try JSONSerialization.data(withJSONObject: request)
    try writeAll(descriptor, data + Data([0x0A]))
    let requestID = request["request_id"] as? String ?? ""
    let deadline = nowMilliseconds() + Int64(timeoutMilliseconds)
    var pending = Data()
    while nowMilliseconds() < deadline {
        if let line = try readLine(descriptor, pending: &pending, deadline: deadline),
           let value = try? JSONSerialization.jsonObject(with: line) as? JSONObject,
           value["type"] as? String == "gernetix.serial_provisioning",
           value["request_id"] as? String == requestID {
            if value["event"] as? String == "error" {
                throw ServiceError("serial_request_rejected", "Das Board hat die Anfrage abgelehnt.")
            }
            return value
        }
    }
    throw ServiceError("serial_request_timeout", "Das Board hat nicht rechtzeitig geantwortet.", status: 504)
}

func waitForSerialLine(port: String, patterns: [String], timeoutMilliseconds: Int) throws -> String {
    let descriptor = try openSerialPort(port)
    defer { Darwin.close(descriptor) }
    let deadline = nowMilliseconds() + Int64(timeoutMilliseconds)
    var pending = Data()
    while nowMilliseconds() < deadline {
        if let data = try readLine(descriptor, pending: &pending, deadline: deadline),
           let line = String(data: data, encoding: .utf8),
           patterns.contains(where: { line.contains($0) }) {
            return line
        }
    }
    throw ServiceError("serial_ready_timeout", "Das Board wurde nicht rechtzeitig als gestartet erkannt.", status: 504)
}

func readLine(_ descriptor: Int32, pending: inout Data, deadline: Int64) throws -> Data? {
    while nowMilliseconds() < deadline {
        if let newline = pending.firstIndex(of: 0x0A) {
            let line = pending.prefix(upTo: newline)
            pending.removeSubrange(...newline)
            return Data(line)
        }
        var pollDescriptor = pollfd(fd: descriptor, events: Int16(POLLIN), revents: 0)
        let remaining = Int32(max(1, min(250, deadline - nowMilliseconds())))
        let result = poll(&pollDescriptor, 1, remaining)
        if result < 0 {
            throw ServiceError("serial_read_failed", "Der serielle Port konnte nicht gelesen werden.")
        }
        if result == 0 { continue }
        var bytes = [UInt8](repeating: 0, count: 4096)
        let count = Darwin.read(descriptor, &bytes, bytes.count)
        if count > 0 {
            pending.append(bytes, count: count)
        }
    }
    return nil
}

func writeAll(_ descriptor: Int32, _ data: Data) throws {
    var offset = 0
    try data.withUnsafeBytes { raw in
        guard let base = raw.baseAddress else { return }
        while offset < data.count {
            let written = Darwin.write(descriptor, base.advanced(by: offset), data.count - offset)
            if written <= 0 {
                throw ServiceError("serial_write_failed", "Die serielle Anfrage konnte nicht geschrieben werden.")
            }
            offset += written
        }
    }
    tcdrain(descriptor)
}

func flashFiles(_ value: Any?) throws -> [FlashFile] {
    guard let rawFiles = value as? [JSONObject], (1...8).contains(rawFiles.count) else {
        throw ServiceError("invalid_flash_request", "Der Flash-Auftrag enthält keine gültigen Dateien.")
    }
    var total = 0
    return try rawFiles.map { file in
        let address = try flashAddress(file["address"])
        guard let encoded = file["dataBase64"] as? String,
              let data = Data(base64Encoded: encoded),
              !data.isEmpty else {
            throw ServiceError("invalid_flash_request", "Mindestens eine Firmwaredatei fehlt.")
        }
        total += data.count
        guard total <= 64 * 1024 * 1024 else {
            throw ServiceError("invalid_flash_request", "Der Flash-Auftrag ist zu groß.")
        }
        return FlashFile(address: address, data: data)
    }
}

func mergeFlashFiles(_ files: [FlashFile]) throws -> (address: Int, data: Data) {
    guard let minimum = files.map(\.address).min(),
          let maximum = files.map({ $0.address + $0.data.count }).max(),
          maximum > minimum,
          maximum - minimum <= 64 * 1024 * 1024 else {
        throw ServiceError("invalid_flash_request", "Der Flash-Adressbereich ist ungültig oder zu groß.")
    }
    var merged = Data(repeating: 0xFF, count: maximum - minimum)
    for file in files {
        let range = (file.address - minimum)..<(file.address - minimum + file.data.count)
        merged.replaceSubrange(range, with: file.data)
    }
    return (minimum, merged)
}

func flashAddress(_ value: Any?) throws -> Int {
    let address: Int?
    if let number = value as? NSNumber {
        address = number.intValue
    } else if let string = value as? String, string.lowercased().hasPrefix("0x") {
        address = Int(string.dropFirst(2), radix: 16)
    } else if let string = value as? String {
        address = Int(string)
    } else {
        address = nil
    }
    guard let address, address >= 0, address <= 0x10000000 else {
        throw ServiceError("invalid_flash_request", "Ungültige Flash-Adresse.")
    }
    return address
}

func decodeObject(_ data: Data) throws -> JSONObject {
    guard !data.isEmpty else { return [:] }
    guard let object = try JSONSerialization.jsonObject(with: data) as? JSONObject else {
        throw ServiceError("invalid_json", "Die Anfrage enthält kein gültiges JSON.")
    }
    return object
}

func requiredPort(_ value: Any?) throws -> String {
    guard let port = value as? String, validSerialPort(port) else {
        throw ServiceError("serial_port_not_available", "Der serielle Port ist nicht verfügbar.", status: 409)
    }
    try assertPortAvailable(port)
    return port
}

func parseHTTPRequest(_ data: Data, maximumBodyBytes: Int) throws -> HTTPRequest? {
    let separator = Data("\r\n\r\n".utf8)
    guard let headerRange = data.range(of: separator) else { return nil }
    guard let head = String(data: data[..<headerRange.lowerBound], encoding: .utf8) else {
        throw ServiceError("invalid_http_request", "Ungültige HTTP-Anfrage.")
    }
    let lines = head.components(separatedBy: "\r\n")
    guard let first = lines.first else { throw ServiceError("invalid_http_request", "Ungültige HTTP-Anfrage.") }
    let requestLine = first.split(separator: " ")
    guard requestLine.count == 3 else { throw ServiceError("invalid_http_request", "Ungültige HTTP-Anfrage.") }
    var headers: [String: String] = [:]
    for line in lines.dropFirst() {
        guard let colon = line.firstIndex(of: ":") else { continue }
        headers[String(line[..<colon]).lowercased()] = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
    }
    let contentLength = Int(headers["content-length"] ?? "0") ?? 0
    guard contentLength >= 0, contentLength <= maximumBodyBytes else {
        throw ServiceError("body_too_large", "Die Anfrage überschreitet die erlaubte Größe.", status: 413)
    }
    let bodyStart = headerRange.upperBound
    guard data.count >= bodyStart + contentLength else { return nil }
    let rawPath = String(requestLine[1])
    let path = rawPath.split(separator: "?", maxSplits: 1).first.map(String.init) ?? rawPath
    return HTTPRequest(
        method: String(requestLine[0]),
        path: path,
        headers: headers,
        body: data.subdata(in: bodyStart..<(bodyStart + contentLength))
    )
}

func tlsOptions(_ config: ServiceConfig) throws -> NWProtocolTLS.Options {
    let data = try Data(contentsOf: URL(fileURLWithPath: config.pkcs12Path))
    let password = try String(contentsOfFile: config.pkcs12PasswordPath, encoding: .utf8)
        .trimmingCharacters(in: .whitespacesAndNewlines)
    var imported: CFArray?
    let result = SecPKCS12Import(data as CFData, [kSecImportExportPassphrase as String: password] as CFDictionary, &imported)
    guard result == errSecSuccess,
          let item = (imported as? [[String: Any]])?.first,
          let identity = item[kSecImportItemIdentity as String] as! SecIdentity?,
          let protocolIdentity = sec_identity_create(identity) else {
        throw ServiceError("tls_identity_invalid", "Die lokale TLS-Identität konnte nicht geladen werden.")
    }
    let options = NWProtocolTLS.Options()
    sec_protocol_options_set_local_identity(options.securityProtocolOptions, protocolIdentity)
    sec_protocol_options_set_min_tls_protocol_version(options.securityProtocolOptions, .TLSv12)
    return options
}

func corsHeaders(_ origin: String) -> [String: String] {
    [
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-GerNetiX-Serial-Session",
        "Access-Control-Allow-Private-Network": "true",
        "Access-Control-Max-Age": "600",
        "Cache-Control": "no-store",
        "Vary": "Origin",
    ]
}

func jsonResponse(_ status: Int, _ object: Any, _ extraHeaders: [String: String] = [:]) -> HTTPResponse {
    let body = (try? JSONSerialization.data(withJSONObject: object)) ?? Data(#"{"error":"serialization_failed"}"#.utf8)
    var headers = extraHeaders
    headers["Content-Type"] = "application/json; charset=utf-8"
    return HTTPResponse(status: status, headers: headers, body: body)
}

func normalizedOrigin(_ value: String) -> String {
    guard let url = URL(string: value), let scheme = url.scheme, let host = url.host else { return "" }
    var result = "\(scheme)://\(host)"
    if let port = url.port { result += ":\(port)" }
    return result
}

func routeIdentifier(_ path: String, prefix: String) -> String? {
    guard path.hasPrefix(prefix) else { return nil }
    let value = String(path.dropFirst(prefix.count))
    guard value.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil else { return nil }
    return value
}

func hardwareProfile(_ chip: String) -> String {
    let lower = chip.lowercased()
    if lower.contains("esp32-s3") { return "hardware.processor_board.generic_esp32_s3_wroom1" }
    if lower.contains("esp32-c6") { return "hardware.processor_board.generic_esp32_c6_wroom1" }
    return "hardware.processor_board.generic_esp_wroom32"
}

func firstMatch(_ value: String, patterns: [String]) -> String? {
    for pattern in patterns {
        guard let expression = try? NSRegularExpression(pattern: pattern),
              let match = expression.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: value) else { continue }
        return String(value[range]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return nil
}

func stripANSI(_ value: String) -> String {
    value.replacingOccurrences(of: #"\u{001B}\[[0-9;]*[A-Za-z]"#, with: "", options: .regularExpression)
}

func meaningfulEspflashError(_ output: String) -> String {
    let cleaned = stripANSI(output)
    let lines = cleaned.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    return lines.suffix(4).joined(separator: " ").prefix(800).description
}

func appendJobLog(_ job: FlashJob, _ value: String) {
    let lines = value.components(separatedBy: .newlines).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    job.logs.append(contentsOf: lines)
    if job.logs.count > 400 { job.logs.removeFirst(job.logs.count - 400) }
}

func boundedTimeout(_ value: Any?, fallback: Int, maximum: Int) -> Int {
    let number = (value as? NSNumber)?.intValue ?? Int(value as? String ?? "") ?? fallback
    return max(1, min(number, maximum))
}

func positiveInteger(_ value: String?, fallback: Int) -> Int {
    guard let value, let number = Int(value), number > 0 else { return fallback }
    return number
}

func nowMilliseconds() -> Int64 {
    Int64(Date().timeIntervalSince1970 * 1000)
}

func statusText(_ status: Int) -> String {
    [
        200: "OK",
        201: "Created",
        202: "Accepted",
        204: "No Content",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
        413: "Payload Too Large",
        500: "Internal Server Error",
        504: "Gateway Timeout",
    ][status] ?? "Response"
}

extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T {
        lock()
        defer { unlock() }
        return try body()
    }
}

func runSelfTests() throws {
    guard validSerialPort("/dev/cu.usbmodem101"),
          validSerialPort("/dev/cu.wchusbserial1410"),
          !validSerialPort("/tmp/fake-device") else {
        throw ServiceError("self_test_failed", "Die Prüfung der seriellen Gerätepfade ist fehlgeschlagen.")
    }
    guard preferredSerialPortPaths([
        "tty.usbmodem101",
        "cu.usbmodem101",
        "tty.usbserial-210",
    ]) == ["/dev/cu.usbmodem101", "/dev/tty.usbserial-210"] else {
        throw ServiceError("self_test_failed", "Die Zusammenführung doppelter macOS-Gerätepfade ist fehlgeschlagen.")
    }
    guard try flashAddress("0x20000") == 0x20000 else {
        throw ServiceError("self_test_failed", "Die Prüfung der Flash-Adresse ist fehlgeschlagen.")
    }
    let merged = try mergeFlashFiles([
        FlashFile(address: 0, data: Data([1, 2])),
        FlashFile(address: 4, data: Data([3])),
    ])
    guard merged.address == 0, merged.data == Data([1, 2, 0xFF, 0xFF, 3]) else {
        throw ServiceError("self_test_failed", "Die Prüfung des zusammengeführten Flash-Abbilds ist fehlgeschlagen.")
    }
    let raw = Data("POST /v1/sessions HTTP/1.1\r\nHost: localhost:43123\r\nOrigin: https://gernetix.com\r\nContent-Length: 2\r\n\r\n{}".utf8)
    guard let request = try parseHTTPRequest(raw, maximumBodyBytes: 1024),
          request.method == "POST",
          request.path == "/v1/sessions",
          request.body == Data("{}".utf8) else {
        throw ServiceError("self_test_failed", "Die Prüfung des lokalen HTTP-Vertrags ist fehlgeschlagen.")
    }
    print("GerNetiX Serial Service native self-test: ok")
}

signal(SIGPIPE, SIG_IGN)
if CommandLine.arguments.contains("--self-test") {
    do {
        try runSelfTests()
        exit(0)
    } catch {
        fputs("[gernetix-serial-service] Selbsttest fehlgeschlagen: \(error.localizedDescription)\n", stderr)
        exit(1)
    }
}
let config = ServiceConfig.load()
let service = SerialService(config: config)
let server = HTTPServer(config: config, service: service)
do {
    try server.start()
    dispatchMain()
} catch {
    fputs("[gernetix-serial-service] Start fehlgeschlagen: \(error.localizedDescription)\n", stderr)
    exit(1)
}
