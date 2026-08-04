const crypto = require("node:crypto");
const { PublicDemoError } = require("../errors");

class PostgresPublicDemoRepository {
  static async create(options = {}) {
    const { Pool } = require("pg");
    const repository = new PostgresPublicDemoRepository(options.pool || new Pool(options.poolOptions));
    await repository.migrate();
    return repository;
  }
  constructor(pool) { this.pool = pool; }
  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS public_demo_catalog (
        demo_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        board_hardware_item_id TEXT NOT NULL, category TEXT NOT NULL, games_json JSONB NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','published','revoked')),
        usb_flash_only BOOLEAN NOT NULL CHECK (usb_flash_only),
        ota_supported BOOLEAN NOT NULL CHECK (NOT ota_supported),
        created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, published_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS public_demo_releases (
        demo_id TEXT NOT NULL REFERENCES public_demo_catalog(demo_id) ON DELETE RESTRICT,
        version TEXT NOT NULL, firmware_file_name TEXT NOT NULL, firmware_blob BYTEA NOT NULL,
        firmware_size_bytes BIGINT NOT NULL, firmware_sha256 TEXT NOT NULL,
        source_build_sha256 TEXT, source_commit_sha TEXT, created_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (demo_id,version)
      );
      CREATE TABLE IF NOT EXISTS public_demo_release_assets (
        demo_id TEXT NOT NULL, version TEXT NOT NULL,
        asset_id TEXT NOT NULL CHECK (asset_id IN ('bootloader','partitions','otadata','firmware')),
        file_name TEXT NOT NULL, flash_offset INTEGER NOT NULL, content_blob BYTEA NOT NULL,
        size_bytes BIGINT NOT NULL, sha256 TEXT NOT NULL, PRIMARY KEY (demo_id,version,asset_id),
        FOREIGN KEY (demo_id,version) REFERENCES public_demo_releases(demo_id,version) ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS idx_public_demo_catalog_status ON public_demo_catalog(status,published_at DESC,demo_id);
    `);
    await this.pool.query("ALTER TABLE public_demo_releases ADD COLUMN IF NOT EXISTS source_commit_sha TEXT");
    const assetConstraint = (await this.pool.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid = 'public_demo_release_assets'::regclass AND conname = 'public_demo_release_assets_asset_id_check'`)).rows[0]?.definition || "";
    if (!assetConstraint.includes("otadata")) {
      await this.pool.query(`ALTER TABLE public_demo_release_assets DROP CONSTRAINT IF EXISTS public_demo_release_assets_asset_id_check;
        ALTER TABLE public_demo_release_assets ADD CONSTRAINT public_demo_release_assets_asset_id_check
        CHECK (asset_id IN ('bootloader','partitions','otadata','firmware'))`);
    }
  }
  async publish(input) {
    const demo = normalizeDemo(input);
    const assets = normalizeAssets(input);
    if (input.firmware_sha256 && input.firmware_sha256 !== assets.firmware.sha256) throw new PublicDemoError("firmware_checksum_mismatch", "Die angegebene Firmware-Prüfsumme stimmt nicht mit dem Release überein.");
    const client = await this.pool.connect();
    const now = new Date().toISOString();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO public_demo_catalog
        (demo_id,title,description,board_hardware_item_id,category,games_json,status,usb_flash_only,ota_supported,created_at,updated_at,published_at)
        VALUES ($1,$2,$3,$4,$5,$6,'published',TRUE,FALSE,$7,$7,$7)
        ON CONFLICT (demo_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,
        board_hardware_item_id=EXCLUDED.board_hardware_item_id,category=EXCLUDED.category,games_json=EXCLUDED.games_json,
        status='published',updated_at=EXCLUDED.updated_at,published_at=EXCLUDED.published_at`,
      [demo.demo_id,demo.title,demo.description,demo.board_hardware_item_id,demo.category,demo.games,now]);
      await client.query(`INSERT INTO public_demo_releases
        (demo_id,version,firmware_file_name,firmware_blob,firmware_size_bytes,firmware_sha256,source_build_sha256,source_commit_sha,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [demo.demo_id,demo.version,assets.firmware.file_name,assets.firmware.content,assets.firmware.size_bytes,assets.firmware.sha256,optionalString(input.source_build_sha256),optionalCommit(input.source_commit_sha),now]);
      for (const asset of Object.values(assets)) await client.query(`INSERT INTO public_demo_release_assets
        (demo_id,version,asset_id,file_name,flash_offset,content_blob,size_bytes,sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [demo.demo_id,demo.version,asset.asset_id,asset.file_name,asset.flash_offset,asset.content,asset.size_bytes,asset.sha256]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") throw new PublicDemoError("release_already_exists", "Diese Demo-Version ist bereits veröffentlicht und darf nicht überschrieben werden.", 409);
      throw error;
    } finally { client.release(); }
    return this.getPublicDemo(demo.demo_id);
  }
  async listPublicDemos() {
    const result = await this.pool.query(`SELECT demo_id,title,description,board_hardware_item_id,category,games_json,published_at::text AS published_at
      FROM public_demo_catalog WHERE status='published' ORDER BY published_at DESC,demo_id`);
    return result.rows.map(publicCatalogRow);
  }
  async getPublicDemo(demoId) {
    const item = (await this.pool.query(`SELECT demo_id,title,description,board_hardware_item_id,category,games_json,published_at::text AS published_at
      FROM public_demo_catalog WHERE demo_id=$1 AND status='published'`, [demoId])).rows[0];
    if (!item) throw new PublicDemoError("demo_not_found", "Die öffentliche Demo wurde nicht gefunden.", 404);
    const releases = (await this.pool.query(`SELECT version,firmware_file_name,firmware_size_bytes::bigint AS firmware_size_bytes,
      firmware_sha256,source_commit_sha,created_at::text AS created_at FROM public_demo_releases WHERE demo_id=$1 ORDER BY created_at DESC,version DESC`, [demoId])).rows;
    return {...publicCatalogRow(item),releases:releases.map((row)=>({...row,firmware_size_bytes:Number(row.firmware_size_bytes),
      firmware_download_url:`/api/public/demos/${encodeURIComponent(demoId)}/releases/${encodeURIComponent(row.version)}/firmware`}))};
  }
  getFirmware(demoId,version) { return this.getAsset(demoId,version,"firmware"); }
  async getFlashManifest(demoId,version) {
    await this.getPublicDemo(demoId);
    const assets=(await this.pool.query(`SELECT asset_id,file_name,flash_offset,size_bytes::bigint AS size_bytes,sha256
      FROM public_demo_release_assets WHERE demo_id=$1 AND version=$2 ORDER BY flash_offset`,[demoId,version])).rows;
    if(!hasRequiredAssets(assets)) throw new PublicDemoError("release_not_found","Der vollständige Flash-Release wurde nicht gefunden.",404);
    return {demo_id:demoId,version,chip:"esp32s3",flash_mode:"dio",flash_freq:"80m",flash_size:"16MB",
      assets:assets.map((a)=>({...a,size_bytes:Number(a.size_bytes),download_url:`/api/public/demos/${encodeURIComponent(demoId)}/releases/${encodeURIComponent(version)}/assets/${a.asset_id}`}))};
  }
  async getAsset(demoId,version,assetId) {
    const row=(await this.pool.query(`SELECT a.file_name AS firmware_file_name,a.content_blob AS firmware_blob,
      a.size_bytes::bigint AS firmware_size_bytes,a.sha256 AS firmware_sha256 FROM public_demo_release_assets a
      JOIN public_demo_catalog c ON c.demo_id=a.demo_id WHERE a.demo_id=$1 AND a.version=$2 AND a.asset_id=$3 AND c.status='published'`,
    [demoId,version,assetId])).rows[0];
    if(!row) throw new PublicDemoError("release_not_found","Der öffentliche Demo-Release wurde nicht gefunden.",404);
    return {...row,firmware_size_bytes:Number(row.firmware_size_bytes)};
  }
  async close(){await this.pool.end();}
}
function normalizeDemo(input){const fields=["demo_id","title","description","board_hardware_item_id","category","version","firmware_file_name"];
  const demo=Object.fromEntries(fields.map((f)=>[f,requiredString(input[f],f)]));
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(demo.demo_id)) throw new PublicDemoError("invalid_demo_id","demo_id ist ungültig.");
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(demo.version)) throw new PublicDemoError("invalid_release_version","version ist ungültig.");
  if(demo.firmware_file_name!=="firmware.bin") throw new PublicDemoError("invalid_firmware_file","Öffentliche Demo-Releases dürfen nur firmware.bin enthalten.");
  demo.games=Array.isArray(input.games)?input.games.map((g)=>requiredString(g,"games[]")):[];return demo;}
function normalizeAssets(input){
  const defs={bootloader:{file_name:"bootloader.bin",flash_offset:0},partitions:{file_name:"partitions.bin",flash_offset:0x8000},otadata:{file_name:"ota_data_initial.bin",flash_offset:0xf000},firmware:{file_name:"firmware.bin",flash_offset:0x10000}};
  const supplied=Array.isArray(input.flash_assets)?input.flash_assets:["bootloader","partitions","firmware"].map((asset_id)=>({asset_id,base64:input[`${asset_id}_base64`]}));
  const assets={};
  for(const item of supplied){
    const id=String(item?.asset_id||"");const definition=defs[id];
    if(!definition||assets[id]) throw new PublicDemoError("flash_asset_invalid","Flash-Asset ist unbekannt oder doppelt vorhanden.");
    const content=Buffer.from(item.base64||"","base64");
    const flash_offset=item.flash_offset===undefined?definition.flash_offset:Number(item.flash_offset);
    if(!content.length||content.length>16*1024*1024||!Number.isInteger(flash_offset)||flash_offset<0||flash_offset>=16*1024*1024) throw new PublicDemoError("flash_asset_invalid",`${id} fehlt, ist zu groß oder hat einen ungültigen Offset.`);
    assets[id]={asset_id:id,file_name:definition.file_name,flash_offset,content,size_bytes:content.length,sha256:crypto.createHash("sha256").update(content).digest("hex")};
  }
  if(!hasRequiredAssets(Object.values(assets))) throw new PublicDemoError("flash_asset_invalid","Bootloader, Partitionstabelle und Firmware müssen enthalten sein.");
  return assets;
}
function hasRequiredAssets(assets){const ids=new Set(assets.map((asset)=>asset.asset_id));return ids.has("bootloader")&&ids.has("partitions")&&ids.has("firmware");}
function requiredString(v,f){const n=String(v||"").trim();if(!n)throw new PublicDemoError("required_field_missing",`${f} muss angegeben werden.`);return n;}
function optionalString(v){return String(v||"").trim()||null;}
function optionalCommit(v){const value=optionalString(v);if(value&&!/^[0-9a-f]{40}$/.test(value))throw new PublicDemoError("invalid_source_commit","source_commit_sha muss ein vollständiger Git-Commit sein.");return value;}
function publicCatalogRow(r){return{demo_id:r.demo_id,title:r.title,description:r.description,board_hardware_item_id:r.board_hardware_item_id,
  category:r.category,games:typeof r.games_json==="string"?JSON.parse(r.games_json):r.games_json,usb_flash_only:true,ota_supported:false,published_at:r.published_at};}
module.exports={PostgresPublicDemoRepository};
