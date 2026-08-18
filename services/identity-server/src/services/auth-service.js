const { AuthError } = require("../errors");
const { PasswordHasher } = require("../security/password-hasher");
const { TokenService } = require("../security/token-service");
const {
  ACCOUNT_LIFECYCLE_STATE,
  effectiveSubscriptionPlan,
  lifecycleTransitionPatch,
  normalizeLifecycleState,
  normalizeSubscriptionPlan,
  optionalTimestamp,
} = require("./account-lifecycle");
const crypto = require("node:crypto");

const USER_STATUS = {
  PENDING_VERIFICATION: "pending_verification",
  VERIFIED: "verified",
  DISABLED: "disabled",
};
const SUPPORT_RECOVERY_VERIFICATION_REASONS = new Set(["verified_existing_support_callback", "verified_customer_contract_reference", "verified_operator_exception"]);
const COMMUNITY_NOTIFICATION_KEYS = ["thread_replies", "direct_messages", "support_replies", "project_invitations"];

class AuthService {
  constructor({
    repository,
    emailService,
    providers = [],
    passwordHasher = new PasswordHasher(),
    tokenService = new TokenService(),
    appBaseUrl = "http://localhost:3000",
    clock = () => new Date(),
  }) {
    this.repository = repository;
    this.emailService = emailService;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.appBaseUrl = appBaseUrl.replace(/\/$/, "");
    this.clock = clock;
    this.providers = new Map(providers.map((provider) => [provider.providerName, provider]));
  }

  async list_knowledge_chapter_reads(accountId) {
    return this.repository.listKnowledgeChapterReads(accountId);
  }

  async mark_knowledge_chapter_read(accountId, chapterId, chapterVersion) {
    return this.repository.markKnowledgeChapterRead(accountId, chapterId, chapterVersion);
  }

