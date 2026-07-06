class InMemoryCommunityRepository {
  constructor(seed = {}) {
    this.questions = new Map((seed.questions || []).map((item) => [item.question_id, item]));
    this.answers = new Map((seed.answers || []).map((item) => [item.answer_id, item]));
    this.knowledgeDocuments = new Map((seed.knowledgeDocuments || []).map((item) => [item.document_id, item]));
  }

  saveQuestion(question) {
    this.questions.set(question.question_id, question);
    return question;
  }

  findQuestion(questionId) {
    return this.questions.get(questionId) || null;
  }

  listQuestions(filter = {}) {
    return Array.from(this.questions.values()).filter((question) => {
      if (filter.status && question.status !== filter.status) return false;
      if (filter.triage_status && question.triage_status !== filter.triage_status) return false;
      if (filter.project_id && question.project_id !== filter.project_id) return false;
      if (filter.tag && !question.tags.includes(filter.tag)) return false;
      return true;
    });
  }

  saveAnswer(answer) {
    this.answers.set(answer.answer_id, answer);
    return answer;
  }

  findAnswer(answerId) {
    return this.answers.get(answerId) || null;
  }

  listAnswers(questionId) {
    return Array.from(this.answers.values()).filter((answer) => answer.question_id === questionId);
  }

  saveKnowledgeDocument(document) {
    this.knowledgeDocuments.set(document.document_id, document);
    return document;
  }

  listKnowledgeDocuments(filter = {}) {
    return Array.from(this.knowledgeDocuments.values()).filter((document) => {
      if (filter.source_type && document.source_type !== filter.source_type) return false;
      if (filter.verification_state && document.verification_state !== filter.verification_state) return false;
      return true;
    });
  }
}

module.exports = { InMemoryCommunityRepository };
