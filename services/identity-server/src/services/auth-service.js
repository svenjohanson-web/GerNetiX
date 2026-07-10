const { AuthError } = require("../errors");
const { PasswordHasher } = require("../security/password-hasher");
const { TokenService } = require("../security/token-service");

const USER_STATUS = {
  PENDING_VERIFICATION: "pending_verification",
  VERIFIED: "verified",
  DISABLED: "disabled",
};

class AuthService {
  constructor({
    repository,
    emailService,
    providers = [],
    passwordHasher = new PasswordHasher(),
    tokenService = new TokenService(),
    appBaseUrl = "http://localhost:3000",
  }) {
    this.repository = repository;
    this.emailService = emailService;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.appBaseUrl = appBaseUrl.replace(/\/$/, "");
    this.providers = new Map(providers.map((provider) => [provider.providerName, provider]));
  }

  async register_local(username, email, password, accepted_terms, password_repeat = password, options = {}) {
    assertTermsAccepted(accepted_terms);
    assertRegistrationInput(username, email, password, password_repeat);

    try {
      const account = this.repository.createUserAccount({
        id: options.user_id || options.userId || "",
        username: username.trim(),
        email,
        status: USER_STATUS.PENDING_VERIFICATION,
      });
      this.repository.createLocalCredential({
        userId: account.id,
        passwordHash: this.passwordHasher.hash(password),
      });

      const verification = this.createVerificationToken(account.id);
      await this.emailService.send_verification_email(
        account.email,
        `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(verification.rawToken)}`,
      );

      return {
        account: toPublicAccount(account),
      };
    } catch (error) {
      if (error.message === "USERNAME_ALREADY_EXISTS") {
        throw new AuthError("username_already_exists", "Username is already in use.", 409);
      }
      if (error.message === "EMAIL_ALREADY_EXISTS") {
        throw new AuthError("email_already_exists", "Email is already in use.", 409);
      }
      if (error.message === "USER_ID_ALREADY_EXISTS") {
        throw new AuthError("user_id_already_exists", "User ID is already in use.", 409);
      }
      throw error;
    }
  }

  async verify_email(token) {
    const tokenRecord = this.readValidVerificationToken(token);
    const account = this.repository.findUserById(tokenRecord.user_id);
    if (!account) {
      throw new AuthError("invalid_token", "Verification token is invalid.", 400);
    }

    this.repository.markVerificationTokenUsed(tokenRecord.id);
    const verifiedAccount = this.repository.updateUserAccount(account.id, {
      status: USER_STATUS.VERIFIED,
    });

    return { account: toPublicAccount(verifiedAccount) };
  }

  async login_local(identifier, password) {
    const account = findAccountByIdentifier(this.repository, identifier);
    if (!account) {
      throw new AuthError("invalid_credentials", "Invalid username/email or password.", 401);
    }

    const credential = this.repository.findLocalCredentialByUserId(account.id);
    if (!credential || !this.passwordHasher.verify(password, credential.password_hash)) {
      throw new AuthError("invalid_credentials", "Invalid username/email or password.", 401);
    }

    assertAccountCanLogin(account);
    return this.createSessionResponse(account);
  }

