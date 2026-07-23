"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { SqliteAccountAssetRepository } = require("../src/repositories/sqlite-account-asset-repository");

test("keeps QR codes and image styles owner-only in a separate SQL store", () => {
  const repository = new SqliteAccountAssetRepository(":memory:");
  try {
    const style = repository.create("account-a", {
      asset_type: "image_style",
      display_name: "Mein dunkler Stil",
      content_type: "application/json",
      content: Buffer.from('{"palette":"dark"}'),
      metadata: { purpose: "personal_image_generation" },
    });
    repository.create("account-b", {
      asset_type: "qr_code",
      display_name: "Kursraum QR",
      content_type: "image/svg+xml",
      content: Buffer.from("<svg></svg>"),
    });

    assert.equal(style.visibility, "owner_only");
    assert.equal(repository.list("account-a").length, 1);
    assert.equal(repository.list("account-b").length, 1);
    assert.equal(repository.get("account-a", style.asset_id).content_blob.toString(), '{"palette":"dark"}');
    assert.throws(() => repository.get("account-b", style.asset_id), { code: "account_asset_not_found" });
    assert.throws(() => repository.create("account-a", {
      asset_type: "image_style",
      display_name: "Öffentlich",
      visibility: "public",
    }), { code: "invalid_account_asset_visibility" });
    assert.throws(() => repository.create("account-a", {
      asset_type: "image",
      display_name: "Kaputt",
      content_base64: "not-base64",
    }), { code: "invalid_account_asset_content" });
    assert.equal(repository.delete("account-a", style.asset_id).status, "deleted");
    assert.equal(repository.list("account-a").length, 0);
  } finally {
    repository.close();
  }
});
