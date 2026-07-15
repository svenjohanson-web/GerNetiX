const webpush = require("web-push");
const { SqliteStateStore } = require("../../../shared");
function createWebPushService({ sqlitePath, publicKey = "", privateKey = "", subject = "", webPushClient = webpush }) {
  const store = new SqliteStateStore(sqlitePath, "identity-web-push", { defaultState: { subscriptions: [] } });
  const enabled = Boolean(publicKey && privateKey && subject);
  if (enabled) webPushClient.setVapidDetails(subject, publicKey, privateKey);
  function subscribe(accountId, subscription) { if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) throw new Error("Ungueltige Push-Anmeldung."); const items = store.load().subscriptions.filter((item) => item.endpoint !== subscription.endpoint); items.push({ account_id: accountId, endpoint: subscription.endpoint, keys: subscription.keys, created_at: new Date().toISOString() }); store.save({ subscriptions: items }); }
  async function notifyAccount(accountId, payload) { return notifyAccounts([accountId], payload); }
  async function notifyAccounts(accountIds, payload) {
    if (!enabled) return { enabled: false, delivered: 0 };
    const recipients = new Set((Array.isArray(accountIds) ? accountIds : []).map((accountId) => String(accountId || "").trim()).filter(Boolean));
    const items = store.load().subscriptions.filter((item) => recipients.has(item.account_id));
    const stale = new Set(); let delivered = 0;
    await Promise.all(items.map(async (item) => { try { await webPushClient.sendNotification({ endpoint: item.endpoint, keys: item.keys }, JSON.stringify(payload)); delivered += 1; } catch (error) { if ([404, 410].includes(error.statusCode)) stale.add(item.endpoint); } }));
    if (stale.size) store.save({ subscriptions: store.load().subscriptions.filter((item) => !stale.has(item.endpoint)) });
    return { enabled: true, delivered };
  }
  return { enabled, publicKey, subscribe, notifyAccount, notifyAccounts };
}
module.exports = { createWebPushService };
