const crypto = require("node:crypto");

const SCRYPT_KEY_LENGTH = 64;

class PasswordHasher {
  hash(password) {
    assertPassword(password);
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
    return `scrypt$${salt}$${derived}`;
  }

  verify(password, storedHash) {
    assertPassword(password);
    const [algorithm, salt, expectedHex] = String(storedHash || "").split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHex) {
      return false;
    }

    const actual = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
  }
}

function assertPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }
}

module.exports = { PasswordHasher };
