const crypto = require("node:crypto");

class TokenService {
  createRawToken() {
    return crypto.randomBytes(32).toString("base64url");
  }

  hashToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
  }

  createTokenRecord({ userId, ttlMinutes }) {
    const rawToken = this.createRawToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    return {
      rawToken,
      record: {
        user_id: userId,
        token_hash: this.hashToken(rawToken),
        expires_at: expiresAt.toISOString(),
        used_at: null,
        created_at: now.toISOString(),
      },
    };
  }
}

module.exports = { TokenService };
