const { EventEmitter } = require("node:events");
const net = require("node:net");
const tls = require("node:tls");

class DeviceMqttClient extends EventEmitter {
  constructor(options) {
    super();
    this.url = new URL(options.url);
    this.clientId = String(options.clientId);
    this.username = String(options.username);
    this.tlsOptions = options.tlsOptions || {};
    this.connectTimeoutMs = options.connectTimeoutMs || 5_000;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.connecting = null;
    this.closedByCaller = false;
  }

  connect() {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.closedByCaller = false;
    this.connecting = new Promise((resolve, reject) => {
      const secure = this.url.protocol === "mqtts:";
      const port = Number(this.url.port || (secure ? 8883 : 1883));
      const socket = secure
        ? tls.connect({ host: this.url.hostname, port, servername: this.url.hostname, ...this.tlsOptions })
        : net.connect({ host: this.url.hostname, port });
      this.socket = socket;
      let settled = false;
      const timer = setTimeout(() => finish(new Error("MQTT connect timeout")), this.connectTimeoutMs);
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) { socket.destroy(); reject(error); }
        else resolve();
      };
      socket.once("error", finish);
      socket.on("data", (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.consume((code) => code === 0 ? finish() : finish(new Error(`MQTT CONNACK ${code}`)));
      });
      socket.on("close", () => {
        this.socket = null;
        this.buffer = Buffer.alloc(0);
        if (!settled) finish(new Error("MQTT connection closed before CONNACK"));
        if (!this.closedByCaller) this.emit("disconnect");
      });
      socket.once(secure ? "secureConnect" : "connect", () => socket.write(connectPacket(this.clientId, this.username)));
    }).finally(() => { this.connecting = null; });
    return this.connecting;
  }

  publish(topic, payload) {
    if (!this.socket || this.socket.destroyed) return Promise.reject(new Error("MQTT client is not connected"));
    const variable = mqttString(topic);
    const packet = packetBuffer(0x30, Buffer.concat([variable, Buffer.from(String(payload))]));
    return new Promise((resolve, reject) => this.socket.write(packet, (error) => error ? reject(error) : resolve()));
  }

  close() {
    this.closedByCaller = true;
    if (this.socket && !this.socket.destroyed) this.socket.end(Buffer.from([0xe0, 0x00]));
    this.socket = null;
  }

  consume(onConnack) {
    while (this.buffer.length > 1) {
      const remaining = decodeRemainingLength(this.buffer, 1);
      if (!remaining || this.buffer.length < remaining.offset + remaining.value) return;
      const type = this.buffer[0] >> 4;
      const payload = this.buffer.subarray(remaining.offset, remaining.offset + remaining.value);
      this.buffer = this.buffer.subarray(remaining.offset + remaining.value);
      if (type === 2 && payload.length >= 2) onConnack(payload[1]);
    }
  }
}

function connectPacket(clientId, username) {
  const fields = [mqttString(clientId), mqttString(username)];
  return packetBuffer(0x10, Buffer.concat([mqttString("MQTT"), Buffer.from([4, 0x82]), uint16(60), ...fields]));
}

function mqttString(value) {
  const content = Buffer.from(String(value));
  if (content.length > 65_535) throw new Error("MQTT string is too long");
  return Buffer.concat([uint16(content.length), content]);
}
function uint16(value) { const result = Buffer.alloc(2); result.writeUInt16BE(value); return result; }
function packetBuffer(header, payload) { return Buffer.concat([Buffer.from([header]), encodeRemainingLength(payload.length), payload]); }
function encodeRemainingLength(value) { const bytes = []; do { let digit = value % 128; value = Math.floor(value / 128); if (value) digit |= 128; bytes.push(digit); } while (value); return Buffer.from(bytes); }
function decodeRemainingLength(buffer, start) { let multiplier = 1; let value = 0; let index = start; while (index < buffer.length && index < start + 4) { const digit = buffer[index++]; value += (digit & 127) * multiplier; if (!(digit & 128)) return { value, offset: index }; multiplier *= 128; } return null; }

module.exports = { DeviceMqttClient, connectPacket, decodeRemainingLength, encodeRemainingLength, packetBuffer };
