function summarizeCommunityQuestions(items = []) {
  const summary = {
    available: true,
    total: 0,
    public: { open: 0, closed: 0 },
    private: { open: 0, closed: 0 },
  };
  for (const question of Array.isArray(items) ? items : []) {
    const visibility = question?.visibility === "private" ? "private" : "public";
    const lifecycle = ["closed", "resolved"].includes(String(question?.status || "").toLowerCase())
      ? "closed"
      : "open";
    summary[visibility][lifecycle] += 1;
    summary.total += 1;
  }
  return summary;
}

module.exports = { summarizeCommunityQuestions };