  async login_external(providerName, providerTokenOrMockPayload) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new AuthError("unsupported_provider", `Unsupported provider '${providerName}'.`, 400);
    }

    const providerIdentity = await provider.authenticate(providerTokenOrMockPayload);
    const existingIdentity = this.repository.findExternalIdentity(
      providerIdentity.provider,
      providerIdentity.provider_user_id,
    );

    if (existingIdentity) {
      this.repository.touchExternalIdentity(existingIdentity.id);
      const existingAccount = this.repository.findUserById(existingIdentity.user_id);
      assertAccountCanLogin(existingAccount);
      return this.createSessionResponse(existingAccount);
    }

    const username = this.suggestUniqueUsername(providerIdentity);
    let account;
    try {
      account = this.repository.createUserAccount({
        username,
        email: providerIdentity.email,
        status: providerIdentity.email_verified
          ? USER_STATUS.VERIFIED
          : USER_STATUS.PENDING_VERIFICATION,
      });
    } catch (error) {
      if (error.message === "EMAIL_ALREADY_EXISTS") {
        throw new AuthError(
          "email_already_exists_link_required",
          "An account with this email already exists. Explicit account linking is required.",
          409,
        );
      }
      if (error.message === "USERNAME_ALREADY_EXISTS") {
        throw new AuthError("username_already_exists", "Username is already in use.", 409);
      }
      throw error;
    }

    this.repository.createExternalIdentity({
      userId: account.id,
      provider: providerIdentity.provider,
      providerUserId: providerIdentity.provider_user_id,
      providerEmail: providerIdentity.email,
    });

    if (!providerIdentity.email_verified) {
      const verification = this.createVerificationToken(account.id);
      await this.emailService.send_verification_email(
        account.email,
        `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(verification.rawToken)}`,
      );
    }

    if (account.status !== USER_STATUS.VERIFIED) {
      return {
        account: toPublicAccount(account),
        session: null,
        requires_email_verification: true,
      };
    }

    return this.createSessionResponse(account);
  }

  async logout(sessionIdOrToken) {
    const session =
      this.repository.findSessionById(sessionIdOrToken) ||
      this.repository.findSessionByTokenHash(this.tokenService.hashToken(sessionIdOrToken));

    if (!session || session.revoked_at) {
      return { logged_out: true };
    }

    this.repository.revokeSession(session.id);
    return { logged_out: true };
  }

  resolve_session_token(rawToken) {
    const session = this.repository.findSessionByTokenHash(this.tokenService.hashToken(rawToken));
    if (!session || session.revoked_at || isExpired(session.expires_at)) return null;
    const account = this.repository.findUserById(session.user_id);
    if (!account) return null;
    return {
      account: toPublicAccount(account),
      session: {
        id: session.id,
        user_id: session.user_id,
        expires_at: session.expires_at,
      },
    };
  }

  async request_password_reset(email) {
    const account = this.repository.findUserByEmail(email);
    if (!account) {
      return neutralPasswordResetResponse();
    }

    const credential = this.repository.findLocalCredentialByUserId(account.id);
    if (!credential) {
      return neutralPasswordResetResponse();
    }

    const reset = this.tokenService.createTokenRecord({ userId: account.id, ttlMinutes: 30 });
    this.repository.createPasswordResetToken(reset.record);
    await this.emailService.send_password_reset_email(
      account.email,
      `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(reset.rawToken)}`,
    );

    return {
      ...neutralPasswordResetResponse(),
    };
  }

  async reset_password(token, newPassword) {
    const tokenHash = this.tokenService.hashToken(token);
    const tokenRecord = this.repository.findPasswordResetTokenByHash(tokenHash);
    if (!tokenRecord || tokenRecord.used_at || isExpired(tokenRecord.expires_at)) {
      throw new AuthError("invalid_token", "Password reset token is invalid or expired.", 400);
    }

    const account = this.repository.findUserById(tokenRecord.user_id);
    if (!account) {
      throw new AuthError("invalid_token", "Password reset token is invalid or expired.", 400);
    }

    const credential = this.repository.findLocalCredentialByUserId(account.id);
    if (!credential) {
      throw new AuthError("local_credential_missing", "No local credential exists for this account.", 400);
    }

    this.repository.updateLocalCredential(account.id, {
      password_hash: this.passwordHasher.hash(newPassword),
    });
    this.repository.markPasswordResetTokenUsed(tokenRecord.id);

    return { password_changed: true };
  }

  createVerificationToken(userId) {
    const verification = this.tokenService.createTokenRecord({ userId, ttlMinutes: 24 * 60 });
    const record = this.repository.createVerificationToken(verification.record);
    return { rawToken: verification.rawToken, record };
  }

  readValidVerificationToken(token) {
    const tokenHash = this.tokenService.hashToken(token);
    const tokenRecord = this.repository.findVerificationTokenByHash(tokenHash);
    if (!tokenRecord || tokenRecord.used_at || isExpired(tokenRecord.expires_at)) {
      throw new AuthError("invalid_token", "Verification token is invalid or expired.", 400);
    }
    return tokenRecord;
  }

  createSessionResponse(account) {
    const rawToken = this.tokenService.createRawToken();
    const now = Date.now();
    const expiresAt = new Date(now + 12 * 60 * 60 * 1000).toISOString();
    const session = this.repository.createSession({
      userId: account.id,
      tokenHash: this.tokenService.hashToken(rawToken),
      expiresAt,
    });

    return {
      account: toPublicAccount(account),
      session: {
        id: session.id,
        user_id: session.user_id,
        token: rawToken,
        expires_at: session.expires_at,
      },
    };
  }

  suggestUniqueUsername(providerIdentity) {
    const preferred = providerIdentity.username || String(providerIdentity.email).split("@")[0];
    const base = sanitizeUsername(preferred || providerIdentity.provider_user_id || "user");
    let candidate = base;
    let suffix = 2;
    while (this.repository.usernameExists(candidate)) {
      candidate = `${base}${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}

function assertRegistrationInput(username, email, password, passwordRepeat) {
  if (!username || String(username).trim().length < 3) {
    throw new AuthError("invalid_username", "Username must contain at least 3 characters.", 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ""))) {
    throw new AuthError("invalid_email", "Email address is invalid.", 400);
  }
  if (password !== passwordRepeat) {
    throw new AuthError("password_repeat_mismatch", "Password repeat does not match.", 400);
  }
}

function assertTermsAccepted(acceptedTerms) {
  if (acceptedTerms !== true) {
    throw new AuthError("terms_not_accepted", "Privacy policy and terms must be accepted.", 400);
  }
}

function findAccountByIdentifier(repository, identifier) {
  const value = String(identifier || "").trim();
  return value.includes("@") ? repository.findUserByEmail(value) : repository.findUserByUsername(value);
}

function assertAccountCanLogin(account) {
  if (!account) {
    throw new AuthError("invalid_credentials", "Invalid credentials.", 401);
  }
  if (account.status === USER_STATUS.DISABLED) {
    throw new AuthError("account_disabled", "Account is disabled.", 403);
  }
  if (account.status !== USER_STATUS.VERIFIED) {
    throw new AuthError("account_not_verified", "Account is not verified.", 403);
  }
}

function isExpired(expiresAt) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function neutralPasswordResetResponse() {
  return {
    accepted: true,
    message: "If the email address exists and has a local credential, a reset link was created.",
  };
}

function sanitizeUsername(value) {
  const cleaned = String(value).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
  return cleaned.length >= 3 ? cleaned : `user${cleaned}`;
}

function toPublicAccount(account) {
  return {
    user_id: account.id,
    username: account.username,
    status: account.status,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}

module.exports = {
  AuthService,
  USER_STATUS,
};
