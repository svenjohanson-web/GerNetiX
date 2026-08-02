"use strict";

const { estimateRequiredSlots } = require("../../shared/elastic-compute-contract");

function evaluateDailyLoadProfile(input = {}) {
  const dailyJobs = positive(input.daily_jobs); const runtimeMs = positive(input.mean_runtime_ms); const peakFactor = positiveNumber(input.peak_factor, 1);
  const averageRate = dailyJobs / 86400; const peakRate = averageRate * peakFactor;
  const average = estimateRequiredSlots([{ jobs_per_second: averageRate, mean_runtime_ms: runtimeMs }], { headroom_ratio: input.headroom_ratio ?? 0.25 });
  const peak = estimateRequiredSlots([{ jobs_per_second: peakRate, mean_runtime_ms: runtimeMs }], { headroom_ratio: input.headroom_ratio ?? 0.25 });
  const available = Math.max(0, Number(input.available_slots || 0));
  return { daily_jobs: dailyJobs, mean_runtime_ms: runtimeMs, average_jobs_per_second: averageRate, peak_jobs_per_second: peakRate, average_required_slots: average.required_slots, peak_required_slots: peak.required_slots, available_slots: available, stable_at_peak: available >= peak.required_slots, missing_peak_slots: Math.max(0, peak.required_slots - available) };
}
function evaluateChaosScenario(input = {}) {
  const healthySlots = Math.max(0, Number(input.healthy_slots || 0)); const lostSlots = Math.max(0, Number(input.lost_slots || 0)); const requiredSlots = Math.max(0, Number(input.required_slots || 0));
  const remaining = Math.max(0, healthySlots - lostSlots);
  return { remaining_slots: remaining, required_slots: requiredSlots, action: remaining >= requiredSlots ? "continue" : input.cloud_allowed === true ? "request_burst" : "backpressure", jobs_are_lost: false, expired_leases_are_requeued: true };
}
function positive(value) { const number = Number(value); if (!Number.isFinite(number) || number <= 0) throw new TypeError("positive load value required"); return number; }
function positiveNumber(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
module.exports = { evaluateChaosScenario, evaluateDailyLoadProfile };
