import { validateTroubleshootingAssistantProposal } from "./troubleshooting-assistant-contract.mjs";

export const TROUBLESHOOTING_ASSISTANT_ENDPOINT = "/api/platform/electronics-lab/assistant";

function messageFromPayload(payload, status) {
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message.trim();
  if (status === 401) return "Für die Live-KI musst du angemeldet sein.";
  if (status === 402) return "Für die Live-KI sind derzeit keine Credits verfügbar.";
  if (status === 429) return "Zu viele KI-Anfragen. Bitte warte kurz; das manuelle Labor bleibt verfügbar.";
  if (payload?.error === "electronics_lab_assistant_disabled") return "Die Live-KI ist vorübergehend ausgeschaltet; das manuelle Labor bleibt verfügbar.";
  return "Der Elektroniklabor-Assistent ist gerade nicht erreichbar.";
}

export function createLiveTroubleshootingAssistantClient({ fetchImpl = fetch } = {}) {
  return Object.freeze({
    mode: "live-session-credits",
    label: "KI-Assistent · Anmeldung und Credits erforderlich",
    async request(options) {
      let response;
      try {
        response = await fetchImpl(TROUBLESHOOTING_ASSISTANT_ENDPOINT, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: options?.scenario,
            snapshot: options?.snapshot,
            requestedAction: options?.requestedAction,
            message: typeof options?.message === "string" ? options.message.slice(0, 600) : "",
          }),
        });
      } catch {
        return Object.freeze({ ok: false, status: 0, message: "Der Elektroniklabor-Assistent ist gerade nicht erreichbar." });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 402 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ai-credit-purchase-required", { detail: payload.usagePreflight || null }));
        }
        return Object.freeze({
          ok: false,
          status: response.status,
          error: payload.error || "electronics_lab_assistant_unavailable",
          message: messageFromPayload(payload, response.status),
        });
      }

      const validation = validateTroubleshootingAssistantProposal(payload.proposal);
      if (!validation.ok) {
        return Object.freeze({
          ok: false,
          status: 502,
          error: "electronics_lab_assistant_contract_invalid",
          message: "Die Serverantwort verletzt den erlaubten Assistentenvertrag.",
        });
      }
      return Object.freeze({
        ok: true,
        mode: "live-session-credits",
        proposal: validation.proposal,
        usage: payload.usage || null,
      });
    },
  });
}
