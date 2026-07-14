const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

class OpenSslDeviceCertificateIssuer {
  constructor(options = {}) {
    this.caCertificatePath = options.caCertificatePath || "";
    this.caPrivateKeyPath = options.caPrivateKeyPath || "";
    this.opensslCommand = options.opensslCommand || "openssl";
    this.validityDays = Number(options.validityDays || 365);
  }

  isConfigured() {
    return Boolean(this.caCertificatePath && this.caPrivateKeyPath);
  }

  async issue({ deviceId, publicKeyPem }) {
    if (!this.isConfigured()) throw new Error("Device CA ist nicht konfiguriert.");
    if (!/^[A-Za-z0-9._-]{1,96}$/.test(deviceId)) throw new Error("Device-ID ist fuer ein Zertifikat ungueltig.");
    const publicKey = crypto.createPublicKey(publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ec" || publicKey.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
      throw new Error("Device Public Key muss ECDSA P-256 verwenden.");
    }

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-device-cert-"));
    const publicKeyPath = path.join(tempRoot, "device-public.pem");
    const extensionPath = path.join(tempRoot, "device.ext");
    const certificatePath = path.join(tempRoot, "device-cert.pem");
    try {
      fs.writeFileSync(publicKeyPath, publicKey.export({ type: "spki", format: "pem" }));
      fs.writeFileSync(extensionPath, [
        "basicConstraints=critical,CA:FALSE",
        "keyUsage=critical,digitalSignature",
        "extendedKeyUsage=clientAuth",
        `subjectAltName=URI:urn:gernetix:device:${deviceId}`,
      ].join("\n"));
      const serial = `0x${crypto.randomBytes(16).toString("hex")}`;
      await execFileAsync(this.opensslCommand, [
        "x509", "-new", "-force_pubkey", publicKeyPath,
        "-subj", `/CN=${deviceId}`,
        "-CA", this.caCertificatePath,
        "-CAkey", this.caPrivateKeyPath,
        "-set_serial", serial,
        "-days", String(this.validityDays),
        "-sha256", "-extfile", extensionPath,
        "-out", certificatePath,
      ], { windowsHide: true, timeout: 15000 });
      const certificatePem = fs.readFileSync(certificatePath, "utf8");
      const certificate = new crypto.X509Certificate(certificatePem);
      return {
        certificate_pem: certificatePem,
        certificate_serial_number: certificate.serialNumber.toLowerCase(),
        certificate_fingerprint_sha256: certificate.fingerprint256.replaceAll(":", "").toLowerCase(),
        issued_at: new Date(certificate.validFrom).toISOString(),
        expires_at: new Date(certificate.validTo).toISOString(),
      };
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

module.exports = { OpenSslDeviceCertificateIssuer };
