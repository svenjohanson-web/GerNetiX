const crypto = require("node:crypto");
const { SqliteStateStore } = require("../../../shared");

class SmtpConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function createSmtpConfigStore({ sqlitePath, encryptionKey = "" }) {
  const store = new SqliteStateStore(sqlitePath, "identity-email-config", { defaultState: { config: null } });
  const key = parseEncryptionKey(encryptionKey);

  function publicConfig() {
    const config = store.load().config;
    return {
      configured: Boolean(config?.password_ciphertext && key),
      encryption_ready: Boolean(key),
      provider: config?.provider || "ionos",
      host: config?.host || "smtp.ionos.de",
      port: Number(config?.port || 465),
      secure: config?.secure !== false,
      username: config?.username || "",
      from_address: config?.from_address || "",
      reply_to: config?.reply_to || "",
      security_alert_recipient: config?.security_alert_recipient || "",
      has_password: Boolean(config?.password_ciphertext),
      updated_at: config?.updated_at || "",
    };
  }

  function update(input = {}) {
    if (!key) throw new SmtpConfigError("email_config_encryption_key_missing", "Der Server benoetigt EMAIL_CONFIG_ENCRYPTION_KEY, bevor SMTP-Zugangsdaten gespeichert werden duerfen.");
    const current = store.load().config || {};
    const next = normalizeConfig({ ...current, ...input });
    if (Object.hasOwn(input, "password")) {
      if (!String(input.password || "").trim()) throw new SmtpConfigError("invalid_smtp_password", "Das SMTP-Passwort darf nicht leer sein.");
      next.password_ciphertext = encrypt(String(input.password), key);
    } else {
      next.password_ciphertext = current.password_ciphertext || "";
    }
    if (!next.password_ciphertext) throw new SmtpConfigError("smtp_password_missing", "Bitte ein SMTP-Passwort hinterlegen.");
    next.updated_at = new Date().toISOString();
    store.save({ config: next });
    return publicConfig();
  }

  function deliveryConfig() {
    const config = store.load().config;
    if (!config?.password_ciphertext || !key) return null;
    return { ...config, password: decrypt(config.password_ciphertext, key) };
  }

  return { publicConfig, update, deliveryConfig };
}

function normalizeConfig(input) {
  const host = String(input.host || "smtp.ionos.de").trim();
  const username = String(input.username || "").trim();
  const fromAddress = String(input.from_address || "").trim();
  const port = Number(input.port || 465);
  if (!host || !username || !fromAddress || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SmtpConfigError("invalid_smtp_config", "SMTP-Host, Port, Benutzername und Absenderadresse muessen gueltig sein.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(username) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromAddress)) {
    throw new SmtpConfigError("invalid_smtp_email", "SMTP-Benutzername und Absenderadresse muessen E-Mail-Adressen sein.");
  }
  return {
    provider: "ionos",
    host,
    port,
    secure: input.secure !== false,
    username,
    from_address: fromAddress,
    reply_to: String(input.reply_to || "").trim(),
    security_alert_recipient: String(input.security_alert_recipient || "").trim(),
  };
}

function parseEncryptionKey(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const key = Buffer.from(text, "base64");
    return key.length === 32 ? key : null;
  } catch { return null; }
}

function encrypt(value, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${encrypted.toString("base64")}`;
}

function decrypt(value, key) {
  const [ivText, tagText, encryptedText] = String(value || "").split(".");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64"));
    decipher.setAuthTag(Buffer.from(tagText, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new SmtpConfigError("smtp_config_decryption_failed", "Die gespeicherten SMTP-Zugangsdaten koennen nicht entschluesselt werden.");
  }
}

module.exports = { createSmtpConfigStore, SmtpConfigError };
