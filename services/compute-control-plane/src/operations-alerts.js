"use strict";

function deriveComputeAlerts(summary, options = {}) {
  const alerts = [];
  const queueSloMs = Number(options.queue_slo_ms || summary.policy?.target_wait_ms || 5000);
  if (summary.queue.queued_jobs > 0 && summary.capacity.current_slots === 0) alerts.push(alert("compute_capacity_unavailable", "critical", "Faellige Compute-Jobs haben keine aktive Kapazitaet."));
  if (summary.queue.oldest_job_age_ms > queueSloMs) alerts.push(alert("compute_queue_slo_violated", "warning", "Der älteste Compute-Job überschreitet das Wartezeitziel."));
  if (summary.recommendation.reason === "budget_exhausted") alerts.push(alert("compute_cloud_budget_exhausted", "critical", "Cloud-Budget ist erschöpft; Backpressure ist aktiv."));
  if (summary.recommendation.reason === "capacity_ceiling") alerts.push(alert("compute_capacity_ceiling", "warning", "Die konfigurierte Maximalkapazität ist erreicht."));
  if (summary.policy?.kill_switch === true) alerts.push(alert("compute_cloud_kill_switch", "info", "Cloud-Skalierung ist durch die Notbremse deaktiviert."));
  return alerts;
}
function alert(code, severity, message) { return { code, severity, message, payload_included: false }; }
module.exports = { deriveComputeAlerts };
