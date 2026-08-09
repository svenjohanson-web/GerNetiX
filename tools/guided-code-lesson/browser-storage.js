"use strict";

function applyStoredLessonEdits() {
  for (const lessonItem of lessons) {
    const raw = localStorage.getItem(storageKey(lessonItem.slug));
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw);
      for (const stepItem of lessonItem.steps) {
        const stored = payload.steps?.[stepItem.id];
        if (!stored) continue;
        stepItem.title = stored.title ?? stepItem.title;
        stepItem.text = stored.text ?? stepItem.text;
        stepItem.outcome = stored.outcome ?? stepItem.outcome;
        stepItem.media = stored.media || undefined;
      }
    } catch {
      localStorage.removeItem(storageKey(lessonItem.slug));
    }
  }
}

function persistRuntimeEdits() {
  const adapter = runtimePreviewAdapterForLesson(lesson);
  const payload = adapter?.serialize?.(lesson);
  if (payload) localStorage.setItem(runtimeStorageKey(lesson.slug), JSON.stringify(payload));
}

function applyStoredRuntimeEdits(lessonItem) {
  const raw = localStorage.getItem(runtimeStorageKey(lessonItem.slug));
  if (!raw) return;

  try {
    const payload = JSON.parse(raw);
    runtimePreviewAdapterForLesson(lessonItem)?.restore?.(lessonItem, payload);
  } catch {
    localStorage.removeItem(runtimeStorageKey(lessonItem.slug));
  }
}

function storageKey(slug) {
  return `gernetix.guided-code-lesson.${slug}.authoring`;
}

function runtimeStorageKey(slug) {
  return `gernetix.guided-code-lesson.${slug}.runtime`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
