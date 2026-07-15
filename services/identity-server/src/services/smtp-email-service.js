const nodemailer = require("nodemailer");

class SmtpEmailService {
  constructor({ configStore, transportFactory = nodemailer.createTransport }) {
    this.configStore = configStore;
    this.transportFactory = transportFactory;
  }

  configured() { return Boolean(this.configStore.deliveryConfig()); }

  async send_verification_email(email, verificationLink) {
    return this.send(email, "GerNetiX: E-Mail-Adresse bestaetigen", `Bitte bestaetige deine E-Mail-Adresse:\n${verificationLink}`, verificationLink);
  }

  async send_password_reset_email(email, resetLink) {
    return this.send(email, "GerNetiX: Passwort zuruecksetzen", `Du kannst dein Passwort hier zuruecksetzen:\n${resetLink}`, resetLink);
  }

  async testConnection() {
    const config = this.requireConfig();
    await this.createTransport(config).verify();
    return { ok: true };
  }

  async send(to, subject, text, link) {
    const config = this.requireConfig();
    const result = await this.createTransport(config).sendMail({
      from: config.from_address,
      to,
      replyTo: config.reply_to || undefined,
      subject,
      text,
      html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>${link ? `<p><a href="${escapeAttribute(link)}">Link oeffnen</a></p>` : ""}`,
    });
    return { type: "smtp", email: to, message_id: result.messageId || "", sent_at: new Date().toISOString() };
  }

  createTransport(config) {
    return this.transportFactory({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.username, pass: config.password } });
  }

  requireConfig() {
    const config = this.configStore.deliveryConfig();
    if (!config) throw new Error("SMTP-Mailversand ist noch nicht konfiguriert.");
    return config;
  }
}

function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function escapeAttribute(value) { return escapeHtml(value).replace(/"/g, "&quot;"); }

module.exports = { SmtpEmailService };
