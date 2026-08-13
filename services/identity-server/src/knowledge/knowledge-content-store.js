"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const defaultArticleRoot = path.resolve(__dirname, "articles");

const bookAccessByArticle = new Map(Object.entries({
  "from-problem-to-system": [],
  "development-processes-overview": [],
  "version-control-and-variants": [],
  "electrical-basics-and-component-protection": ["knowledge_book_electrical_engineering"],
  "digital-signals-data-and-protocols": ["knowledge_book_electrical_engineering"],
  "physical-limits": ["knowledge_book_electrical_engineering"],
  "sampling-rate": ["knowledge_book_electrical_engineering"],
  "embedded-safety": ["knowledge_book_electrical_engineering"],
  sensors: ["knowledge_book_electrical_engineering"],
  actuators: ["knowledge_book_electrical_engineering"],
  "hardware-landscape": ["knowledge_library"],
  "processor-overview": ["knowledge_library"],
  "microcontroller-basics": ["knowledge_library"],
  "esp32-gotchas": ["knowledge_library"],
  "bus-systems": ["knowledge_library"],
  "embedded-measurement-debugging": ["knowledge_library"],
  "software-basics-introduction": ["knowledge_book_software_systems"],
  "browser-pwa-mobile-app": ["knowledge_book_software_systems"],
  "yaml-basics": ["knowledge_book_software_systems"],
  "databases-and-storage": ["knowledge_book_software_systems"],
  "workers-and-queues": ["knowledge_book_software_systems"],
  "distributed-systems-introduction": ["knowledge_book_software_systems"],
  "software-basics": ["knowledge_book_software_systems"],
  "communication-basics": ["knowledge_book_software_systems"],
  "server-systems": ["knowledge_book_software_systems"],
  "local-servers": ["knowledge_book_software_systems"],
  "internet-vps": ["knowledge_book_software_systems"],
  "home-server-internet-security": ["knowledge_book_software_systems"],
  "cloud-services": ["knowledge_book_software_systems"],
  "choosing-servers": ["knowledge_book_software_systems"],
  "radio-technologies-understand": ["knowledge_library"],
  "ai-basics": ["knowledge_library"],
  "privacy-basics": ["knowledge_library"],
  "security-basics": ["knowledge_library"],
  "glossary-basics": [],
}));

function readArticleBundle(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const variableName = source.match(/const\s+(KnowledgeArticles\w+)\s*=/)?.[1];
  if (!variableName) throw new Error(`No knowledge article object found in ${filePath}`);
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source};this.articles=${variableName};`, context, { filename: filePath });
  return context.articles;
}

function loadKnowledgeArticles(articleRoot = defaultArticleRoot) {
  const articles = {};
  for (const file of fs.readdirSync(articleRoot).filter((name) => /^knowledge-articles-.*\.js$/.test(name)).sort()) {
    Object.assign(articles, readArticleBundle(path.join(articleRoot, file)));
  }
  return articles;
}

function createKnowledgeContentStore({ articleRoot = defaultArticleRoot } = {}) {
  const articles = loadKnowledgeArticles(articleRoot);

  function findArticle(articleId) {
    return articles[String(articleId || "")] || null;
  }

  function requiredEntitlements(articleId) {
    return bookAccessByArticle.get(String(articleId || "")) || null;
  }

  function responseFor(articleId, { authenticated = false, entitlements = [] } = {}) {
    const article = findArticle(articleId);
    const required = requiredEntitlements(articleId);
    if (!article || !required) return null;
    const granted = new Set(entitlements);
    const fullAccess = authenticated && required.every((entitlement) => granted.has(entitlement));
    const visibleArticle = JSON.parse(JSON.stringify({
      ...article,
      sections: fullAccess ? article.sections : article.sections.slice(0, 1),
    }));
    visibleArticle.sections.forEach((section) => section.quizzes?.forEach((quiz) => {
      delete quiz.answer;
      delete quiz.correctText;
      delete quiz.wrongText;
      delete quiz.explanation;
    }));
    return {
      access: fullAccess ? "full" : "preview",
      required_entitlements: [...required],
      article: visibleArticle,
    };
  }

  function evaluateQuiz(articleId, quizId, optionId) {
    const article = findArticle(articleId);
    const quiz = article?.sections.flatMap((section) => section.quizzes || []).find((entry) => entry.id === quizId);
    if (!quiz || !quiz.options?.some((option) => option.id === optionId)) return null;
    const correct = optionId === quiz.answer;
    return { correct, feedback: correct ? quiz.correctText : quiz.wrongText, explanation: quiz.explanation };
  }

  return { findArticle, requiredEntitlements, responseFor, evaluateQuiz };
}

module.exports = {
  bookAccessByArticle,
  createKnowledgeContentStore,
  loadKnowledgeArticles,
};
