const GerNetiXAiChatPattern = (() => {
  let initialized = false;

  function init(root = document) {
    if (initialized) return;
    initialized = true;
    root.addEventListener("keydown", handleKeydown);
    root.addEventListener("input", handleInput);
    root.addEventListener("submit", handleSubmit);
  }

  function handleKeydown(event) {
    const input = event.target.closest?.("[data-ai-chat-input]");
    if (!input) return;
    const composingText = event.isComposing || event.keyCode === 229;
    if (event.key !== "Enter" || event.shiftKey || composingText) return;
    event.preventDefault();
    input.form?.requestSubmit();
  }

  function handleInput(event) {
    const input = event.target.closest?.("[data-ai-chat-input]");
    if (input) resizeInput(input);
  }

  function handleSubmit(event) {
    if (!event.target.matches?.("[data-ai-chat-form]")) return;
    // A standard chat must never fall back to the browser's native form
    // navigation, even if its domain controller failed to initialize.
    event.preventDefault();
    queueMicrotask(() => {
      const input = event.target.querySelector("[data-ai-chat-input]");
      if (input) resizeInput(input);
    });
  }

  function resizeInput(input) {
    input.style.height = "auto";
    const maximum = Number.parseFloat(getComputedStyle(input).maxHeight);
    input.style.height = `${Math.min(input.scrollHeight, Number.isFinite(maximum) ? maximum : input.scrollHeight)}px`;
  }

  return { init, resizeInput };
})();

GerNetiXAiChatPattern.init();
