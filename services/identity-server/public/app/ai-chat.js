const AiChat = (() => {
  function create({ state, postJson, escapeHtml, meta }) {
    if (!state.aiChat) {
      state.aiChat = {
        assistant: null,
        chat: [],
      };
    }

    function init() {
      document.querySelector("#aiChatForm")?.addEventListener("submit", sendChatMessage);
      document.querySelector("#clearAiChatButton")?.addEventListener("click", clearChat);
      document.querySelectorAll("[data-ai-prompt]").forEach((button) => {
        button.addEventListener("click", () => usePrompt(button.dataset.aiPrompt));
      });
    }

    function setAssistantConfig(config) {
      state.aiChat.assistant = config || null;
    }

    function render() {
      renderAssistantConfig();
      renderChatMessages();
    }

    function renderAssistantConfig() {
      const target = document.querySelector("#aiChatConfig");
      if (!target) return;
      const config = state.aiChat.assistant || {};
      target.innerHTML = [
        ["Status", config.enabled ? "aktiv" : "nicht konfiguriert"],
        ["Provider", providerLabel(config)],
        ["Endpoint", config.baseUrl || "http://127.0.0.1:11434"],
        ["Modell", config.model || "nicht gesetzt"],
        ["Datenquellen", (config.allowedSources || []).join(", ") || "nur Chat"],
      ].map(meta).join("");
    }

    function providerLabel(config = state.aiChat.assistant || {}) {
      if (config.provider === "api" && config.apiProvider === "anthropic") return "Claude / Anthropic";
      if (config.provider === "api") return "OpenAI-kompatibel";
      if (config.provider === "ollama" || !config.provider) return "Lokales Ollama";
      return config.provider;
    }

    function renderChatMessages() {
      const target = document.querySelector("#aiChatMessages");
      if (!target) return;
      const messages = state.aiChat.chat.length ? state.aiChat.chat : [{
        role: "assistant",
        content: "Hallo. Ich bin dein GerNetiX KI-Chat. Stelle mir eine Frage oder beschreibe, wobei ich helfen soll.",
      }];
      target.innerHTML = messages.map((message) => `
        <article class="chat-message ${escapeHtml(message.role)}">
          <span>${message.role === "user" ? "Du" : "KI-Chat"}</span>
          <p>${escapeHtml(message.content)}</p>
          ${message.usage ? `<dl class="chat-usage">${usageRows(message.usage).map(([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `).join("")}</dl>` : ""}
        </article>
      `).join("");
      target.scrollTop = target.scrollHeight;
    }

    function usageRows(usage) {
      return [
        ["Prompt", formatCount(usage.promptTokens, "Tokens")],
        ["Antwort", formatCount(usage.completionTokens, "Tokens")],
        ["Gesamt", formatCount(usage.totalTokens, "Tokens")],
        ["Dauer", formatDuration(usage.totalDurationMs)],
      ];
    }

    function formatCount(value, unit) {
      return Number.isFinite(value) ? `${value.toLocaleString("de-DE")} ${unit}` : "-";
    }

    function formatDuration(value) {
      if (!Number.isFinite(value)) return "-";
      if (value < 1000) return `${value.toLocaleString("de-DE")} ms`;
      return `${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
    }

    function usePrompt(prompt) {
      const input = document.querySelector("#aiChatInput");
      if (!input) return;
      input.value = prompt || "";
      input.focus();
    }

    function clearChat() {
      state.aiChat.chat = [];
      setChatStatus("Bereit.");
      renderChatMessages();
    }

    async function sendChatMessage(event) {
      event.preventDefault();
      const input = document.querySelector("#aiChatInput");
      const submit = document.querySelector("#aiChatSubmit");
      const content = input.value.trim();
      if (!content) return;
      state.aiChat.chat.push({ role: "user", content });
      input.value = "";
      submit.disabled = true;
      setChatStatus(`${providerLabel()} denkt...`);
      renderChatMessages();
      try {
        const response = await postJson("/api/platform/ai-chat/chat", {
          messages: state.aiChat.chat,
        });
        setAssistantConfig(response.config || state.aiChat.assistant);
        state.aiChat.chat.push({
          role: "assistant",
          content: response.message?.content || "Keine Antwort erhalten.",
          usage: response.usage || null,
        });
        setChatStatus(response.usedFallback
          ? `Fallback-Antwort: ${providerLabel(response.config)} nicht erreichbar oder nicht konfiguriert.`
          : `Antwort von ${providerLabel(response.config)} erhalten.`);
      } catch (error) {
        state.aiChat.chat.push({
          role: "assistant",
          content: `Ich konnte den KI-Chat nicht erreichen: ${error.message}`,
        });
        setChatStatus("Fehler beim LLM-Aufruf.");
      } finally {
        submit.disabled = false;
        render();
      }
    }

    function setChatStatus(text) {
      const status = document.querySelector("#aiChatStatus");
      if (status) status.textContent = text;
    }

    return {
      init,
      render,
      setAssistantConfig,
    };
  }

  return { create };
})();
