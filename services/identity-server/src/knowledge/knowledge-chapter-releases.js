const releases = Object.freeze([
  Object.freeze({
    chapter_id: "yaml-basics",
    version: "2026-07-24.1",
    title: "YAML: strukturierte Daten lesbar beschreiben",
    summary: "Schlüssel, Werte, Einrückung, Listen und typische Fehler verständlich erklärt.",
    published_at: "2026-07-24T18:00:00.000Z",
    required_entitlements: Object.freeze(["learn_guided_projects"]),
  }),
  Object.freeze({
    chapter_id: "home-server-internet-security",
    version: "2026-07-28.1",
    title: "Home-Server sicher betreiben: Risiken der Internetfreigabe",
    summary: "Portfreigaben, Angriffsfläche, typische Fehlannahmen und sichere Alternativen verständlich einordnen.",
    published_at: "2026-07-28T18:00:00.000Z",
    required_entitlements: Object.freeze(["learn_guided_projects"]),
  }),
  Object.freeze({
    chapter_id: "security-basics",
    version: "2026-07-28.10",
    title: "Security in vernetzten Projekten",
    summary: "Identitäten, Rechte, Tokens, Zertifikate, MQTT-Sicherheit, typische Angriffsszenarien, Netzwerkgrenzen und eine Home-Server-Strategie verständlich einordnen.",
    published_at: "2026-07-28T19:00:00.000Z",
    required_entitlements: Object.freeze(["learn_guided_projects"]),
  }),
  Object.freeze({
    chapter_id: "radio-technologies-understand",
    version: "2026-07-30.1",
    title: "Funktechnologien verstehen",
    summary: "Bluetooth, WLAN, LoRa, Zigbee, NFC und RC-Funksysteme anhand ihrer Eigenschaften, Vor- und Nachteile sowie ihrer Störbarkeit vergleichen.",
    published_at: "2026-07-30T12:00:00.000Z",
    required_entitlements: Object.freeze(["learn_guided_projects"]),
  }),
]);

function knowledgeChapterReleases() {
  return releases.map((release) => ({
    ...release,
    required_entitlements: [...release.required_entitlements],
  }));
}

function currentKnowledgeChapterReleases() {
  const currentByChapter = new Map();
  knowledgeChapterReleases().forEach((release) => {
    const current = currentByChapter.get(release.chapter_id);
    if (!current || release.published_at > current.published_at) {
      currentByChapter.set(release.chapter_id, release);
    }
  });
  return [...currentByChapter.values()];
}

function findKnowledgeChapterRelease(chapterId) {
  return currentKnowledgeChapterReleases()
    .find((release) => release.chapter_id === String(chapterId || "")) || null;
}

function canReadKnowledgeChapter(release, entitlements = []) {
  const granted = new Set(entitlements);
  return Boolean(release) && release.required_entitlements.every((entitlement) => granted.has(entitlement));
}

function unreadKnowledgeChapterReleases(reads = [], entitlements = []) {
  const readVersions = new Map(reads.map((read) => [read.chapter_id, read.chapter_version]));
  return currentKnowledgeChapterReleases()
    .filter((release) => canReadKnowledgeChapter(release, entitlements))
    .filter((release) => readVersions.get(release.chapter_id) !== release.version)
    .sort((left, right) => right.published_at.localeCompare(left.published_at));
}

function knowledgeChapterHistory(reads = [], entitlements = []) {
  const readsByChapter = new Map(reads.map((read) => [read.chapter_id, read]));
  const currentVersions = new Map(currentKnowledgeChapterReleases()
    .map((release) => [release.chapter_id, release.version]));
  return knowledgeChapterReleases()
    .filter((release) => canReadKnowledgeChapter(release, entitlements))
    .map((release) => {
      const read = readsByChapter.get(release.chapter_id);
      const isCurrent = currentVersions.get(release.chapter_id) === release.version;
      return {
        ...release,
        is_current: isCurrent,
        is_new: isCurrent && read?.chapter_version !== release.version,
        seen_at: read?.chapter_version === release.version ? read.seen_at : null,
      };
    })
    .sort((left, right) => right.published_at.localeCompare(left.published_at));
}

module.exports = {
  canReadKnowledgeChapter,
  currentKnowledgeChapterReleases,
  findKnowledgeChapterRelease,
  knowledgeChapterHistory,
  knowledgeChapterReleases,
  unreadKnowledgeChapterReleases,
};
