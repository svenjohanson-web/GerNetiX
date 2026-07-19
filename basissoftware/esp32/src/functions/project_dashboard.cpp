#include "basissoftware/project_dashboard.h"

#include <cstdio>
#include <cstring>

#include "esp_timer.h"
#include "freertos/FreeRTOS.h"

namespace {
constexpr size_t SAMPLE_CAPACITY = 24;
constexpr size_t LOG_CAPACITY = 12;
constexpr size_t LOG_ENTRY_SIZE = 96;

portMUX_TYPE dashboardLock = portMUX_INITIALIZER_UNLOCKED;
int currentMeasurement = 0;
long long lastUpdateMs = 0;
int samples[SAMPLE_CAPACITY] = {};
size_t sampleCount = 0;
char logs[LOG_CAPACITY][LOG_ENTRY_SIZE] = {};
size_t logCount = 0;

void appendJsonEscaped(char *target, size_t targetSize, size_t &written, const char *value) {
  if (value == nullptr) return;
  for (const char *cursor = value; *cursor != '\0' && written + 2 < targetSize; ++cursor) {
    const char character = *cursor;
    if (character == '"' || character == '\\') {
      target[written++] = '\\';
    }
    if (character == '\n' || character == '\r') {
      target[written++] = ' ';
    } else {
      target[written++] = character;
    }
  }
  target[written] = '\0';
}
}

void projectDashboardPublishMeasurement(int value) {
  portENTER_CRITICAL(&dashboardLock);
  currentMeasurement = value;
  lastUpdateMs = esp_timer_get_time() / 1000;
  if (sampleCount < SAMPLE_CAPACITY) {
    samples[sampleCount++] = value;
  } else {
    std::memmove(samples, samples + 1, sizeof(int) * (SAMPLE_CAPACITY - 1));
    samples[SAMPLE_CAPACITY - 1] = value;
  }
  portEXIT_CRITICAL(&dashboardLock);
}

void projectDashboardAppendLog(const char *message) {
  if (message == nullptr) return;
  portENTER_CRITICAL(&dashboardLock);
  if (logCount < LOG_CAPACITY) {
    std::snprintf(logs[logCount++], LOG_ENTRY_SIZE, "%s", message);
  } else {
    std::memmove(logs, logs + 1, LOG_ENTRY_SIZE * (LOG_CAPACITY - 1));
    std::snprintf(logs[LOG_CAPACITY - 1], LOG_ENTRY_SIZE, "%s", message);
  }
  portEXIT_CRITICAL(&dashboardLock);
}

void writeProjectDashboardJson(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) return;
  target[0] = '\0';

  portENTER_CRITICAL(&dashboardLock);
  const int measurement = currentMeasurement;
  const long long updated = lastUpdateMs;
  const size_t copiedSampleCount = sampleCount;
  int copiedSamples[SAMPLE_CAPACITY] = {};
  std::memcpy(copiedSamples, samples, sizeof(copiedSamples));
  const size_t copiedLogCount = logCount;
  char copiedLogs[LOG_CAPACITY][LOG_ENTRY_SIZE] = {};
  std::memcpy(copiedLogs, logs, sizeof(copiedLogs));
  portEXIT_CRITICAL(&dashboardLock);

  size_t written = static_cast<size_t>(std::snprintf(
      target,
      targetSize,
      "{\"title\":\"Projektinstanz: Messwert-Zaehler\",\"label\":\"Demo-Messwert\",\"unit\":\"\",\"value\":%d,\"updatedMs\":%lld,\"samples\":[",
      measurement,
      updated));
  if (written >= targetSize) {
    target[targetSize - 1] = '\0';
    return;
  }
  for (size_t index = 0; index < copiedSampleCount && written + 16 < targetSize; ++index) {
    written += static_cast<size_t>(std::snprintf(target + written, targetSize - written, "%s%d", index == 0 ? "" : ",", copiedSamples[index]));
  }
  written += static_cast<size_t>(std::snprintf(target + written, targetSize - written, "],\"logs\":["));
  for (size_t index = 0; index < copiedLogCount && written + 4 < targetSize; ++index) {
    if (index > 0) target[written++] = ',';
    target[written++] = '"';
    appendJsonEscaped(target, targetSize, written, copiedLogs[index]);
    if (written + 1 < targetSize) target[written++] = '"';
  }
  if (written + 3 < targetSize) {
    target[written++] = ']';
    target[written++] = '}';
    target[written++] = '\n';
  }
  target[written < targetSize ? written : targetSize - 1] = '\0';
}

const char *projectDashboardPageHtml() {
  return R"HTML(<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GerNetiX Projekt</title><style>body{font-family:system-ui,sans-serif;margin:1.2rem;background:#101827;color:#ecf5ff}main{max-width:58rem;margin:auto}.grid{display:grid;grid-template-columns:minmax(14rem,1fr) minmax(18rem,2fr);gap:1rem}.card{background:#182334;border:1px solid #36516f;border-radius:.7rem;padding:1rem}.value{font-size:4rem;font-weight:700;color:#43e6ff}canvas{width:100%;height:210px;background:#0b1220;border-radius:.5rem}ol{margin:0;padding-left:1.3rem;max-height:270px;overflow:auto}li{padding:.25rem 0;border-bottom:1px solid #26384f}small{color:#a7c1df}</style></head><body><main><p><small>GerNetiX · lokale Projektansicht</small></p><h1 id="title">Projekt wird geladen…</h1><div class="grid"><section class="card"><small id="label">Messwert</small><div class="value" id="value">–</div><small>Aktualisierung alle 5 Sekunden</small></section><section class="card"><strong>Verlauf</strong><canvas id="chart" width="600" height="210"></canvas></section><section class="card"><strong>Projekt-Log</strong><ol id="logs"><li>Warte auf erste Messung …</li></ol></section></div><p><a href="/status" style="color:#43e6ff">Technischer Status</a> · <a href="/logs" style="color:#43e6ff">Basis-Log</a></p></main><script>const $=id=>document.getElementById(id);function chart(values){const c=$("chart"),x=c.getContext("2d"),w=c.width,h=c.height;x.clearRect(0,0,w,h);x.strokeStyle="#36516f";for(let i=0;i<=10;i++){let y=h-15-i*(h-30)/10;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}if(!values.length)return;x.strokeStyle="#43e6ff";x.lineWidth=3;x.beginPath();values.forEach((v,i)=>{let px=values.length===1?w/2:i*w/(values.length-1),py=h-15-v*(h-30)/10;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()}async function refresh(){try{const d=await fetch('/project/dashboard',{cache:'no-store'}).then(r=>r.json());$("title").textContent=d.title;$("label").textContent=d.label||'Messwert';$("value").textContent=d.value+(d.unit||'');$("logs").innerHTML=(d.logs||[]).slice().reverse().map(v=>'<li>'+v.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</li>').join('')||'<li>Warte auf erste Messung …</li>';chart(d.samples||[])}catch(e){$("logs").innerHTML='<li>Projektwerte sind nicht erreichbar.</li>'}}refresh();setInterval(refresh,1000)</script></body></html>)HTML";
}
