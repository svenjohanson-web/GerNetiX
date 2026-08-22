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

  async send_community_notification_email(email, notification) {
    const message = {
      type: "community_notification",
      email,
      category: notification.category,
      locale: notification.locale,
      link: notification.link,
      sent_at: new Date().toISOString(),
    };
    this.sentMessages.push(message);
    this.logger.log("[MockEmailService] community_notification accepted");
    return message;
  }

  async send_support_temporary_password_email(email, username, temporaryPassword, expiresAt) {
    const message = { type: "support_temporary_password", email, username, temporary_password: temporaryPassword, expires_at: expiresAt, sent_at: new Date().toISOString() };
    this.sentMessages.push(message);
    this.logger.log(`[MockEmailService] support_temporary_password accepted`);
    return message;
  }
}

module.exports = { MockEmailService };
