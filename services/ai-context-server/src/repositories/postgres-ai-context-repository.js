const { Pool } = require("pg");
const { defaultArchitectureComponents, defaultPolicy, defaultPromptFoundations, defaultSources, isGrantActive } = require("./in-memory-ai-context-repository");

class PostgresAiContextRepository {
  constructor(options = {}) {
    this.pool = options.pool || new Pool(options.poolOptions);
    this.embeddingClient = options.embeddingClient;
    this.dimensions = Number(options.dimensions || 768);
  }

  static async create(options) {
    const repository = new PostgresAiContextRepository(options);
    await repository.initialize();
    return repository;
  }

  async initialize() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      for (const statement of postgresSchema(this.dimensions)) await client.query(statement);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await this.seedDefaults();
    await this.pool.query("CREATE INDEX IF NOT EXISTS ai_context_architecture_components_embedding_hnsw ON ai_context_architecture_components USING hnsw (embedding vector_cosine_ops)");
    await this.pool.query("CREATE INDEX IF NOT EXISTS ai_context_intent_examples_embedding_hnsw ON ai_context_intent_examples USING hnsw (embedding vector_cosine_ops)");
  }

  async seedDefaults() {
    for (const source of defaultSources()) await this.saveSource(source, { preserveExisting:true });
    for (const prompt of defaultPromptFoundations()) await this.savePromptFoundation(prompt, { preserveExisting:true });
    for (const component of defaultArchitectureComponents()) await this.saveArchitectureComponent(component, { preserveExisting:true });
    await this.savePolicy(defaultPolicy(), { preserveExisting:true });
  }

  async saveGrant(grant) {
    await this.pool.query(`INSERT INTO ai_context_grants
      (grant_id, account_id, project_id, source_type, purpose, valid_from, valid_until, revoked_at, created_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (grant_id) DO UPDATE SET account_id=EXCLUDED.account_id, project_id=EXCLUDED.project_id,
      source_type=EXCLUDED.source_type, purpose=EXCLUDED.purpose, valid_from=EXCLUDED.valid_from,
      valid_until=EXCLUDED.valid_until, revoked_at=EXCLUDED.revoked_at, created_at=EXCLUDED.created_at,
      raw_json=EXCLUDED.raw_json`,
    [grant.grant_id,grant.account_id,grant.project_id||null,grant.source_type,grant.purpose,grant.valid_from,grant.valid_until,grant.revoked_at||null,grant.created_at,grant]);
    return clone(grant);
  }

  async findGrant(grantId) { return one(await this.pool.query("SELECT raw_json FROM ai_context_grants WHERE grant_id=$1",[grantId])); }
  async listGrants(filter = {}) {
    const rows=(await this.pool.query("SELECT raw_json FROM ai_context_grants ORDER BY created_at NULLS LAST, grant_id")).rows.map(raw);
    return rows.filter((grant)=>matches(grant,filter,["account_id","source_type","purpose"])&&(!filter.status||filter.status!=="active"||isGrantActive(grant,new Date())));
  }
  async revokeGrant(grantId, revokedAt) { const grant=await this.findGrant(grantId);if(!grant)return null;return this.saveGrant({...grant,revoked_at:revokedAt}); }

  async savePolicy(policy, options = {}) {
    const conflict=options.preserveExisting?"DO NOTHING":"DO UPDATE SET raw_json=EXCLUDED.raw_json, updated_at=EXCLUDED.updated_at";
    await this.pool.query(`INSERT INTO ai_context_policy (policy_id,updated_at,raw_json) VALUES ($1,$2,$3) ON CONFLICT (policy_id) ${conflict}`,[policy.policy_id,policy.updated_at,policy]);
    return options.preserveExisting ? this.getPolicy() : clone(policy);
  }
  async getPolicy() { return one(await this.pool.query("SELECT raw_json FROM ai_context_policy WHERE policy_id='default'"))||defaultPolicy(); }

  async addAuditEvent(event) {
    await this.pool.query(`INSERT INTO ai_context_audit_events
      (audit_event_id,occurred_at,account_id,project_id,source_type,access_decision,raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (audit_event_id) DO NOTHING`,
    [event.audit_event_id,event.occurred_at,event.account_id||null,event.project_id||null,event.source_type||null,event.access_decision,event]);
    return clone(event);
  }
  async listAuditEvents(filter = {}) { const rows=(await this.pool.query("SELECT raw_json FROM ai_context_audit_events ORDER BY occurred_at DESC")).rows.map(raw);return rows.filter((item)=>matches(item,filter,["account_id","access_decision","source_type"])); }

  async saveSource(source, options = {}) {
    const conflict=options.preserveExisting?"DO NOTHING":"DO UPDATE SET source_type=EXCLUDED.source_type,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at,raw_json=EXCLUDED.raw_json";
    await this.pool.query(`INSERT INTO ai_context_sources (source_id,source_type,status,updated_at,raw_json) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (source_id) ${conflict}`,[source.source_id,source.source_type,source.status,source.updated_at,source]);
    return options.preserveExisting ? this.findById("ai_context_sources","source_id",source.source_id) : clone(source);
  }
  async listSources(filter = {}) { return this.listFiltered("ai_context_sources",filter,["source_type","status"]); }

  async savePromptFoundation(prompt, options = {}) {
    const conflict=options.preserveExisting?"DO NOTHING":"DO UPDATE SET route_task=EXCLUDED.route_task,content_kind=EXCLUDED.content_kind,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at,raw_json=EXCLUDED.raw_json";
    await this.pool.query(`INSERT INTO ai_context_prompt_foundations (foundation_id,route_task,content_kind,status,updated_at,raw_json) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (foundation_id) ${conflict}`,[prompt.foundation_id,prompt.route_task,prompt.content_kind,prompt.status,prompt.updated_at,prompt]);
    return options.preserveExisting ? this.findById("ai_context_prompt_foundations","foundation_id",prompt.foundation_id) : clone(prompt);
  }
  async listPromptFoundations(filter = {}) { return this.listFiltered("ai_context_prompt_foundations",filter,["route_task","content_kind","status"]); }

  async saveArchitectureComponent(component, options = {}) {
    let embedding=null;
    try { embedding=await this.embeddingClient?.embed(componentText(component)); } catch {}
    const conflict=options.preserveExisting?"DO NOTHING":"DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,search_text=EXCLUDED.search_text,embedding=COALESCE(EXCLUDED.embedding,ai_context_architecture_components.embedding),updated_at=EXCLUDED.updated_at,raw_json=EXCLUDED.raw_json";
    await this.pool.query(`INSERT INTO ai_context_architecture_components (component_id,name,status,search_text,embedding,updated_at,raw_json)
      VALUES ($1,$2,$3,$4,$5::vector,$6,$7) ON CONFLICT (component_id) ${conflict}`,
    [component.component_id,component.name,component.status,componentText(component),embedding?vectorSql(embedding):null,component.updated_at,component]);
    return options.preserveExisting ? this.findById("ai_context_architecture_components","component_id",component.component_id) : clone(component);
  }
  async listArchitectureComponents(filter = {}) { return this.listFiltered("ai_context_architecture_components",filter,["component_id","status"]); }

  async saveClarificationCase(item) {
    await this.pool.query(`INSERT INTO ai_context_clarification_cases
      (case_id,fingerprint,status,priority,priority_score,last_seen_at,updated_at,raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (case_id) DO UPDATE SET fingerprint=EXCLUDED.fingerprint,status=EXCLUDED.status,
      priority=EXCLUDED.priority,priority_score=EXCLUDED.priority_score,last_seen_at=EXCLUDED.last_seen_at,
      updated_at=EXCLUDED.updated_at,raw_json=EXCLUDED.raw_json`,
    [item.case_id,item.fingerprint,item.status,item.priority,item.priority_score,item.last_seen_at,item.updated_at,item]);
    return clone(item);
  }
  async findClarificationCaseByFingerprint(fingerprint){return one(await this.pool.query("SELECT raw_json FROM ai_context_clarification_cases WHERE fingerprint=$1",[fingerprint]));}
  async findClarificationCase(caseId){return one(await this.pool.query("SELECT raw_json FROM ai_context_clarification_cases WHERE case_id=$1",[caseId]));}
  async listClarificationCases(filter={}){const items=await this.listFiltered("ai_context_clarification_cases",filter,["status","priority"]);return items.sort((a,b)=>Number(b.priority_score||0)-Number(a.priority_score||0)||String(b.last_seen_at).localeCompare(String(a.last_seen_at)));}

  async saveIntentExample(item) {
    let embedding=null;
    try { embedding=await this.embeddingClient?.embed(`${item.utterance} ${item.intent} ${item.entity||""}`); } catch {}
    await this.pool.query(`INSERT INTO ai_context_intent_examples
      (example_id,intent,entity,scope,account_id,status,embedding,updated_at,raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8,$9)
      ON CONFLICT (example_id) DO UPDATE SET intent=EXCLUDED.intent,entity=EXCLUDED.entity,scope=EXCLUDED.scope,
      account_id=EXCLUDED.account_id,status=EXCLUDED.status,embedding=COALESCE(EXCLUDED.embedding,ai_context_intent_examples.embedding),updated_at=EXCLUDED.updated_at,raw_json=EXCLUDED.raw_json`,
    [item.example_id,item.intent,item.entity||null,item.scope,item.account_id||null,item.status,embedding?vectorSql(embedding):null,item.updated_at,item]);
    return clone(item);
  }
  async listIntentExamples(filter={}){const items=await this.listFiltered("ai_context_intent_examples",filter,["status","intent"]);return items.filter((item)=>!filter.account_id||item.scope==="global"||item.account_id===filter.account_id);}
  async searchIntentExamples(query,limit=5,accountId=""){
    try{const embedding=await this.embeddingClient?.embed(query);if(embedding){const result=await this.pool.query(`SELECT raw_json, 1-(embedding <=> $1::vector) AS score FROM ai_context_intent_examples WHERE status='active' AND embedding IS NOT NULL AND (scope='global' OR account_id=$3) ORDER BY embedding <=> $1::vector LIMIT $2`,[vectorSql(embedding),limit,accountId||null]);return{strategy:"pgvector",items:result.rows.map((row)=>({...raw(row),semantic_score:Number(row.score)}))};}}catch{}
    return{strategy:"lexical_fallback",items:lexicalIntentSearch(query,await this.listIntentExamples({status:"active",account_id:accountId}),limit)};
  }

  async searchArchitectureComponents(query, limit = 5) {
    try {
      const embedding=await this.embeddingClient?.embed(query);
      if (embedding) {
        const result=await this.pool.query(`SELECT raw_json, 1-(embedding <=> $1::vector) AS score
          FROM ai_context_architecture_components WHERE status='active' AND embedding IS NOT NULL AND 1-(embedding <=> $1::vector) >= 0.35
          ORDER BY embedding <=> $1::vector LIMIT $2`,[vectorSql(embedding),limit]);
        if(result.rows.length)return {strategy:"pgvector",items:result.rows.map((row)=>({...raw(row),semantic_score:Number(row.score)}))};
      }
    } catch {}
    const items=lexicalSearch(query,await this.listArchitectureComponents({status:"active"}),limit);
    return {strategy:"lexical_fallback",items};
  }

  async summary() {
    const tables=[];
    for(const table of ["ai_context_policy","ai_context_sources","ai_context_prompt_foundations","ai_context_architecture_components","ai_context_clarification_cases","ai_context_intent_examples","ai_context_grants","ai_context_audit_events"]){
      const count=Number((await this.pool.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count);tables.push({table_name:table,row_count:count});
    }
    return {available:true,backend:"postgresql_pgvector",embedding_model:this.embeddingClient?.model||"",tables};
  }
  async sqliteSummary(){return this.summary();}

  async hasMigration(migrationId){return Boolean((await this.pool.query("SELECT 1 FROM ai_context_migrations WHERE migration_id=$1",[migrationId])).rowCount);}
  async markMigration(migrationId){await this.pool.query("INSERT INTO ai_context_migrations (migration_id) VALUES ($1) ON CONFLICT DO NOTHING",[migrationId]);}
  async importLegacy(repository) {
    for(const source of repository.listSources())await this.saveSource(source);
    for(const prompt of repository.listPromptFoundations())await this.savePromptFoundation(prompt);
    for(const component of repository.listArchitectureComponents())await this.saveArchitectureComponent(component);
    for(const grant of repository.listGrants())await this.saveGrant(grant);
    for(const event of repository.listAuditEvents())await this.addAuditEvent(event);
    for(const item of repository.listClarificationCases?.()||[])await this.saveClarificationCase(item);
    for(const item of repository.listIntentExamples?.()||[])await this.saveIntentExample(item);
    await this.savePolicy(repository.getPolicy());
  }

  async findById(table,column,id){return one(await this.pool.query(`SELECT raw_json FROM ${table} WHERE ${column}=$1`,[id]));}
  async listFiltered(table,filter,fields){const rows=(await this.pool.query(`SELECT raw_json FROM ${table}`)).rows.map(raw);return rows.filter((item)=>matches(item,filter,fields));}
  async close(){await this.pool.end();}
}

