"use strict";

const runtimePreviewAdapters = new Map();

function registerRuntimePreviewAdapter(type, adapter) {
  if (typeof type !== "string" || !type || typeof adapter?.open !== "function") {
    throw new TypeError("A runtime preview adapter must register { type, open }");
  }
  if (runtimePreviewAdapters.has(type)) {
    throw new Error(`Duplicate runtime preview adapter: ${type}`);
  }
  runtimePreviewAdapters.set(type, Object.freeze({ ...adapter }));
}

function runtimePreviewAdapterFor(stepItem) {
  return runtimePreviewAdapters.get(stepItem?.runtimePreview?.type) || null;
}

function runtimePreviewAdapterForLesson(lessonItem) {
  const previewStep = lessonItem?.steps?.find((stepItem) => runtimePreviewAdapterFor(stepItem));
  return previewStep ? runtimePreviewAdapterFor(previewStep) : null;
}
