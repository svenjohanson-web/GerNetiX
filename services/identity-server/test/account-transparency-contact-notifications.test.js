"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createAccountTransparencyFactory } = require("../src/dev/account-transparency");

test("account transparency exposes contact data and preferences without classifying them as marketing consent", async () => {
  const emptyItems = async () => ({ items: [] });
  const createTransparency = createAccountTransparencyFactory({
    aiUsageJson: emptyItems,
    deviceManagementJson: emptyItems,
    hardwareShopJson: emptyItems,
    projectServerJson: emptyItems,
    projectServerUserId: () => "user-1",
    getContactNotificationSettings: async () => ({
      email: "person@example.net",
      pending_email: null,
      status: "verified",
      notification_preferences: {
        thread_replies: true,
        direct_messages: false,
        support_replies: true,
        project_invitations: false,
      },
      community_email_suppression: { active: true, reason_code: "mailbox_disabled", smtp_status: "550" },
    }),
  });

  const result = await createTransparency({ account: { user_id: "user-1", username: "person" } });

  assert.deepEqual(result.contact_data.email, "person@example.net");
  assert.equal(result.contact_data.email_status, "verified");
  assert.equal(result.notification_preferences.thread_replies, true);
  assert.equal(result.notification_preferences.direct_messages, false);
  assert.equal(result.notification_preferences.community_email_suppression.reason_code, "mailbox_disabled");
  assert.equal(
    result.notification_preferences.classification,
    "personal_community_notifications_not_marketing_consent",
  );
  assert.equal(Object.hasOwn(result.consents_and_customer_data_access, "notification_preferences"), false);
});
