"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

test("admin exposes the privacy-safe user action operations view", () => {
  assert.match(html, /data-admin-view="user-actions">Nutzeraktionen/);
  assert.match(html, /id="userActionsView"/);
  assert.match(html, /4 von 4 initialen Wirkketten umgesetzt/);
  for (const actionType of ["nexi.flash.usb.start", "identity.login.passkey", "project.settings.save", "project.build.start"]) {
    assert.match(html, new RegExp(actionType.replaceAll(".", "\\.")));
  }
  assert.match(client, /\/api\/admin\/user-action-events/);
  assert.match(html, /id="userActionSearchForm"/);
  assert.match(html, /id="userActionTracePanel"/);
  assert.match(html, /id="userActionTimeline"/);
  assert.match(html, /id="userActionHours"/);
  assert.match(html, /id="userActionReleaseComparison"/);
  assert.match(html, /id="userActionReasonCodes"/);
  assert.match(html, /id="userActionIncidentCreateForm"/);
  assert.match(html, /id="userActionIncidentRows"/);
  assert.match(html, /Incident anlegen/);
  assert.match(html, /id="userActionAlertRows"/);
  assert.match(html, /id="evaluateUserActionAlertsButton"/);
  assert.match(html, /Beobachtungsmodus/);
  assert.match(client, /query\.set\("action_id", state\.userActionFilter\)/);
  assert.match(client, /recent_actions/);
  assert.match(client, /parent_span_id/);
  assert.match(client, /interface_calls/);
  assert.match(client, /Schnittstelle/);
  assert.match(client, /release_regressions/);
  assert.match(client, /top_reason_codes/);
  assert.match(client, /\/api\/admin\/user-action-incidents/);
  assert.match(client, /change_reason/);
  assert.match(client, /\/api\/admin\/user-action-alerts\/evaluate/);
  assert.match(client, /notification_state/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(client, /reason_code/);
  assert.doesNotMatch(client, /device_path|usb_id|raw_log|hostname/);
});
