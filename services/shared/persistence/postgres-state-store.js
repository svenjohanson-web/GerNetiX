const crypto = require("node:crypto");

class PostgresStateStore {
  static async create(options = {}) {
    if (!options.pool) throw new Error("PostgresStateStore benoetigt einen PostgreSQL-Pool.");
    const store = new PostgresStateStore(options.pool, options.namespace, options.defaultState, options);
    await store.initialize();
    return store;
  }
  constructor(pool, namespace, defaultState = {}, options = {}) {
    this.pool = pool;
    this.namespace = String(namespace || "").trim();
    this.defaultState = structuredClone(defaultState);
    this.current = structuredClone(defaultState);
    this.encryptionKey = parseKey(options.encryptionKey);
    if (!this.namespace) throw new Error("PostgresStateStore benoetigt einen Namespace.");
  }
  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS runtime_state_documents (
        namespace TEXT PRIMARY KEY,
        state_json JSONB,
        state_ciphertext TEXT,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.pool.query("ALTER TABLE runtime_state_documents ALTER COLUMN state_json DROP NOT NULL");
    const row = (await this.pool.query("SELECT state_json,state_ciphertext FROM runtime_state_documents WHERE namespace=$1", [this.namespace])).rows[0];
    const stored = row?.state_ciphertext ? decrypt(row.state_ciphertext, this.encryptionKey) : row?.state_json;
    this.current = row ? normalize(stored, this.defaultState) : structuredClone(this.defaultState);
  }
  load() { return structuredClone(this.current); }
  async save(value) {
    this.current = structuredClone(value);
    const ciphertext = this.encryptionKey ? encrypt(this.current, this.encryptionKey) : null;
    await this.pool.query(`
      INSERT INTO runtime_state_documents(namespace,state_json,state_ciphertext,updated_at) VALUES ($1,$2,$3,NOW())
      ON CONFLICT(namespace) DO UPDATE SET state_json=EXCLUDED.state_json,state_ciphertext=EXCLUDED.state_ciphertext,updated_at=EXCLUDED.updated_at
    `, [this.namespace, ciphertext ? null : this.current, ciphertext]);
    return this.load();
  }
  async close() { await this.pool.end(); }
}
function normalize(value,fallback){return value&&typeof value==="object"&&!Array.isArray(value)?value:structuredClone(fallback);}
function parseKey(value){if(!value)return null;const key=Buffer.from(String(value),"base64");if(key.length!==32)throw new Error("Runtime-State-Verschluesselung benoetigt einen Base64-kodierten 32-Byte-Schluessel.");return key;}
function encrypt(value,key){const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${body.toString("base64")}`;}
function decrypt(value,key){if(!key)throw new Error("Verschluesselter Runtime-State kann ohne Schluessel nicht gelesen werden.");const [iv,tag,body]=String(value).split(".");const decipher=crypto.createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64"));decipher.setAuthTag(Buffer.from(tag,"base64"));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,"base64")),decipher.final()]).toString("utf8"));}
module.exports={PostgresStateStore};