function postgresSchema(dimensions){return [
  `CREATE TABLE IF NOT EXISTS ai_context_policy (policy_id text PRIMARY KEY, updated_at timestamptz, raw_json jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_context_sources (source_id text PRIMARY KEY, source_type text NOT NULL, status text NOT NULL, updated_at timestamptz, raw_json jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_context_prompt_foundations (foundation_id text PRIMARY KEY, route_task text NOT NULL, content_kind text NOT NULL, status text NOT NULL, updated_at timestamptz, raw_json jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_context_architecture_components (component_id text PRIMARY KEY, name text NOT NULL, status text NOT NULL, search_text text NOT NULL, embedding vector(${dimensions}), updated_at timestamptz, raw_json jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_context_clarification_cases (case_id text PRIMARY KEY, fingerprint text NOT NULL UNIQUE, status text NOT NULL, priority text NOT NULL, priority_score integer NOT NULL, last_seen_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, raw_json jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_context_intent_examples (example_id text PRIMARY KEY, intent text NOT NULL, entity text, scope text NOT NULL, account_id text, status text NOT NULL, embedding vector(${dimensions}), updated_at timestamptz NOT NULL, raw_json jsonb NOT NULL)`,
  `ALTER TABLE ai_context_intent_examples ADD COLUMN IF NOT EXISTS account_id text`,
  `CREATE TABLE IF NOT EXISTS ai_context_grants (grant_id text PRIMARY KEY, account_id text NOT NULL, project_id text, source_type text NOT NULL, purpose text NOT NULL, valid_from timestamptz, valid_until timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL, raw_json jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_context_audit_events (audit_event_id text PRIMARY KEY, occurred_at timestamptz NOT NULL, account_id text, project_id text, source_type text, access_decision text NOT NULL, raw_json jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ai_context_migrations (migration_id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
];}
function raw(row){return clone(row.raw_json);}
function one(result){return result.rows[0]?raw(result.rows[0]):null;}
function clone(value){return value?JSON.parse(JSON.stringify(value)):null;}
function matches(item,filter,fields){return fields.every((field)=>!filter[field]||String(item[field])===String(filter[field]));}
function vectorSql(vector){return `[${vector.join(",")}]`;}
function componentText(component){return [component.name,...(component.aliases||[]),component.summary,...(component.properties||[]),...(component.provided_interfaces||[]),...(component.required_interfaces||[]),...(component.decision_hints||[])].filter(Boolean).join(" ");}
function normalize(value){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();}
function lexicalSearch(query,components,limit){const tokens=normalize(query).split(" ").filter((token)=>token.length>2);return components.map((item)=>{const corpus=normalize(componentText(item));const score=tokens.reduce((sum,token)=>sum+(corpus.includes(token)?1:0),0);return{...item,semantic_score:score};}).filter((item)=>item.semantic_score>0).sort((a,b)=>b.semantic_score-a.semantic_score).slice(0,limit);}
function lexicalIntentSearch(query,items,limit){const tokens=normalize(query).split(" ").filter((token)=>token.length>2);return items.map((item)=>{const corpus=normalize(`${item.utterance} ${item.intent} ${item.entity||""}`);const score=tokens.reduce((sum,token)=>sum+(corpus.includes(token)?1:0),0);return{...item,semantic_score:score};}).filter((item)=>item.semantic_score>0).sort((a,b)=>b.semantic_score-a.semantic_score).slice(0,limit);}

module.exports={PostgresAiContextRepository,componentText,lexicalSearch};
