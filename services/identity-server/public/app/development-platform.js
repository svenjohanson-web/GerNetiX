const DevelopmentPlatform = (() => {
  function create({ state, postJson, escapeHtml, meta }) {
    if (!state.developmentPlatform) {
      state.developmentPlatform = {
        assistant: null,
        chat: [],
      };
    }

    function init() {
      document.querySelector("#developmentChatForm").addEventListener("submit", sendChatMessage);
      document.querySelector("#clearDevelopmentChatButton").addEventListener("click", clearChat);
      document.querySelectorAll("[data-dev-prompt]").forEach((button) => {
        button.addEventListener("click", () => usePrompt(button.dataset.devPrompt));
      });
    }

    function setAssistantConfig(config) {
      state.developmentPlatform.assistant = config || null;
    }

    function render() {
      renderAssistantConfig();
      renderChatMessages();
    }

    function renderAssistantConfig() {
      const config = state.developmentPlatform.assistant || {};
      document.querySelector("#developmentAssistantConfig").innerHTML = [
        ["Status", config.enabled ? "aktiv" : "nicht konfiguriert"],
        ["Provider", providerLabel(config)],
        ["Endpoint", config.baseUrl || "http://127.0.0.1:11434"],
        ["Modell", config.model || "nicht gesetzt"],
        ["Datenquellen", (config.allowedSources || []).join(", ") || "nur Chat"],
      ].map(meta).join("");
    }

    function providerLabel(config = state.developmentPlatform.assistant || {}) {
      if (config.provider === "api" && config.apiProvider === "anthropic") return "Claude / Anthropic";
      if (config.provider === "api") return "OpenAI-kompatibel";
      if (config.provider === "ollama" || !config.provider) return "Lokales Ollama";
      return config.provider;
    }

    function renderChatMessages() {
      const messages = state.developmentPlatform.chat.length ? state.developmentPlatform.chat : [{
        role: "assistant",
        content: "Beschreibe kurz deine Projektidee. Ich frage dann gezielt nach Ziel, Zielsystemen, Geraeten, Daten, Bedienung, Speicherung und Zugriff, bevor wir Technologien festlegen.",
      }];
      document.querySelector("#developmentChatMessages").innerHTML = messages.map((message) => `
        <article class="chat-message ${escapeHtml(message.role)}">
          <span>${message.role === "user" ? "Du" : "Architektur-KI"}</span>
          <p>${escapeHtml(message.content)}</p>
          ${message.usage ? `<dl class="chat-usage">${usageRows(message.usage).map(([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `).join("")}</dl>` : ""}
        </article>
      `).join("");
      const messageList = document.querySelector("#developmentChatMessages");
      messageList.scrollTop = messageList.scrollHeight;
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
      document.querySelector("#developmentChatInput").value = prompt || "";
      document.querySelector("#developmentChatInput").focus();
    }

    function clearChat() {
      state.developmentPlatform.chat = [];
      setChatStatus("Bereit fuer Architekturfragen.");
      renderChatMessages();
    }

    async function sendChatMessage(event) {
      event.preventDefault();
      const input = document.querySelector("#developmentChatInput");
      const submit = document.querySelector("#developmentChatSubmit");
      const content = input.value.trim();
      if (!content) return;
      state.developmentPlatform.chat.push({ role: "user", content });
      input.value = "";
      submit.disabled = true;
      setChatStatus(`${providerLabel()} denkt...`);
      renderChatMessages();
      try {
        const response = await postJson("/api/platform/development-assistant/chat", {
          messages: state.developmentPlatform.chat,
        });
        setAssistantConfig(response.config || state.developmentPlatform.assistant);
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: response.message?.content || "Keine Antwort erhalten.",
          usage: response.usage || null,
        });
        setChatStatus(response.usedFallback
          ? `Fallback-Antwort: ${providerLabel(response.config)} nicht erreichbar oder nicht konfiguriert.`
          : `Antwort von ${providerLabel(response.config)} erhalten.`);
      } catch (error) {
        state.developmentPlatform.chat.push({
          role: "assistant",
          content: `Ich konnte den Architektur-Assistenten nicht erreichen: ${error.message}`,
        });
        setChatStatus("Fehler beim LLM-Aufruf.");
      } finally {
        submit.disabled = false;
        render();
      }
    }

    function setChatStatus(text) {
      document.querySelector("#developmentChatStatus").textContent = text;
    }

    return {
      init,
      render,
      setAssistantConfig,
    };
  }

  return { create };
})();
