"use strict";

function wirePanelButtons() {
  sidePanel.querySelectorAll("select[data-action=\"select-welcome-project\"]").forEach((select) => {
    select.addEventListener("change", () => selectLesson(select.value, true));
  });

  sidePanel.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (action === "back") {
        goBack();
      }

      if (action === "next") {
        goNext();
      }

      if (action === "start-lesson") {
        isWelcomeVisible = false;
        render();
      }

      if (action === "save-step") {
        saveCurrentStepEdits();
      }

      if (action === "select-decision") {
        selectDecisionOption(button.dataset.field, button.dataset.value);
      }

      if (action === "apply-validation") {
        renderPanel();
      }

      if (action === "run-runtime-preview") {
        if (!getValidationState(currentStep()).canContinue) return;
        runtimePreviewAdapterFor(currentStep())?.open({ lesson, step: currentStep() });
      }

      if (action === "restart") {
        currentStepIndex = 0;
        navigationHistory = [];
        isComplete = false;
        isWelcomeVisible = true;
        localStorage.removeItem(runtimeStorageKey(lesson.slug));
        resetLessonRuntimeState(lesson);
        codeLines = lesson.source.replace(/\n$/, "").split("\n");
        render();
      }
    });
  });
}

function wireAuthoringInputs(stepItem) {
  sidePanel.querySelectorAll(".authoring-box [data-field]").forEach((field) => {
    if (field.type === "file") return;

    field.addEventListener("input", () => {
      if (field.dataset.field === "title") {
        stepItem.title = field.value;
      }

      if (field.dataset.field === "text") {
        stepItem.text = field.value;
      }

      if (field.dataset.field === "outcome") {
        stepItem.outcome = field.value;
      }

      if (field.dataset.field === "imageSrc" || field.dataset.field === "imageAlt") {
        const imageSrc = sidePanel.querySelector('[data-field="imageSrc"]')?.value.trim() || "";
        const imageAlt = sidePanel.querySelector('[data-field="imageAlt"]')?.value.trim() || "";
        stepItem.media = imageSrc ? { imageSrc, imageAlt } : undefined;
      }
    });
  });
}

function selectDecisionOption(field, value) {
  if (!field) return;
  lesson.learnerProfile = {
    ...(lesson.learnerProfile || {}),
    [field]: value,
  };
  render();
}

function goBack() {
  if (!isComplete && currentStepIndex === 0 && navigationHistory.length === 0) {
    isWelcomeVisible = true;
    render();
    return;
  }

  if (isComplete) {
    isComplete = false;
    render();
    return;
  }

  currentStepIndex = navigationHistory.length > 0
    ? navigationHistory.pop()
    : Math.max(0, currentStepIndex - 1);
  render();
}

function goNext() {
  if (!getValidationState(currentStep()).canContinue) {
    return;
  }

  const nextStepIndex = resolveNextStepIndex(currentStep());

  if (nextStepIndex === null) {
    isComplete = true;
  } else {
    navigationHistory.push(currentStepIndex);
    currentStepIndex = nextStepIndex;
  }

  render();
}

function resolveNextStepIndex(stepItem) {
  const result = resolveCompletionResult(stepItem);
  const decisionNextStepId = stepItem.decision?.options?.find((option) => option.key === result)?.nextStepId;
  const nextStepId = decisionNextStepId || stepItem.completion?.nextStepId || stepItem.nextStepId;

  if (nextStepId) {
    const foundIndex = lesson.steps.findIndex((item) => item.id === nextStepId);
    if (foundIndex >= 0) return foundIndex;
  }

  if (currentStepIndex === lesson.steps.length - 1) {
    return null;
  }

  return currentStepIndex + 1;
}

function resolveCompletionResult(stepItem) {
  const source = stepItem.completion?.resultSource;
  return source ? lesson.learnerProfile?.[source] || "" : "";
}

function handleLineKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
  }
}

function handlePaste(event) {
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain").replace(/[\r\n]+/g, " ");
  document.execCommand("insertText", false, text);
}

function handleLineInput(event) {
  const lineNumber = Number(event.currentTarget.dataset.line);
  const allowed = isComplete || currentStep().editableLines.includes(lineNumber);

  if (!allowed) {
    event.currentTarget.textContent = codeLines[lineNumber - 1] || " ";
    return;
  }

  codeLines[lineNumber - 1] = event.currentTarget.textContent.replace(/\u00a0/g, " ");
  renderPanel();
}



function toggleEditMode() {
  isEditMode = !isEditMode;
  editModeButton.classList.toggle("active", isEditMode);
  editModeButton.textContent = isEditMode ? "Vorschau" : "Bearbeiten";
  render();
}

function saveCurrentStepEdits() {
  const stepItem = currentStep();
  const title = sidePanel.querySelector('[data-field="title"]')?.value ?? stepItem.title;
  const text = sidePanel.querySelector('[data-field="text"]')?.value ?? stepItem.text;
  const outcome = sidePanel.querySelector('[data-field="outcome"]')?.value ?? stepItem.outcome;
  const imageSrc = sidePanel.querySelector('[data-field="imageSrc"]')?.value.trim() || "";
  const imageAlt = sidePanel.querySelector('[data-field="imageAlt"]')?.value.trim() || "";
  const file = sidePanel.querySelector('[data-field="imageFile"]')?.files?.[0];

  const apply = (finalImageSrc) => {
    stepItem.title = title;
    stepItem.text = text;
    stepItem.outcome = outcome;
    stepItem.media = finalImageSrc ? { imageSrc: finalImageSrc, imageAlt } : undefined;
    persistLessonEdits();
    render();
  };

  if (!file) {
    apply(imageSrc);
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => apply(String(reader.result || "")));
  reader.readAsDataURL(file);
}

function persistLessonEdits() {
  const payload = {
    steps: Object.fromEntries(lesson.steps.map((stepItem) => [
      stepItem.id,
      {
        title: stepItem.title,
        text: stepItem.text,
        outcome: stepItem.outcome,
        media: stepItem.media || null,
      },
    ])),
  };
  localStorage.setItem(storageKey(lesson.slug), JSON.stringify(payload));
}
