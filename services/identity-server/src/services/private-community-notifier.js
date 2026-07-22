const EMAIL_SUBJECT = "GerNetiX: neue private Projektbegleitung";
const NOTIFICATION_TEXT = "Eine neue private Projektbegleitung wartet auf deine Antwort. Oeffne die Community in deiner GerNetiX-App.";

function createPrivateCommunityNotifier({
  smtpEmailService,
  smtpConfigStore,
  recordSystemEvent,
  webPushService,
  operatorAccountIds = [],
  emailRecipient = "",
  logger = console,
}) {
  const recipients = [...new Set(operatorAccountIds.map((value) => String(value || "").trim()).filter(Boolean))];

  return async function notifyPrivateCommunityRequest({ questionId }) {
    const smtpConfig = smtpConfigStore.deliveryConfig();
    const configuredRecipient = smtpConfig?.security_alert_recipient
      || smtpConfig?.reply_to
      || smtpConfig?.from_address
      || "";
    const recipient = String(emailRecipient || configuredRecipient).trim();

    const email = await safely(async () => {
      if (!recipient || !smtpEmailService.configured()) return { sent: false, skipped: true };
      await smtpEmailService.send(recipient, EMAIL_SUBJECT, NOTIFICATION_TEXT);
      return { sent: true };
    }, { sent: false, failed: true }, logger, "private community email notification");

    const push = await safely(async () => {
      if (!recipients.length) return { enabled: webPushService.enabled, delivered: 0, skipped: true };
      return webPushService.notifyAccounts(recipients, {
        title: "Neue private Projektbegleitung",
        body: "Eine neue private Anfrage wartet auf deine Antwort.",
        url: "/app/community/",
      });
    }, { enabled: webPushService.enabled, delivered: 0, failed: true }, logger, "private community push notification");

    const eventRecorded = await safely(() => recordSystemEvent({
      severity: "info",
      source_service: "identity_server",
      target_service: "community_platform",
      category: "community",
      event_type: "private_community_request_created",
      message: "Neue private Projektbegleitung liegt vor.",
      impact: "operator_action_required",
      route: "/app/community/",
      details: { community_request_id: String(questionId || ""), visibility: "private" },
    }), false, logger, "private community admin event");

    return { email, push, event_recorded: eventRecorded };
  };
}

async function safely(action, fallback, logger, label) {
  try { return await action(); } catch (error) {
    logger.warn?.(`GerNetiX ${label} failed: ${error.message || error}`);
    return fallback;
  }
}

module.exports = { createPrivateCommunityNotifier, EMAIL_SUBJECT, NOTIFICATION_TEXT };