  async register_local(username, email, password, accepted_terms, password_repeat = password, options = {}) {
    assertTermsAccepted(accepted_terms);
    assertRegistrationInput(username, email, password, password_repeat);

    try {
      const account = await this.repository.createUserAccount({
        id: options.user_id || options.userId || "",
        username: username.trim(),
        email,
        status: USER_STATUS.PENDING_VERIFICATION,
        preferredLocale: normalizePreferredLocale(options.preferred_locale || options.preferredLocale),
        subscriptionPlan: normalizeSubscriptionPlan(options.subscription_plan || options.subscriptionPlan),
        planValidUntil: optionalTimestamp(options.plan_valid_until ?? options.planValidUntil, "plan_valid_until"),
      });
      await this.repository.createLocalCredential({
        userId: account.id,
        passwordHash: this.passwordHasher.hash(password),
      });

      const verification = await this.createVerificationToken(account.id);
      await this.emailService.send_verification_email(
        account.email,
        `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(verification.rawToken)}`,
      );

      return {
        account: toPublicAccount(account, this.clock()),
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
    const tokenRecord = await this.readValidVerificationToken(token);
    const account = await this.repository.findUserById(tokenRecord.user_id);
    if (!account) {
      throw new AuthError("invalid_token", "Verification token is invalid.", 400);
    }

    const verifiesPendingContact = Boolean(account.pending_email && account.pending_email_token_id === tokenRecord.id);
    const verifiedAccount = await this.repository.updateUserAccount(account.id, verifiesPendingContact ? {
      email: account.pending_email,
      email_verified_at: this.clock().toISOString(),
      email_contact_version: tokenRecord.id,
      pending_email: null,
      pending_email_token_id: null,
      pending_email_requested_at: null,
      community_email_suppression: null,
    } : {
      status: USER_STATUS.VERIFIED,
      email_verified_at: account.email ? this.clock().toISOString() : null,
      email_contact_version: account.email ? tokenRecord.id : null,
      community_email_suppression: null,
    });
    await this.repository.markVerificationTokenUsed(tokenRecord.id);

    return { account: toPublicAccount(verifiedAccount, this.clock()) };
  }

  async create_guest(options = {}) {
    const expiresAt = new Date(Date.now() + Number(options.ttlMs || 24 * 60 * 60 * 1000)).toISOString();
    const account = await this.repository.createUserAccount({
      username: await this.suggestGuestUsername(),
      email: null,
      status: USER_STATUS.VERIFIED,
      accountType: "guest",
      guestExpiresAt: expiresAt,
      preferredLocale: normalizePreferredLocale(options.preferred_locale || options.preferredLocale),
      subscriptionPlan: "free",
    });
    return this.createSessionResponse(account);
  }

  async create_passkey_account(username, passkey, options = {}) {
    assertPseudonymousUsername(username);
    if (!passkey?.credentialId || !passkey?.publicKey) throw new AuthError("passkey_required", "A verified passkey is required.", 400);
    try {
      const account = await this.repository.createUserAccount({
        username: username.trim(), email: null, status: USER_STATUS.VERIFIED, accountType: "base",
        passkeyCredentialId: passkey.credentialId, passkeyPublicKey: passkey.publicKey,
        passkeyCounter: Number(passkey.counter || 0), passkeyTransports: passkey.transports || [],
        preferredLocale: normalizePreferredLocale(options.preferred_locale || options.preferredLocale),
        subscriptionPlan: normalizeSubscriptionPlan(options.subscription_plan || options.subscriptionPlan),
        planValidUntil: optionalTimestamp(options.plan_valid_until ?? options.planValidUntil, "plan_valid_until"),
      });
      await this.repository.createPasskeyCredential({
        userId: account.id, credentialId: passkey.credentialId, publicKey: passkey.publicKey,
        counter: passkey.counter, transports: passkey.transports, rpId: passkey.rpId || "legacy-unknown", label: passkey.label,
      });
      await this.repository.updateUserAccount(account.id, { passkey_rp_id: passkey.rpId || "legacy-unknown" });
      return this.createSessionResponse(account);
    } catch (error) {
      if (error.message === "USERNAME_ALREADY_EXISTS") throw new AuthError("username_already_exists", "Username is already in use.", 409);
      throw error;
    }
  }

  async get_passkey_login_candidate(username, rpId = "") {
    const account = await this.repository.findUserByUsername(username);
    return this.assertPasskeyLoginCandidate(account, rpId);
  }

  async update_preferred_locale(userId, locale) {
    const preferredLocale = normalizePreferredLocale(locale, "");
    if (!preferredLocale) throw new AuthError("invalid_locale", "Locale is not supported.", 400);
    const account = await this.repository.updateUserAccount(userId, { preferred_locale: preferredLocale });
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    return toPublicAccount(account, this.clock());
  }

  async get_contact_notification_settings(userId) {
    const account = await this.repository.findUserById(userId);
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    return contactNotificationSettings(account);
  }

  async request_contact_email_change(userId, email) {
    const account = await this.repository.findUserById(userId);
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    if (account.account_type === "guest") throw new AuthError("persistent_account_required", "A persistent account is required.", 409);
    const normalizedEmail = normalizeContactEmail(email);
    const existing = await this.repository.findUserByEmail(normalizedEmail);
    if (existing && existing.id !== account.id) throw new AuthError("email_already_exists", "Email is already in use.", 409);
    if (account.email === normalizedEmail && isVerifiedContact(account) && !activeCommunityEmailSuppression(account)) {
      return contactNotificationSettings(account);
    }

    const verification = await this.createVerificationToken(account.id);
    const updated = await this.repository.updateUserAccount(account.id, {
      pending_email: normalizedEmail,
      pending_email_token_id: verification.record.id,
      pending_email_requested_at: this.clock().toISOString(),
    });
    await this.emailService.send_verification_email(
      normalizedEmail,
      `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(verification.rawToken)}`,
    );
    return contactNotificationSettings(updated);
  }

  async remove_contact_email(userId) {
    const account = await this.repository.findUserById(userId);
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    if (account.account_type === "email_account") {
      throw new AuthError("contact_email_required_for_login", "This account requires its verified email address.", 409);
    }
    const updated = await this.repository.updateUserAccount(userId, {
      email: null,
      email_verified_at: null,
      email_contact_version: null,
      pending_email: null,
      pending_email_token_id: null,
      pending_email_requested_at: null,
      notification_preferences: defaultNotificationPreferences(),
      community_email_suppression: null,
    });
    return contactNotificationSettings(updated);
  }

  async update_notification_preferences(userId, patch = {}) {
    const account = await this.repository.findUserById(userId);
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    const current = normalizeNotificationPreferences(account.notification_preferences);
    const next = { ...current };
    for (const key of COMMUNITY_NOTIFICATION_KEYS) {
      if (Object.hasOwn(patch, key)) next[key] = patch[key] === true;
    }
    if (Object.values(next).some(Boolean) && !isVerifiedContact(account)) {
      throw new AuthError("verified_contact_email_required", "A verified contact email is required.", 409);
    }
    const updated = await this.repository.updateUserAccount(userId, { notification_preferences: next });
    return contactNotificationSettings(updated);
  }

  async deliver_community_notification(input = {}) {
    const eventId = String(input.event_id || "").trim();
    const userId = String(input.recipient_user_id || "").trim();
    const category = String(input.category || "").trim();
    if (!eventId || eventId.length > 200 || !userId || !COMMUNITY_NOTIFICATION_KEYS.includes(category)) {
      throw new AuthError("invalid_community_notification", "Community notification is invalid.", 400);
    }
    const previous = await this.repository.findNotificationDelivery(eventId);
    const processingIsFresh = previous?.status === "processing"
      && this.clock().getTime() - new Date(previous.updated_at || previous.created_at || 0).getTime() < 5 * 60 * 1000;
    if (previous && (["sent", "skipped"].includes(previous.status) || processingIsFresh)) {
      return { event_id: eventId, status: previous.status, deduplicated: true };
    }
    const createdAt = previous?.created_at || this.clock().toISOString();
    await this.repository.saveNotificationDelivery({
      event_id: eventId, user_id: userId, category, status: "processing", reason: null,
      provider_message_id: null, recipient_version: previous?.recipient_version || null, created_at: createdAt,
    });
    const account = await this.repository.findUserById(userId);
    const preferences = normalizeNotificationPreferences(account?.notification_preferences);
    const suppression = activeCommunityEmailSuppression(account);
    if (!account || !isVerifiedContact(account) || preferences[category] !== true || suppression) {
      await this.repository.saveNotificationDelivery({
        event_id: eventId, user_id: userId, category, status: "skipped",
        reason: !account ? "account_not_found" : !isVerifiedContact(account) ? "verified_contact_missing" : preferences[category] !== true ? "preference_disabled" : "address_suppressed",
        provider_message_id: null, recipient_version: account ? contactEmailVersion(account) : null, created_at: createdAt,
      });
      return { event_id: eventId, status: "skipped" };
    }
    try {
      const delivery = await this.emailService.send_community_notification_email(account.email, {
        category,
        locale: normalizePreferredLocale(account.preferred_locale),
        link: `${this.appBaseUrl}/app/messages/`,
      });
      await this.repository.saveNotificationDelivery({
        event_id: eventId, user_id: userId, category, status: "sent", reason: null,
        provider_message_id: delivery?.message_id || "", recipient_version: contactEmailVersion(account), created_at: createdAt,
      });
      return { event_id: eventId, status: "sent" };
    } catch (error) {
      if (error?.permanent === true) {
        await this.repository.updateUserAccount(userId, {
          community_email_suppression: createCommunityEmailSuppression(account, {
            reasonCode: "permanent_delivery_failure", source: "smtp_sync", smtpStatus: error.smtp_status,
          }, this.clock()),
        });
        await this.repository.saveNotificationDelivery({
          event_id: eventId, user_id: userId, category, status: "skipped",
          reason: "address_suppressed", provider_message_id: null,
          recipient_version: contactEmailVersion(account), created_at: createdAt,
        });
        return { event_id: eventId, status: "skipped", reason: "address_suppressed" };
      }
      await this.repository.saveNotificationDelivery({
        event_id: eventId, user_id: userId, category, status: "failed",
        reason: "delivery_failed", provider_message_id: null,
        recipient_version: contactEmailVersion(account), created_at: createdAt,
      });
      return { event_id: eventId, status: "failed" };
    }
  }

  async suppress_community_email_delivery(input = {}) {
    const eventId = String(input.event_id || "").trim();
    const reasonCode = String(input.reason_code || "").trim();
    const source = String(input.source || "").trim();
    const smtpStatus = normalizePermanentSmtpStatus(input.smtp_status);
    if (!eventId || eventId.length > 200) throw new AuthError("invalid_delivery_event", "Delivery event is invalid.", 400);
    if (!COMMUNITY_EMAIL_SUPPRESSION_REASONS.includes(reasonCode)) throw new AuthError("invalid_suppression_reason", "Suppression reason is invalid.", 400);
    if (!COMMUNITY_EMAIL_SUPPRESSION_SOURCES.includes(source)) throw new AuthError("invalid_suppression_source", "Suppression source is invalid.", 400);
    const delivery = await this.repository.findNotificationDelivery(eventId);
    if (!delivery || delivery.status !== "sent") throw new AuthError("delivery_event_not_suppressible", "Delivery event is not suppressible.", 409);
    const account = await this.repository.findUserById(delivery.user_id);
    if (!account || !delivery.recipient_version || delivery.recipient_version !== contactEmailVersion(account)) {
      throw new AuthError("delivery_recipient_changed", "Delivery recipient is no longer current.", 409);
    }
    const suppression = createCommunityEmailSuppression(account, { reasonCode, source, smtpStatus }, this.clock());
    await this.repository.updateUserAccount(account.id, { community_email_suppression: suppression });
    return { event_id: eventId, user_id: account.id, suppression: publicCommunityEmailSuppression(suppression) };
  }

  async purge_community_notification_deliveries(input = {}) {
    if (!this.repository.purgeNotificationDeliveries) return { terminal: 0, failed: 0, total: 0 };
    return this.repository.purgeNotificationDeliveries({
      terminalBefore: requiredIsoTimestamp(input.terminal_before, "terminal_before"),
      failedBefore: requiredIsoTimestamp(input.failed_before, "failed_before"),
    });
  }

  async purge_expired_authentication_records(input = {}) {
    if (!this.repository.purgeExpiredAuthenticationRecords) {
      return { verification_tokens: 0, password_reset_tokens: 0, support_recoveries: 0, total: 0 };
    }
    return this.repository.purgeExpiredAuthenticationRecords({
      tokenBefore: requiredIsoTimestamp(input.token_before, "token_before"),
      supportRecoveryBefore: requiredIsoTimestamp(input.support_recovery_before, "support_recovery_before"),
    });
  }

  async update_subscription_plan(userId, plan, options = {}) {
    const subscriptionPlan = normalizeSubscriptionPlan(plan, "");
    if (!subscriptionPlan) throw new AuthError("invalid_subscription_plan", "Subscription plan is not supported.", 400);
    const current = await this.repository.findUserById(userId);
    if (!current) throw new AuthError("account_not_found", "Account does not exist.", 404);
    const hasValidity = Object.hasOwn(options, "plan_valid_until") || Object.hasOwn(options, "planValidUntil");
    const planValidUntil = subscriptionPlan === "free"
      ? null
      : hasValidity
        ? optionalTimestamp(options.plan_valid_until ?? options.planValidUntil, "plan_valid_until")
        : current.plan_valid_until || null;
    const account = await this.repository.updateUserAccount(userId, {
      subscription_plan: subscriptionPlan,
      plan_valid_until: planValidUntil,
    });
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    return toPublicAccount(account, this.clock());
  }

  async record_meaningful_activity(userId) {
    const account = await this.repository.findUserById(userId);
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    const activityAt = this.clock().toISOString();
    const previous = Date.parse(account.last_meaningful_activity_at || "");
    if (Number.isFinite(previous) && previous >= Date.parse(activityAt)) return toPublicAccount(account, this.clock());
    return toPublicAccount(await this.repository.updateUserAccount(userId, {
      last_meaningful_activity_at: activityAt,
    }), this.clock());
  }

  async transition_account_lifecycle(userId, transition) {
    const account = await this.repository.findUserById(userId);
    if (!account) throw new AuthError("account_not_found", "Account does not exist.", 404);
    const patch = lifecycleTransitionPatch(account, transition, this.clock());
    return toPublicAccount(await this.repository.updateUserAccount(userId, patch), this.clock());
  }

  async get_passkey_login_candidate_by_credential_id(credentialId, rpId = "") {
    const credential = await this.repository.findPasskeyCredentialById(credentialId);
    const account = credential ? await this.repository.findUserById(credential.user_id) : null;
    const candidate = await this.assertPasskeyLoginCandidate(account, rpId);
    if (!candidate.passkey_credentials.some((item) => item.credential_id === credential?.credential_id)) throw new AuthError("passkey_wrong_relying_party", "Passkey belongs to another relying party.", 401);
    return { ...candidate, selected_passkey: credential };
  }

  async assertPasskeyLoginCandidate(account, rpId = "") {
    assertAccountCanLogin(account);
    const credentials = await this.repository.listPasskeyCredentials(account.id);
    const matching = rpId ? credentials.filter((item) => item.rp_id === String(rpId).toLowerCase()) : credentials;
    if (!matching.length) throw new AuthError(rpId ? "passkey_not_registered_for_site" : "passkey_not_configured", "No matching passkey is configured for this account and relying party.", 409);
    return { ...account, passkey_credentials: matching };
  }

  async login_passkey(username, counter) {
    const account = await this.get_passkey_login_candidate(username);
    return this.login_passkey_account(account, counter);
  }

  async login_passkey_by_credential_id(credentialId, counter, rpId = "") {
    const account = await this.get_passkey_login_candidate_by_credential_id(credentialId, rpId);
    return this.login_passkey_account(account, counter, credentialId);
  }

  async login_passkey_account(account, counter, credentialId = account.selected_passkey?.credential_id || account.passkey_credential_id) {
    await this.repository.updatePasskeyCredentialCounter(credentialId, counter);
    const updated = await this.repository.updateUserAccount(account.id, { passkey_counter: Number(counter || 0), passkey_credential_id: credentialId });
    return this.createInteractiveSessionResponse(updated);
  }

  async list_passkeys(userId) {
    return (await this.repository.listPasskeyCredentials(userId)).map((item) => ({ credential_id: item.credential_id, rp_id: item.rp_id, label: item.label, transports: item.transports, created_at: item.created_at, updated_at: item.updated_at }));
  }

  async add_passkey(userId, passkey) {
    const account = await this.repository.findUserById(userId);
    assertAccountCanLogin(account);
    const credential = await this.repository.createPasskeyCredential({ userId, credentialId: passkey.credentialId, publicKey: passkey.publicKey, counter: passkey.counter, transports: passkey.transports, rpId: passkey.rpId, label: passkey.label });
    await this.repository.updateUserAccount(userId, { passkey_credential_id: credential.credential_id, passkey_public_key: credential.public_key, passkey_counter: credential.counter, passkey_transports: credential.transports, passkey_rp_id: credential.rp_id });
    return { passkeys: await this.list_passkeys(userId) };
  }

  async upgrade_guest_to_base(userId, username, password, accepted_terms, passkey_credential_id, offline_recovery_set_confirmed, offline_recovery_set) {
    assertTermsAccepted(accepted_terms);
    assertPseudonymousRegistrationInput(username, password);
    const account = await this.repository.findUserById(userId);
    if (!account || account.account_type !== "guest") throw new AuthError("guest_account_required", "A valid guest account is required.", 400);
    if (isGuestExpired(account)) throw new AuthError("guest_expired", "The guest account has expired.", 410);
    if (!String(passkey_credential_id || "").trim()) throw new AuthError("passkey_required", "A passkey registration is required.", 400);
    const offlineRecoverySet = String(offline_recovery_set || "").trim();
    if (offline_recovery_set_confirmed === true && !offlineRecoverySet) throw new AuthError("offline_recovery_set_required", "A selected offline recovery set must be generated.", 400);
    try {
      const upgraded = await this.repository.updateUserAccount(account.id, {
        username: username.trim(), account_type: "base", guest_expires_at: null,
          passkey_credential_id: String(passkey_credential_id).trim(),
          offline_recovery_set_confirmed_at: offline_recovery_set_confirmed === true ? new Date().toISOString() : null,
          offline_recovery_set_hash: offline_recovery_set_confirmed === true ? this.passwordHasher.hash(offlineRecoverySet) : null,
      });
      await this.repository.createLocalCredential({ userId: account.id, passwordHash: this.passwordHasher.hash(password) });
      return { account: toPublicAccount(upgraded, this.clock()) };
    } catch (error) {
      if (error.message === "USERNAME_ALREADY_EXISTS") throw new AuthError("username_already_exists", "Username is already in use.", 409);
      throw error;
    }
  }

  async add_esp32_recovery_token(userId, board_id) {
    const account = await this.repository.findUserById(userId);
    if (!account || !["base", "esp32"].includes(account.account_type)) throw new AuthError("base_account_required", "A base account is required.", 400);
    const boardId = String(board_id || "").trim();
    if (!boardId) throw new AuthError("invalid_board_id", "A board id is required.", 400);
    const boardIds = Array.from(new Set([...(account.recovery_board_ids || []), boardId]));
    if (boardIds.length > 3) throw new AuthError("recovery_board_limit", "At most three recovery boards are allowed.", 409);
    return { account: toPublicAccount(await this.repository.updateUserAccount(account.id, { account_type: "esp32", recovery_board_ids: boardIds }), this.clock()) };
  }

  async remove_esp32_recovery_token(userId, board_id) {
    const account = await this.repository.findUserById(userId);
    if (!account || account.account_type !== "esp32") throw new AuthError("esp32_account_required", "An ESP32 account is required.", 400);
    const boardIds = (account.recovery_board_ids || []).filter((id) => id !== String(board_id || "").trim());
    return { account: toPublicAccount(await this.repository.updateUserAccount(account.id, { account_type: boardIds.length ? "esp32" : "base", recovery_board_ids: boardIds }), this.clock()) };
  }

  async create_offline_recovery_set(userId) {
    const account = await this.repository.findUserById(userId);
    if (!account || !["base", "esp32"].includes(account.account_type)) throw new AuthError("base_account_required", "A base account is required.", 400);
    const recoverySet = formatOfflineRecoverySet(crypto.randomBytes(24).toString("base64url"));
    const updated = await this.repository.updateUserAccount(account.id, {
      offline_recovery_set_confirmed_at: new Date().toISOString(),
      offline_recovery_set_hash: this.passwordHasher.hash(recoverySet),
    });
    return { account: toPublicAccount(updated, this.clock()), recovery_set: recoverySet };
  }

  async start_offline_recovery(username, recoverySet) {
    const account = await this.repository.findUserByUsername(username);
    const suppliedRecoverySet = String(recoverySet || "").trim();
    if (!account || !["base", "esp32"].includes(account.account_type) || !account.offline_recovery_set_hash || !this.passwordHasher.verify(suppliedRecoverySet, account.offline_recovery_set_hash)) {
      throw new AuthError("invalid_recovery_set", "Recovery set is invalid.", 401);
    }
    const recovery = this.tokenService.createTokenRecord({ userId: account.id, ttlMinutes: 10 });
    await this.repository.createOfflineRecoveryTransaction(recovery.record);
    return { recovery_token: recovery.rawToken, username: account.username };
  }

  async get_offline_recovery_account(token) {
    const record = await this.readValidOfflineRecoveryTransaction(token);
    const account = await this.repository.findUserById(record.user_id);
    assertAccountCanLogin(account);
    return account;
  }

  async complete_offline_recovery(token, passkey) {
    const record = await this.readValidOfflineRecoveryTransaction(token);
    if (!passkey?.credentialId || !passkey?.publicKey) throw new AuthError("passkey_required", "A verified passkey is required.", 400);
    const account = await this.repository.findUserById(record.user_id);
    if (!account) throw new AuthError("invalid_recovery_token", "Recovery token is invalid or expired.", 401);
    assertAccountCanLogin(account);
    const credential = await this.repository.createPasskeyCredential({
      userId: account.id, credentialId: passkey.credentialId, publicKey: passkey.publicKey,
      counter: passkey.counter, transports: passkey.transports, rpId: passkey.rpId || "legacy-unknown", label: "Wiederhergestellter Passkey",
    });
    await this.repository.revokePasskeyCredentialsByUserId(account.id, "offline_recovery_replaced", credential.credential_id);
    const updated = await this.repository.updateUserAccount(account.id, {
      passkey_credential_id: String(passkey.credentialId).trim(),
      passkey_public_key: String(passkey.publicKey).trim(),
      passkey_counter: Number(passkey.counter || 0),
      passkey_transports: passkey.transports || [],
      passkey_rp_id: passkey.rpId || "legacy-unknown",
    });
    await this.repository.markOfflineRecoveryTransactionUsed(record.id);
    await this.repository.revokeSessionsByUserId(account.id);
    return this.createSessionResponse(updated);
  }

  async start_support_recovery({ username, email, supportActorId, supportActorRole, reason, actionId }) {
    const account = await this.repository.findUserByUsername(username);
    assertAccountCanLogin(account);
    assertSupportRecoveryInput({ email, supportActorId, supportActorRole, reason, actionId });
    const since = new Date(this.clock().getTime() - 24 * 60 * 60 * 1000).toISOString();
    const temporaryPassword = createTemporaryPassword();
    const expiresAt = new Date(this.clock().getTime() + 15 * 60 * 1000).toISOString();
    let transaction;
    try {
      transaction = await this.repository.replaceActiveSupportRecovery({
        userId: account.id, passwordHash: this.passwordHasher.hash(temporaryPassword), expiresAt,
        supportActorId, supportActorRole, reason: String(reason).trim(), actionId,
      }, { sinceIso: since, maximum: 3 });
    } catch (error) {
      if (error.message === "SUPPORT_RECOVERY_RATE_LIMITED") throw new AuthError("support_recovery_rate_limited", "Too many support recovery requests.", 429);
      if (error.message === "SUPPORT_RECOVERY_ALREADY_ACTIVE") throw new AuthError("support_recovery_already_active", "A support recovery request is already active.", 409);
      throw error;
    }
    try {
      await this.emailService.send_support_temporary_password_email(String(email).trim(), account.username, temporaryPassword, expiresAt);
      const completed = await this.repository.updateSupportRecoveryTransaction(transaction.id, { delivery_status: "accepted", email_deleted_at: this.clock().toISOString() });
      return { recovery_id: completed.id, account_id: account.id, username: account.username, expires_at: expiresAt, delivery_status: "accepted", email_deleted: true, action_id: actionId };
    } catch (error) {
      await this.repository.updateSupportRecoveryTransaction(transaction.id, { delivery_status: "failed", email_deleted_at: this.clock().toISOString(), revoked_at: this.clock().toISOString(), revoked_reason: "delivery_failed" });
      throw new AuthError("support_recovery_email_failed", "Temporary password could not be delivered.", 503);
    }
  }

  async login_support_recovery(username, temporaryPassword) {
    const account = await this.repository.findUserByUsername(username);
    assertAccountCanLogin(account);
    const transaction = await this.repository.findActiveSupportRecoveryByUserId(account.id);
    if (!transaction) throw new AuthError("support_recovery_invalid", "Support recovery password is invalid or expired.", 401);
    const attempted = await this.repository.incrementSupportRecoveryAttempts(transaction.id);
    const attempts = Number(attempted?.attempts || 0);
    if (!attempted || attempts > 5 || !safeVerifyPassword(this.passwordHasher, temporaryPassword, attempted.password_hash)) {
      if (attempted && attempts >= 5) await this.repository.updateSupportRecoveryTransaction(transaction.id, { revoked_at: this.clock().toISOString(), revoked_reason: "attempt_limit" });
      throw new AuthError("support_recovery_invalid", "Support recovery password is invalid or expired.", 401);
    }
    const grant = this.tokenService.createTokenRecord({ userId: account.id, ttlMinutes: 10 });
    const consumed = await this.repository.consumeSupportRecoveryTransaction(transaction.id, { attempts, used_at: this.clock().toISOString(), grant_token_hash: grant.record.token_hash, grant_expires_at: grant.record.expires_at });
    if (!consumed) throw new AuthError("support_recovery_invalid", "Support recovery password is invalid or expired.", 401);
    await this.repository.revokeSessionsByUserId(account.id);
    return { support_recovery_token: grant.rawToken, expires_at: grant.record.expires_at, username: account.username, recovery_required: true };
  }

  async get_support_recovery_account(token) {
    const tokenHash = this.tokenService.hashToken(token);
    const transaction = await this.repository.findSupportRecoveryByGrantHash(tokenHash);
    if (!transaction || !transaction.used_at || transaction.completed_at || transaction.revoked_at || new Date(transaction.grant_expires_at).getTime() <= this.clock().getTime()) {
      throw new AuthError("support_recovery_grant_invalid", "Support recovery grant is invalid or expired.", 401);
    }
    const account = await this.repository.findUserById(transaction.user_id);
    assertAccountCanLogin(account);
    return { account, transaction };
  }

  async complete_support_recovery(token, passkey) {
    const { account, transaction } = await this.get_support_recovery_account(token);
    if (!passkey?.credentialId || !passkey?.publicKey || !passkey?.rpId) throw new AuthError("passkey_required", "A verified canonical passkey is required.", 400);
    const credential = await this.repository.createPasskeyCredential({ userId: account.id, credentialId: passkey.credentialId, publicKey: passkey.publicKey, counter: passkey.counter, transports: passkey.transports, rpId: passkey.rpId, label: "Support-Recovery-Passkey" });
    await this.repository.revokePasskeyCredentialsByUserId(account.id, "support_recovery_replaced", credential.credential_id);
    const updated = await this.repository.updateUserAccount(account.id, { passkey_credential_id: credential.credential_id, passkey_public_key: credential.public_key, passkey_counter: credential.counter, passkey_transports: credential.transports, passkey_rp_id: credential.rp_id });
    await this.repository.updateSupportRecoveryTransaction(transaction.id, { completed_at: this.clock().toISOString(), grant_token_hash: null });
    await this.repository.revokeSessionsByUserId(account.id);
    return this.createSessionResponse(updated);
  }

  async login_local(identifier, password) {
    const account = await findAccountByIdentifier(this.repository, identifier);
    if (!account) {
      throw new AuthError("invalid_credentials", "Invalid username/email or password.", 401);
    }

    const credential = await this.repository.findLocalCredentialByUserId(account.id);
    if (!credential || !this.passwordHasher.verify(password, credential.password_hash)) {
      throw new AuthError("invalid_credentials", "Invalid username/email or password.", 401);
    }

    assertAccountCanLogin(account);
    return this.createInteractiveSessionResponse(account);
  }

  async login_external(providerName, providerTokenOrMockPayload) {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new AuthError("unsupported_provider", `Unsupported provider '${providerName}'.`, 400);
    }

    const providerIdentity = await provider.authenticate(providerTokenOrMockPayload);
    const existingIdentity = await this.repository.findExternalIdentity(
      providerIdentity.provider,
      providerIdentity.provider_user_id,
    );

    if (existingIdentity) {
      await this.repository.touchExternalIdentity(existingIdentity.id);
      const existingAccount = await this.repository.findUserById(existingIdentity.user_id);
      assertAccountCanLogin(existingAccount);
      return this.createInteractiveSessionResponse(existingAccount);
    }

    const username = await this.suggestUniqueUsername(providerIdentity);
    let account;
    try {
      account = await this.repository.createUserAccount({
        username,
        email: providerIdentity.email,
        status: providerIdentity.email_verified
          ? USER_STATUS.VERIFIED
          : USER_STATUS.PENDING_VERIFICATION,
        emailVerifiedAt: providerIdentity.email_verified ? this.clock().toISOString() : null,
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

    await this.repository.createExternalIdentity({
      userId: account.id,
      provider: providerIdentity.provider,
      providerUserId: providerIdentity.provider_user_id,
      providerEmail: providerIdentity.email,
    });

    if (!providerIdentity.email_verified) {
      const verification = await this.createVerificationToken(account.id);
      await this.emailService.send_verification_email(
        account.email,
        `${this.appBaseUrl}/verify-email?token=${encodeURIComponent(verification.rawToken)}`,
      );
    }

    if (account.status !== USER_STATUS.VERIFIED) {
      return {
        account: toPublicAccount(account, this.clock()),
        session: null,
        requires_email_verification: true,
      };
    }

    return this.createInteractiveSessionResponse(account);
  }

  async logout(sessionIdOrToken) {
    const session =
      await this.repository.findSessionById(sessionIdOrToken) ||
      await this.repository.findSessionByTokenHash(this.tokenService.hashToken(sessionIdOrToken));

    if (!session || session.revoked_at) {
      return { logged_out: true };
    }

    await this.repository.revokeSession(session.id);
    return { logged_out: true };
  }

  async resolve_session_token(rawToken) {
    const session = await this.repository.findSessionByTokenHash(this.tokenService.hashToken(rawToken));
    if (!session || session.revoked_at || session.status === "pending" || isExpired(session.expires_at)) return null;
    const account = await this.repository.findUserById(session.user_id);
    if (!account || account.status !== USER_STATUS.VERIFIED || isGuestExpired(account)) return null;
    return {
      account: toPublicAccount(account, this.clock()),
      session: {
        id: session.id,
        user_id: session.user_id,
        expires_at: session.expires_at,
      },
    };
  }

  async describe_session_token(rawToken) {
    const session = await this.repository.findSessionByTokenHash(this.tokenService.hashToken(rawToken));
    if (!session) return null;
    return {
      status: session.revoked_at ? "revoked" : session.status || "active",
      reason: session.revoked_reason || null,
      expires_at: session.expires_at,
    };
  }

  async complete_session_takeover(pendingLoginToken) {
    const session = await this.repository.activatePendingSessionByTokenHash(
      this.tokenService.hashToken(pendingLoginToken),
    );
    if (!session) throw new AuthError("invalid_pending_login", "Pending login is invalid or expired.", 401);
    const account = await this.repository.findUserById(session.user_id);
    assertAccountCanLogin(account);
    return {
      account: toPublicAccount(account, this.clock()),
      session: { id: session.id, user_id: session.user_id, token: pendingLoginToken, expires_at: session.expires_at },
      replaced_session: true,
    };
  }

  async cancel_session_takeover(pendingLoginToken) {
    const session = await this.repository.cancelPendingSessionByTokenHash(
      this.tokenService.hashToken(pendingLoginToken),
    );
    if (!session) throw new AuthError("invalid_pending_login", "Pending login is invalid or expired.", 401);
    return { cancelled: true };
  }

  async secure_account_from_pending_login(pendingLoginToken) {
    const session = await this.repository.secureAccountByPendingTokenHash(
      this.tokenService.hashToken(pendingLoginToken),
    );
    if (!session) throw new AuthError("invalid_pending_login", "Pending login is invalid or expired.", 401);
    const account = await this.repository.findUserById(session.user_id);
    assertAccountCanLogin(account);
    return {
      secured: true,
      recovery_required: false,
      account: toPublicAccount(account, this.clock()),
      session: { id: session.id, user_id: session.user_id, token: pendingLoginToken, expires_at: session.expires_at },
      revoked_sessions: session.revoked_sessions,
    };
  }

  async request_password_reset(email) {
    const account = await this.repository.findUserByEmail(email);
    if (!account || !isVerifiedContact(account)) {
      return neutralPasswordResetResponse();
    }

    const credential = await this.repository.findLocalCredentialByUserId(account.id);
    if (!credential) {
      return neutralPasswordResetResponse();
    }

    const reset = this.tokenService.createTokenRecord({ userId: account.id, ttlMinutes: 30 });
    await this.repository.createPasswordResetToken(reset.record);
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
    const tokenRecord = await this.repository.findPasswordResetTokenByHash(tokenHash);
    if (!tokenRecord || tokenRecord.used_at || isExpired(tokenRecord.expires_at)) {
      throw new AuthError("invalid_token", "Password reset token is invalid or expired.", 400);
    }

    const account = await this.repository.findUserById(tokenRecord.user_id);
    if (!account) {
      throw new AuthError("invalid_token", "Password reset token is invalid or expired.", 400);
    }

    const credential = await this.repository.findLocalCredentialByUserId(account.id);
    if (!credential) {
      throw new AuthError("local_credential_missing", "No local credential exists for this account.", 400);
    }

    await this.repository.updateLocalCredential(account.id, {
      password_hash: this.passwordHasher.hash(newPassword),
    });
    await this.repository.markPasswordResetTokenUsed(tokenRecord.id);

    return { password_changed: true };
  }

  async createVerificationToken(userId) {
    const verification = this.tokenService.createTokenRecord({ userId, ttlMinutes: 24 * 60 });
    const record = await this.repository.createVerificationToken(verification.record);
    return { rawToken: verification.rawToken, record };
  }

  async readValidVerificationToken(token) {
    const tokenHash = this.tokenService.hashToken(token);
    const tokenRecord = await this.repository.findVerificationTokenByHash(tokenHash);
    if (!tokenRecord || tokenRecord.used_at || isExpired(tokenRecord.expires_at)) {
      throw new AuthError("invalid_token", "Verification token is invalid or expired.", 400);
    }
    return tokenRecord;
  }

  async readValidOfflineRecoveryTransaction(token) {
    const tokenHash = this.tokenService.hashToken(token);
    const tokenRecord = await this.repository.findOfflineRecoveryTransactionByHash(tokenHash);
    if (!tokenRecord || tokenRecord.used_at || isExpired(tokenRecord.expires_at)) {
      throw new AuthError("invalid_recovery_token", "Recovery token is invalid or expired.", 401);
    }
    return tokenRecord;
  }

  async createSessionResponse(account) {
    const activityAt = this.clock().toISOString();
    account = await this.repository.updateUserAccount(account.id, {
      last_meaningful_activity_at: activityAt,
    });
    const rawToken = this.tokenService.createRawToken();
    const now = this.clock().getTime();
    const expiresAt = new Date(now + 12 * 60 * 60 * 1000).toISOString();
    const session = await this.repository.createSession({
      userId: account.id,
      tokenHash: this.tokenService.hashToken(rawToken),
      expiresAt,
    });

    return {
      account: toPublicAccount(account, this.clock()),
      session: {
        id: session.id,
        user_id: session.user_id,
        token: rawToken,
        expires_at: session.expires_at,
      },
    };
  }

  async createInteractiveSessionResponse(account) {
    const activityAt = this.clock().toISOString();
    account = await this.repository.updateUserAccount(account.id, {
      last_meaningful_activity_at: activityAt,
    });
    const rawToken = this.tokenService.createRawToken();
    const now = this.clock().getTime();
    const expiresAt = new Date(now + 12 * 60 * 60 * 1000).toISOString();
    const pendingExpiresAt = new Date(now + 5 * 60 * 1000).toISOString();
    const session = await this.repository.createLoginSession({
      userId: account.id,
      tokenHash: this.tokenService.hashToken(rawToken),
      expiresAt,
      pendingExpiresAt,
    });
    if (session.status === "pending") {
      return {
        account: toPublicAccount(account, this.clock()),
        requires_session_takeover: true,
        pending_login_token: rawToken,
        pending_login_expires_at: session.pending_expires_at,
      };
    }
    return {
      account: toPublicAccount(account, this.clock()),
      session: { id: session.id, user_id: session.user_id, token: rawToken, expires_at: session.expires_at },
    };
  }

  async suggestUniqueUsername(providerIdentity) {
    const preferred = providerIdentity.username || String(providerIdentity.email).split("@")[0];
    const base = sanitizeUsername(preferred || providerIdentity.provider_user_id || "user");
    let candidate = base;
    let suffix = 2;
    while (await this.repository.usernameExists(candidate)) {
      candidate = `${base}${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async suggestGuestUsername() {
    let candidate = `guest_${this.tokenService.createRawToken().replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase()}`;
    while (await this.repository.usernameExists(candidate)) candidate = `${candidate}x`;
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

function assertPseudonymousRegistrationInput(username, password) {
  assertPseudonymousUsername(username);
  if (!password || String(password).length < 12) throw new AuthError("invalid_password", "Password must contain at least 12 characters.", 400);
}

function assertPseudonymousUsername(username) {
  if (!username || String(username).trim().length < 3) throw new AuthError("invalid_username", "Username must contain at least 3 characters.", 400);
}

function assertSupportRecoveryInput({ email, supportActorId, supportActorRole, reason, actionId }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim()) || String(email).length > 254) throw new AuthError("invalid_support_recovery_email", "A valid temporary delivery address is required.", 400);
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(String(supportActorId || ""))) throw new AuthError("invalid_support_actor", "Support actor is invalid.", 400);
  if (!['administrator', 'support'].includes(String(supportActorRole || ""))) throw new AuthError("invalid_support_actor", "Support role is invalid.", 403);
  if (!SUPPORT_RECOVERY_VERIFICATION_REASONS.has(String(reason || "").trim())) throw new AuthError("support_recovery_reason_required", "An approved verification method is required.", 400);
  if (!/^[0-9a-f-]{36}$/i.test(String(actionId || ""))) throw new AuthError("support_recovery_action_id_required", "A valid action id is required.", 400);
}

function createTemporaryPassword() {
  return `${crypto.randomBytes(8).toString("base64url")}-${crypto.randomBytes(8).toString("base64url")}`;
}

function safeVerifyPassword(passwordHasher, password, storedHash) {
  try { return passwordHasher.verify(String(password || ""), storedHash); } catch { return false; }
}

function assertTermsAccepted(acceptedTerms) {
  if (acceptedTerms !== true) {
    throw new AuthError("terms_not_accepted", "Terms of use must be accepted.", 400);
  }
}

async function findAccountByIdentifier(repository, identifier) {
  const value = String(identifier || "").trim();
  return value.includes("@")
    ? repository.findUserByEmail(value)
    : repository.findUserByUsername(value);
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
  if (isGuestExpired(account)) throw new AuthError("guest_expired", "The guest account has expired.", 410);
}

function isGuestExpired(account) {
  return account?.account_type === "guest" && account.guest_expires_at && isExpired(account.guest_expires_at);
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

function toPublicAccount(account, now = new Date()) {
  return {
    user_id: account.id,
    username: account.username,
    status: account.status,
    created_at: account.created_at,
    updated_at: account.updated_at,
    account_type: account.account_type || "email_account",
    preferred_locale: normalizePreferredLocale(account.preferred_locale),
    subscription_plan: account.subscription_plan
      ? normalizeSubscriptionPlan(account.subscription_plan)
      : undefined,
    effective_subscription_plan: effectiveSubscriptionPlan(account, now),
    plan_valid_until: account.plan_valid_until || null,
    last_meaningful_activity_at: account.last_meaningful_activity_at || account.created_at,
    lifecycle_state: normalizeLifecycleState(account.lifecycle_state),
    lifecycle_state_changed_at: account.lifecycle_state_changed_at || account.created_at,
    grace_until: account.grace_until || null,
    cold_archive_at: account.cold_archive_at || null,
    delete_after: account.delete_after || null,
    offline_recovery_set_configured: Boolean(account.offline_recovery_set_confirmed_at && account.offline_recovery_set_hash),
    recovery_board_count: (account.recovery_board_ids || []).length,
    contact_email_status: account.pending_email ? "verification_pending" : isVerifiedContact(account) ? "verified" : "not_configured",
  };
}

function contactNotificationSettings(account) {
  return {
    email: account.email || null,
    pending_email: account.pending_email || null,
    status: account.pending_email ? "verification_pending" : isVerifiedContact(account) ? "verified" : "not_configured",
    notification_preferences: normalizeNotificationPreferences(account.notification_preferences),
    community_email_suppression: publicCommunityEmailSuppression(activeCommunityEmailSuppression(account)),
  };
}

const COMMUNITY_EMAIL_SUPPRESSION_REASONS = [
  "mailbox_not_found", "domain_not_found", "recipient_rejected", "mailbox_disabled",
  "policy_rejection", "permanent_delivery_failure",
];
const COMMUNITY_EMAIL_SUPPRESSION_SOURCES = ["delivery_status_notification", "operator"];

function contactEmailVersion(account) {
  if (!isVerifiedContact(account)) return "";
  return account.email_contact_version || account.email_verified_at || `legacy:${account.created_at || account.id}`;
}

function activeCommunityEmailSuppression(account) {
  const suppression = account?.community_email_suppression;
  return suppression?.active === true && suppression.recipient_version === contactEmailVersion(account) ? suppression : null;
}

function createCommunityEmailSuppression(account, input, clock) {
  return {
    active: true,
    reason_code: input.reasonCode,
    source: input.source,
    smtp_status: normalizePermanentSmtpStatus(input.smtpStatus),
    recipient_version: contactEmailVersion(account),
    suppressed_at: clock.toISOString(),
  };
}

function publicCommunityEmailSuppression(suppression) {
  if (!suppression) return { active: false };
  return {
    active: true,
    reason_code: suppression.reason_code,
    source: suppression.source,
    smtp_status: suppression.smtp_status,
    suppressed_at: suppression.suppressed_at,
  };
}

function normalizePermanentSmtpStatus(value) {
  const status = String(value || "").trim();
  if (!/^5(?:\d{2}|\.\d{1,3}\.\d{1,3})$/.test(status)) {
    throw new AuthError("invalid_permanent_smtp_status", "A permanent SMTP status is required.", 400);
  }
  return status;
}

function isVerifiedContact(account) {
  return Boolean(account?.email && (account.email_verified_at || account.status === USER_STATUS.VERIFIED));
}

function normalizeContactEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("invalid_email", "A valid email address is required.", 400);
  }
  return email;
}

function requiredIsoTimestamp(value, field) {
  const timestamp = String(value || "").trim();
  if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) {
    throw new AuthError(`invalid_${field}`, `${field} must be a valid timestamp.`, 400);
  }
  return new Date(timestamp).toISOString();
}

function normalizeNotificationPreferences(value) {
  let source = value;
  if (typeof source === "string") {
    try { source = JSON.parse(source); } catch { source = {}; }
  }
  return Object.fromEntries(COMMUNITY_NOTIFICATION_KEYS.map((key) => [key, source?.[key] === true]));
}

function defaultNotificationPreferences() {
  return normalizeNotificationPreferences({});
}

function normalizePreferredLocale(value, fallback = "de") {
  const locale = String(value || "").trim().toLowerCase().split(/[-_]/)[0];
  return ["de", "en", "nl"].includes(locale) ? locale : fallback;
}

function formatOfflineRecoverySet(value) {
  return String(value).match(/.{1,4}/g).join("-");
}

module.exports = {
  AuthService,
  ACCOUNT_LIFECYCLE_STATE,
  USER_STATUS,
};
