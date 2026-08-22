class ConfigurableEmailService {
  constructor({ smtpEmailService, fallbackEmailService }) {
    this.smtpEmailService = smtpEmailService;
    this.fallbackEmailService = fallbackEmailService;
  }

  async send_verification_email(email, link) {
    return this.activeService().send_verification_email(email, link);
  }

  async send_password_reset_email(email, link) {
    return this.activeService().send_password_reset_email(email, link);
  }

  async send_community_notification_email(email, notification) {
    return this.activeService().send_community_notification_email(email, notification);
  }

  async send_support_temporary_password_email(email, username, temporaryPassword, expiresAt) {
    if (!this.smtpEmailService.configured()) throw new Error("SMTP-Mailversand ist fuer Support-Recovery nicht konfiguriert.");
    return this.smtpEmailService.send_support_temporary_password_email(email, username, temporaryPassword, expiresAt);
  }

  activeService() {
    return this.smtpEmailService.configured() ? this.smtpEmailService : this.fallbackEmailService;
  }
}

module.exports = { ConfigurableEmailService };
