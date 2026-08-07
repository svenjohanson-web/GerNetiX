(function attachNexiWakeWordLab(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexiWakeWordLab = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createLab() {
  "use strict";

  const TARGET_REFERENCE_COUNT = 3;
  const MIN_ACTIVE_FRAMES = 12;
  const FREQUENCIES = [250, 500, 1000, 2000, 3000];

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function goertzelPower(samples, offset, length, sampleRate, frequency) {
    const omega = (2 * Math.PI * frequency) / sampleRate;
    const coefficient = 2 * Math.cos(omega);
    let previous = 0;
    let previousPrevious = 0;
    for (let index = 0; index < length; index += 1) {
      const current = samples[offset + index] +
        coefficient * previous - previousPrevious;
      previousPrevious = previous;
      previous = current;
    }
    return previousPrevious * previousPrevious + previous * previous -
      coefficient * previous * previousPrevious;
  }

  function extractFeatures(samples, sampleRate) {
    if (!samples || samples.length === 0 || !Number.isFinite(sampleRate) || sampleRate < 8000) {
      return [];
    }
    const frameLength = Math.max(1, Math.round(sampleRate * 0.025));
    const hopLength = Math.max(1, Math.round(sampleRate * 0.010));
    if (samples.length < frameLength) return [];

    const frames = [];
    let maximumRms = 0;
    for (let offset = 0; offset + frameLength <= samples.length; offset += hopLength) {
      let squareSum = 0;
      let zeroCrossings = 0;
      for (let index = 0; index < frameLength; index += 1) {
        const sample = samples[offset + index];
        squareSum += sample * sample;
        if (index > 0 && (sample >= 0) !== (samples[offset + index - 1] >= 0)) {
          zeroCrossings += 1;
        }
      }
      const rms = Math.sqrt(squareSum / frameLength);
      maximumRms = Math.max(maximumRms, rms);
      const powers = FREQUENCIES.map((frequency) =>
        goertzelPower(samples, offset, frameLength, sampleRate, frequency));
      frames.push({ rms, zeroCrossings: zeroCrossings / frameLength, powers });
    }

    if (maximumRms < 0.006) return [];
    const activeThreshold = Math.max(0.006, maximumRms * 0.16);
    let first = frames.findIndex((frame) => frame.rms >= activeThreshold);
    let last = frames.length - 1;
    while (last >= 0 && frames[last].rms < activeThreshold) last -= 1;
    if (first < 0 || last - first + 1 < MIN_ACTIVE_FRAMES) return [];
    first = Math.max(0, first - 2);
    last = Math.min(frames.length - 1, last + 2);

    return frames.slice(first, last + 1).map((frame) => {
      const totalPower = frame.powers.reduce((sum, power) => sum + power, 1e-12);
      return [
        clamp(frame.rms / maximumRms, 0, 1),
        clamp(frame.zeroCrossings * 3, 0, 1),
        ...frame.powers.map((power) => Math.sqrt(power / totalPower)),
      ];
    });
  }

  function frameDistance(left, right) {
    let sum = 0;
    for (let index = 0; index < left.length; index += 1) {
      const delta = left[index] - right[index];
      sum += delta * delta;
    }
    return Math.sqrt(sum / left.length);
  }

  function dtwDistance(left, right) {
    if (!left.length || !right.length) return Number.POSITIVE_INFINITY;
    let previous = new Float64Array(right.length + 1);
    let current = new Float64Array(right.length + 1);
    previous.fill(Number.POSITIVE_INFINITY);
    previous[0] = 0;

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      current.fill(Number.POSITIVE_INFINITY);
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const cost = frameDistance(left[leftIndex - 1], right[rightIndex - 1]);
        current[rightIndex] = cost + Math.min(
          previous[rightIndex],
          current[rightIndex - 1],
          previous[rightIndex - 1],
        );
      }
      const swap = previous;
      previous = current;
      current = swap;
    }
    return previous[right.length] / (left.length + right.length);
  }

  function referenceDistances(references) {
    const pairDistances = [];
    for (let left = 0; left < references.length; left += 1) {
      for (let right = left + 1; right < references.length; right += 1) {
        pairDistances.push(dtwDistance(references[left], references[right]));
      }
    }
    return pairDistances.sort((left, right) => left - right);
  }

  function calibrationThreshold(references) {
    const pairDistances = referenceDistances(references);
    if (!pairDistances.length) return 0.18;
    return clamp(Math.max(...pairDistances) * 1.55 + 0.025, 0.09, 0.28);
  }

  function calibratedConfidence(references, distance, threshold) {
    const pairDistances = referenceDistances(references);
    const medianDistance = pairDistances.length
      ? pairDistances[Math.floor(pairDistances.length / 2)]
      : threshold * 0.5;
    const typicalDistance = clamp(
      Math.max(medianDistance, threshold * 0.35),
      0.01,
      threshold * 0.9,
    );

    if (distance <= typicalDistance) {
      return clamp(Math.round(100 - 20 * distance / typicalDistance), 80, 100);
    }
    if (distance <= threshold) {
      const progress = (distance - typicalDistance) /
        Math.max(0.001, threshold - typicalDistance);
      return clamp(Math.round(80 - 30 * progress), 50, 80);
    }
    const excess = (distance - threshold) / Math.max(0.001, threshold);
    return clamp(Math.round(49 - 49 * excess), 0, 49);
  }

  function evaluateCandidate(references, candidate) {
    if (references.length < TARGET_REFERENCE_COUNT || !candidate.length) {
      return { detected: false, distance: Number.POSITIVE_INFINITY, threshold: 0 };
    }
    const distances = references.map((reference) => dtwDistance(reference, candidate));
    distances.sort((left, right) => left - right);
    const distance = (distances[0] + distances[1]) / 2;
    const threshold = calibrationThreshold(references);
    return {
      detected: distance <= threshold,
      distance,
      threshold,
      confidence: calibratedConfidence(references, distance, threshold),
    };
  }

  return {
    TARGET_REFERENCE_COUNT,
    calibrationThreshold,
    calibratedConfidence,
    dtwDistance,
    evaluateCandidate,
    extractFeatures,
  };
});
