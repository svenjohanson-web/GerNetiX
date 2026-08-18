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

  async send_community_notification_email(email, notification = {}) {
    const locale = ["de", "en", "nl"].includes(notification.locale) ? notification.locale : "de";
    const copy = communityNotificationCopy(locale, notification.category);
    return this.send(email, copy.subject, `${copy.text}\n\n${notification.link}`, notification.link);
  }

  async send_support_temporary_password_email(email, username, temporaryPassword, expiresAt) {
    const text = [
      `Fuer das GerNetiX-Konto ${String(username)} wurde durch den Support ein einmaliges vorlaeufiges Passwort erstellt.`,
      "",
      `Vorlaeufiges Passwort: ${String(temporaryPassword)}`,
      `Gueltig bis: ${new Date(expiresAt).toISOString()}`,
      "",
      "Das Passwort kann genau einmal verwendet werden und erlaubt nur die Einrichtung eines neuen Passkeys. Wenn du diesen Vorgang nicht angefordert hast, verwende das Passwort nicht und informiere den GerNetiX-Support.",
    ].join("\n");
    return this.send(email, "GerNetiX: vorlaeufiges Support-Passwort", text);
  }

  async testConnection() {
    const config = this.requireConfig();
    await this.createTransport(config).verify();
    return { ok: true };
  }

  async send(to, subject, text, link) {
    const config = this.requireConfig();
    let result;
    try {
      result = await this.createTransport(config).sendMail({
        from: config.from_address,
        to,
        replyTo: config.reply_to || undefined,
        subject,
        text,
        html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>${link ? `<p><a href="${escapeAttribute(link)}">Link oeffnen</a></p>` : ""}`,
      });
    } catch (error) {
      throw normalizedSmtpDeliveryError(error);
    }
    if (Array.isArray(result.rejected) && result.rejected.length) {
      const rejection = result.rejectedErrors?.[0];
      const response = String(rejection?.response || result.response || "");
      const responseCode = Number(rejection?.responseCode || response.match(/^\s*([45]\d{2})\b/)?.[1] || 0);
      throw normalizedSmtpDeliveryError({ responseCode, response });
    }
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

function normalizedSmtpDeliveryError(error) {
  const responseCode = Number(error?.responseCode || 0);
  const enhancedStatus = String(error?.response || "").match(/\b([245]\.\d{1,3}\.\d{1,3})\b/)?.[1] || "";
  const permanent = responseCode >= 500 && responseCode < 600;
  const compatibleEnhancedStatus = enhancedStatus.startsWith(permanent ? "5." : "4.") ? enhancedStatus : "";
  const normalized = new Error(permanent
    ? "E-Mail konnte dauerhaft nicht zugestellt werden."
    : "E-Mail konnte vorübergehend nicht zugestellt werden.");
  normalized.code = permanent ? "smtp_permanent_delivery_failure" : "smtp_temporary_delivery_failure";
  normalized.permanent = permanent;
  normalized.smtp_status = compatibleEnhancedStatus || (responseCode ? String(responseCode) : "");
  return normalized;
}

function communityNotificationCopy(locale, category) {
  const labels = {
    de: {
      direct_messages: ["GerNetiX: neue Direktnachricht", "Du hast eine neue Direktnachricht in GerNetiX."],
      thread_replies: ["GerNetiX: neue Antwort", "In einer deiner GerNetiX-Unterhaltungen gibt es eine neue Antwort."],
      support_replies: ["GerNetiX: neue Supportantwort", "Der GerNetiX-Support hat dir geantwortet."],
      project_invitations: ["GerNetiX: neue Projekteinladung", "Du hast eine neue Projekteinladung in GerNetiX."],
    },
    en: {
      direct_messages: ["GerNetiX: new direct message", "You have a new direct message in GerNetiX."],
      thread_replies: ["GerNetiX: new reply", "There is a new reply in one of your GerNetiX conversations."],
      support_replies: ["GerNetiX: new support reply", "GerNetiX support has replied to you."],
      project_invitations: ["GerNetiX: new project invitation", "You have a new project invitation in GerNetiX."],
    },
    nl: {
      direct_messages: ["GerNetiX: nieuw direct bericht", "Je hebt een nieuw direct bericht in GerNetiX."],
      thread_replies: ["GerNetiX: nieuw antwoord", "Er is een nieuw antwoord in een van je GerNetiX-gesprekken."],
      support_replies: ["GerNetiX: nieuw supportantwoord", "GerNetiX-support heeft je geantwoord."],
      project_invitations: ["GerNetiX: nieuwe projectuitnodiging", "Je hebt een nieuwe projectuitnodiging in GerNetiX."],
    },
  };
  const selected = labels[locale][category] || labels[locale].thread_replies;
  const privacy = {
    de: "Die E-Mail enthält bewusst keinen privaten Nachrichtentext.",
    en: "The email deliberately contains no private message content.",
    nl: "De e-mail bevat bewust geen privéberichtinhoud.",
  };
  return { subject: selected[0], text: `${selected[1]} ${privacy[locale]}` };
}

module.exports = { SmtpEmailService, normalizedSmtpDeliveryError };
