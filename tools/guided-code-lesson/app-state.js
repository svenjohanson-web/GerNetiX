"use strict";

const { createDefaultWelcome } = window.GuidedLessonPattern;
const lessons = window.LearningProjectRegistry.createAll();


let lesson = lessons[0];
let currentStepIndex = 0;
let navigationHistory = [];
let isComplete = false;
let isWelcomeVisible = true;
let codeLines = [];
let isEditMode = false;

const lessonShell = document.querySelector(".lesson-shell");
const editor = document.querySelector("#editor");
const sidePanel = document.querySelector("#sidePanel");
const fileName = document.querySelector("#fileName");
const editorMode = document.querySelector("#editorMode");
const lineRuleBadge = document.querySelector("#lineRuleBadge");
const projectSelector = document.querySelector("#projectSelector");
const editModeButton = document.querySelector("#editModeButton");
const publishToServerButton = document.querySelector("#publishToServerButton");
