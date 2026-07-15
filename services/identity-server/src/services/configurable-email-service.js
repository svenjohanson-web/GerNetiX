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

  activeService() {
    return this.smtpEmailService.configured() ? this.smtpEmailService : this.fallbackEmailService;
  }
}

module.exports = { ConfigurableEmailService };
