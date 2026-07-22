async function loadQuestion() {
  const target = document.querySelector("#publicCommunityQuestion");
  const questionId = window.location.pathname.split("/").filter(Boolean).at(-1);
  try {
    const [response, answerResponse] = await Promise.all([fetch(`/api/public/community/questions/${encodeURIComponent(questionId)}`), fetch(`/api/public/community/questions/${encodeURIComponent(questionId)}/answers`)]);
    const question = await response.json();
    const answers = await answerResponse.json();
    if (!response.ok) throw new Error(question.message || "Diese öffentliche Anfrage wurde nicht gefunden.");
    document.title = `${question.title} · GerNetiX Community`;
    const visibleAnswers = (answers.items || []).filter((answer) => answer.verification_state === "verified");
    target.innerHTML = `<p class="eyebrow">${escapeQuestion((question.tags || []).join(" · ") || "Community")}</p><h1>${escapeQuestion(question.title)}</h1><p class="lead">${escapeQuestion(question.body)}</p><p class="community-public-meta">${Number(question.answer_count || 0)} Antworten · ${escapeQuestion(question.status || "offen")}</p><section class="community-public-answers"><h2>Antworten</h2>${visibleAnswers.length ? visibleAnswers.map((answer) => `<article><strong>${escapeQuestion(answer.author_label)}</strong><p>${escapeQuestion(answer.body)}</p></article>`).join("") : `<p class="lead">Noch keine veröffentlichte Antwort.</p>`}</section><a class="primary-action" href="/app/auth/?next=%2Fapp%2Fcommunity%2F">Eigene Frage stellen →</a>`;
  } catch (error) { target.innerHTML = `<h1>Anfrage nicht verfügbar</h1><p class="lead">${escapeQuestion(error.message)}</p><a class="secondary-action" href="/community/">Zur Community</a>`; }
}
function escapeQuestion(value) { const node = document.createElement("span"); node.textContent = String(value || ""); return node.innerHTML; }
loadQuestion();
