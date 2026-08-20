/*
 * Erste Datei, die einen Bezug ausdruecklich einfuehrt statt ihn aus dem
 * globalen Namensraum aufzulesen.
 *
 * Der kurze Name kommt aus der Import Map im Dokumentkopf. Ohne sie muesste
 * hier "./api-client.js?v=20260820-esm-export-1" stehen -- mit Cache-Version,
 * die bei jeder Aenderung in jedem import nachzuziehen waere. Ein import ohne
 * Version wuerde eine zweite Kopie laden und das Modul doppelt anlegen.
 */
import { ApiClient } from "@app/api-client.js";

const HelpChatService = (() => {
  async function answer(question, history = []) {
    const text = String(question || "").trim();
    if (!text) throw new Error("Ask a question about GerNetiX, a device or a technical concept.");
    const response = await ApiClient.postJson("/api/platform/help-assistant/chat", {
      messages: [...history, { role: "user", content: text }].slice(-10),
    });
    return {
      ...response,
      relatedTopics: (response.relatedTopics || []).map((topic) => ({
        ...topic,
        title: HelpContent.findTopic(topic.topicId)?.title
          || KnowledgeContent.findTopic(topic.topicId)?.title
          || topic.title
          || topic.topicId,
      })),
    };
  }

  return { answer };
})();

/*
 * Uebergangsbruecke: information-view.js ist noch ein klassisches Skript und
 * liest HelpChatService global. Faellt dieser Leser weg oder wird er selbst
 * ein Modul, verschwindet auch diese Zeile.
 */
export { HelpChatService };
globalThis.HelpChatService = HelpChatService;
