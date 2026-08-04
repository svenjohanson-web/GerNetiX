const dns = require("node:dns/promises");
const net = require("node:net");
const { RecoveryToolError } = require("../errors");

class HardwareSourceReader {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl || fetch;
    this.lookup = options.lookup || dns.lookup;
    this.maxSourceBytes = Number(options.maxSourceBytes || 2 * 1024 * 1024);
    this.maxTextCharacters = Number(options.maxTextCharacters || 120000);
    this.timeoutMs = Number(options.timeoutMs || 12000);
    this.maxRedirects = Number(options.maxRedirects || 3);
  }

  async readAll(sourceUrls) {
    const sources = [];
    for (const sourceUrl of sourceUrls) sources.push(await this.read(sourceUrl));
    return sources;
  }

  async read(sourceUrl) {
    let current = validatePublicUrl(sourceUrl);
    for (let redirectCount = 0; redirectCount <= this.maxRedirects; redirectCount += 1) {
      await assertPublicHost(current, this.lookup);
      const response = await this.fetchWithTimeout(current);
      if (isRedirect(response.status)) {
        if (redirectCount === this.maxRedirects) {
          throw new RecoveryToolError("hardware_source_redirect_limit", "Hardware-Quelle leitet zu oft weiter.", 422);
        }
        const location = response.headers.get("location");
        if (!location) throw new RecoveryToolError("hardware_source_redirect_missing", "Hardware-Quelle meldet eine Weiterleitung ohne Ziel.", 422);
        current = validatePublicUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) {
        throw new RecoveryToolError("hardware_source_fetch_failed", `Hardware-Quelle antwortet mit HTTP ${response.status}.`, 422, {
          source_url: sourceUrl,
          final_url: current.toString(),
        });
      }
      const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        throw new RecoveryToolError("hardware_source_content_type_rejected", `Nicht unterstuetzter Quellentyp: ${contentType || "unbekannt"}.`, 415);
      }
      const bytes = await readBoundedBody(response, this.maxSourceBytes);
      if (contentType === "application/pdf") {
        return {
          source_url: sourceUrl,
          final_url: current.toString(),
          content_type: contentType,
          kind: "pdf",
          file_name: safeFileName(current.pathname, "hardware-datasheet.pdf"),
          byte_length: bytes.length,
          file_data_base64: bytes.toString("base64"),
        };
      }
      const rawText = bytes.toString("utf8");
      const text = contentType.includes("html") ? extractReadableHtml(rawText) : normalizeText(rawText);
      return {
        source_url: sourceUrl,
        final_url: current.toString(),
        content_type: contentType,
        kind: "text",
        byte_length: bytes.length,
        text: text.slice(0, this.maxTextCharacters),
        truncated: text.length > this.maxTextCharacters,
      };
    }
    throw new RecoveryToolError("hardware_source_fetch_failed", "Hardware-Quelle konnte nicht gelesen werden.", 422);
  }

  async fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9",
          "User-Agent": "GerNetiX-Hardware-Lab/1.0",
        },
      });
    } catch (error) {
      if (error.name === "AbortError") throw new RecoveryToolError("hardware_source_timeout", "Hardware-Quelle hat das Zeitlimit ueberschritten.", 504);
      throw new RecoveryToolError("hardware_source_fetch_failed", "Hardware-Quelle konnte nicht geladen werden.", 422, { reason: error.message });
    } finally {
      clearTimeout(timer);
    }
  }
}

const ALLOWED_CONTENT_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain", "application/pdf"]);

function validatePublicUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch {
    throw new RecoveryToolError("invalid_hardware_source_url", "Hardware-Quelle ist keine gueltige URL.", 400);
  }
  if (!["https:", "http:"].includes(url.protocol)) throw new RecoveryToolError("invalid_hardware_source_protocol", "Hardware-Quellen muessen HTTP oder HTTPS verwenden.", 400);
  if (url.username || url.password) throw new RecoveryToolError("hardware_source_credentials_rejected", "Hardware-Quellen duerfen keine Zugangsdaten in der URL enthalten.", 400);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new RecoveryToolError("private_hardware_source_rejected", "Lokale oder private Hardware-Quellen sind nicht erlaubt.", 400);
  }
  return url;
}

async function assertPublicHost(url, lookup) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalVersion = net.isIP(hostname);
  const addresses = literalVersion ? [{ address: hostname, family: literalVersion }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicIp(address))) {
    throw new RecoveryToolError("private_hardware_source_rejected", "Hardware-Quelle verweist auf eine lokale, private oder reservierte Adresse.", 400);
  }
}

function isPublicIp(address) {
  if (net.isIPv4(address)) return isPublicIpv4(address);
  if (!net.isIPv6(address)) return false;
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
  if (/^fe[89ab]/.test(normalized)) return false;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPublicIpv4(mapped[1]) : true;
}

function isPublicIpv4(address) {
  const [a, b] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && [0, 168].includes(b)) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

async function readBoundedBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new RecoveryToolError("hardware_source_too_large", "Hardware-Quelle ist groesser als erlaubt.", 413);
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new RecoveryToolError("hardware_source_too_large", "Hardware-Quelle ist groesser als erlaubt.", 413);
    return buffer;
  }
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new RecoveryToolError("hardware_source_too_large", "Hardware-Quelle ist groesser als erlaubt.", 413);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, length);
}

function extractReadableHtml(html) {
  return normalizeText(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'"));
}

function normalizeText(value) {
  return String(value || "").replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

function safeFileName(pathname, fallback) {
  const candidate = decodeURIComponent(String(pathname || "").split("/").pop() || fallback).replace(/[^A-Za-z0-9._-]+/g, "-");
  return candidate.toLowerCase().endsWith(".pdf") ? candidate : fallback;
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

module.exports = { HardwareSourceReader, extractReadableHtml, isPublicIp, validatePublicUrl };
