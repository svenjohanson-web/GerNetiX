class MockEmailService {
  constructor(logger = console) {
    this.logger = logger;
    this.sentMessages = [];
  }

  async send_verification_email(email, verificationLink) {
    const message = {
      type: "verification",
      email,
      link: verificationLink,
      sent_at: new Date().toISOString(),
    };
    this.sentMessages.push(message);
    this.logger.log(`[MockEmailService] verification ${email}: ${verificationLink}`);
    return message;
  }

  async send_password_reset_email(email, resetLink) {
    const message = {
      type: "password_reset",
      email,
      link: resetLink,
      sent_at: new Date().toISOString(),
    };
    this.sentMessages.push(message);
    this.logger.log(`[MockEmailService] password_reset ${email}: ${resetLink}`);
    return message;
  }
}

module.exports = { MockEmailService };
