"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("account UI offers optional email and separate personal community preferences", () => {
  const html = fs.readFileSync(path.join(root, "public/app/index.html"), "utf8");
  const controller = fs.readFileSync(path.join(root, "public/app/app-account-controller.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "public/app/app.css"), "utf8");

  assert.match(html, /Dein Konto und die Community funktionieren ohne E-Mail/);
  assert.match(html, /Werbung und allgemeine Rundmails sind nicht Teil/);
  assert.match(html, /href="\/datenschutz\/"[\s\S]*Datenschutzinformation zu Kontaktadresse und Versand/);
  for (const category of ["direct_messages", "thread_replies", "support_replies", "project_invitations"]) {
    assert.match(html, new RegExp(`name="${category}"`));
  }
  assert.match(controller, /\/api\/account\/contact-notifications/);
  assert.match(controller, /\/api\/account\/contact-email/);
  assert.match(controller, /Community-E-Mails sind nach einer dauerhaften Unzustellbarkeit pausiert/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*account-contact-email-row/);
  assert.doesNotMatch(html, /Datenschutz.*(?:akzeptiere|zustimm|Kenntnis)/i);
});

test("registration accepts only terms and does not require privacy acknowledgement", () => {
  const authHtml = fs.readFileSync(path.join(root, "public/app/auth/index.html"), "utf8");
  for (const locale of ["de", "en", "nl"]) {
    const catalog = JSON.parse(fs.readFileSync(path.join(root, `public/app/i18n/locales/${locale}.json`), "utf8"));
    assert.equal(/privacy|datenschutz|privacybeleid/i.test(catalog["auth.register.terms"]), false);
  }
  assert.match(authHtml, /Ich akzeptiere die Nutzungsbedingungen/);
  assert.match(authHtml, /href="\/datenschutz\/"[\s\S]*Datenschutzinformation/);
  assert.match(authHtml, /Dafür ist keine Zustimmung erforderlich/);
  assert.doesNotMatch(authHtml, /Ich akzeptiere Datenschutz/);
});
