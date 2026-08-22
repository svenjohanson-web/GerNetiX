"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { sandboxModule } = require("../test-support/platform-app-source");

/*
 * Diese Zusicherungen fuehren den OTA-Weg aus, statt seinen Quelltext zu lesen.
 *
 * Der Unterschied ist nicht kosmetisch: ein Textvergleich haelt auch dann, wenn
 * der Wortlaut bleibt und die Bedeutung kippt, und er bricht beim Umbauen,
 * obwohl sich nichts geaendert hat. Der Weg soll spaeter mit USB und FlashBox
 * zu einem Ablauf zusammengefuehrt werden -- dafuer muss pruefbar sein, was er
 * tut, nicht wie er dasteht.
 *
 * Das Dokument beantwortet jede Abfrage mit null. Beide Zeichenfunktionen, die
 * hier beruehrt werden, kehren dann sofort zurueck; geprueft wird der Ablauf,
 * nicht die Oberflaeche.
 */
function createController({ device, statusAnswers = [], onPost = () => ({}) }) {
  const record = { status: [], terminal: [], posts: [], statusCalls: 0 };
  const project = { id: "p1", slug: "demo", title: "Demo" };
  const state = { activeProjectId: "p1", activeSoftwareUnitIds: {}, builds: [] };
  const injected = {
    state,
    document: { querySelector: () => null, querySelectorAll: () => [] },
    window: {},
    delay: () => Promise.resolve(),
    projectById: () => project,
    projectSoftwareUnits: () => [{ software_unit_id: "u1", build_system: "platformio", title: "Firmware" }],
    activeIdeSoftwareUnit: () => ({ software_unit_id: "u1", title: "Firmware" }),
    allocatedIdeDevice: () => device,
    persistCurrentSource: async () => ({}),
    renderIdeProjectInformation: () => {},
    showStatus: (kind, text) => record.status.push({ kind, text }),
    appendTerminalLine: (kind, text) => record.terminal.push({ kind, text }),
    postJson: async (url, body) => {
      record.posts.push({ url, body });
      return { build_job_id: "job-1", status: "queued", mode: body.mode, ...onPost(body) };
    },
    getJson: async () => {
      const answer = statusAnswers[Math.min(record.statusCalls, statusAnswers.length - 1)];
      record.statusCalls += 1;
      if (answer instanceof Error) throw answer;
      return answer;
    },
    globalThis: {},
  };
  const exported = sandboxModule("app-device-build-controller.js", injected, [
    "startOtaFlash",
    "waitForCompletedBuild",
  ]);
  return { ...exported, record, project, state };
}

const onlineDevice = { device_id: "d1", connectivity_status: "online", ota_status: "ready", display_name: "Board" };

function transientError() {
  const error = new TypeError("fetch failed");
  return error;
}

test("an OTA order stays open until the board has answered", async () => {
  const { waitForCompletedBuild, record } = createController({
    device: onlineDevice,
    statusAnswers: [
      { status: "succeeded", flash_status: "queued_for_mqtt" },
      { status: "succeeded", flash_status: "queued_for_mqtt" },
      { status: "succeeded", flash_status: "confirmed" },
    ],
  });

  const completed = await waitForCompletedBuild({ build_job_id: "job-1", mode: "build_and_flash", status: "queued" });

  assert.equal(completed.flash_status, "confirmed");
  assert.equal(record.statusCalls, 3);
});

test("a build that never reaches the board is not treated as an unfinished OTA order", async () => {
  const { waitForCompletedBuild, record } = createController({
    device: onlineDevice,
    statusAnswers: [{ status: "failed", error: "compile error" }],
  });

  const completed = await waitForCompletedBuild({ build_job_id: "job-1", mode: "build_and_flash", status: "queued" });

  assert.equal(completed.status, "failed");
  assert.equal(record.statusCalls, 1);
});

test("a USB build is finished when the build is finished", async () => {
  const { waitForCompletedBuild, record } = createController({
    device: onlineDevice,
    statusAnswers: [{ status: "succeeded" }],
  });

  const completed = await waitForCompletedBuild({ build_job_id: "job-1", mode: "build_and_usb_flash", status: "queued" });

  assert.equal(completed.status, "succeeded");
  assert.equal(record.statusCalls, 1);
});

test("a short outage of the status endpoint does not abandon a running build", async () => {
  const { waitForCompletedBuild, record } = createController({
    device: onlineDevice,
    statusAnswers: [
      transientError(),
      transientError(),
      { status: "succeeded", flash_status: "confirmed" },
    ],
  });

  const completed = await waitForCompletedBuild({ build_job_id: "job-1", mode: "build_and_flash", status: "queued" });

  assert.equal(completed.flash_status, "confirmed");
  assert.match(record.terminal.map((line) => line.text).join("\n"), /unterbrochen/);
  assert.match(record.terminal.map((line) => line.text).join("\n"), /wiederhergestellt/);
});

test("an error that is not a connection hiccup ends the wait", async () => {
  const serverError = Object.assign(new Error("kaputt"), { status: 500 });
  const { waitForCompletedBuild } = createController({ device: onlineDevice, statusAnswers: [serverError] });

  await assert.rejects(
    waitForCompletedBuild({ build_job_id: "job-1", mode: "build_and_flash", status: "queued" }),
    /kaputt/,
  );
});

test("OTA reports success only once the deploy state confirms it", async () => {
  const { startOtaFlash, record } = createController({
    device: onlineDevice,
    statusAnswers: [{ status: "succeeded", flash_status: "confirmed" }],
  });

  await startOtaFlash(true);

  assert.deepEqual(record.posts.map((post) => post.body.mode), ["build_and_flash"]);
  assert.equal(record.posts[0].body.device_id, "d1");
  assert.equal(record.status.at(-1).kind, "ok");
  assert.match(record.status.at(-1).text, /confirmed/);
});

test("a built firmware the board rejected is not reported as a successful OTA", async () => {
  const { startOtaFlash, record } = createController({
    device: onlineDevice,
    statusAnswers: [{ status: "succeeded", flash_status: "failed" }],
  });

  await startOtaFlash(true);

  assert.equal(record.status.at(-1).kind, "error");
  assert.match(record.status.at(-1).text, /nicht bestätigt/);
});

test("an offline board is refused before a build is even ordered", async () => {
  const { startOtaFlash, record } = createController({
    device: { device_id: "d1", connectivity_status: "offline", ota_status: "ready" },
    statusAnswers: [{ status: "succeeded", flash_status: "confirmed" }],
  });

  await startOtaFlash(true);

  assert.deepEqual(record.posts, []);
  assert.equal(record.status.at(-1).kind, "error");
  assert.match(record.status.at(-1).text, /nicht online/);
});

test("a board that is online but not OTA-ready is refused as well", async () => {
  const { startOtaFlash, record } = createController({
    device: { device_id: "d1", connectivity_status: "online", ota_status: "unknown" },
    statusAnswers: [{ status: "succeeded", flash_status: "confirmed" }],
  });

  await startOtaFlash(true);

  assert.deepEqual(record.posts, []);
  assert.match(record.status.at(-1).text, /nicht OTA-ready/);
});
