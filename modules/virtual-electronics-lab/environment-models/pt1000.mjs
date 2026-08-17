const PT1000_COEFFICIENTS = Object.freeze({
  A: 3.9083e-3,
  B: -5.775e-7,
  C: -4.183e-12,
});

export const PT1000_MODEL = Object.freeze({
  modelId: "pt1000-iec-60751",
  modelVersion: "1.0.0",
  quantity: "resistance",
  inputUnit: "degC",
  outputUnit: "ohm",
  nominalResistanceOhm: 1000,
  minTemperatureC: -200,
  maxTemperatureC: 850,
  coefficients: PT1000_COEFFICIENTS,
  limitations: Object.freeze([
    "Toleranzklassen und Genauigkeitsklassen sind nicht modelliert.",
    "Kein Leitungswiderstand oder Kontaktwiderstand.",
    "Keine Eigenerwärmung.",
    "Keine thermische Trägheit oder Hysterese.",
    "Keine ADC-Quantisierung oder Referenzspannungsmodellierung.",
    "Kein Rauschen, keine Kalibrierung, keine Unsicherheitsabschätzung.",
    "Kein Umrechnen Widerstand zurück in Temperatur.",
  ]),
});

function validateTemperatureInput(temperatureC) {
  if (typeof temperatureC !== "number" || !Number.isFinite(temperatureC)) {
    return {
      ok: false,
      error: {
        code: "PT1000_TEMPERATURE_NUMBER_REQUIRED",
        message: "temperatureC must be a finite number.",
      },
    };
  }

  if (temperatureC < PT1000_MODEL.minTemperatureC || temperatureC > PT1000_MODEL.maxTemperatureC) {
    return {
      ok: false,
      error: {
        code: "PT1000_TEMPERATURE_OUT_OF_RANGE",
        message: `temperatureC must be between ${PT1000_MODEL.minTemperatureC} and ${PT1000_MODEL.maxTemperatureC}.`,
      },
    };
  }

  return { ok: true };
}

function calculateResistance(temperatureC) {
  const { A, B, C } = PT1000_MODEL.coefficients;
  if (temperatureC >= 0) {
    return PT1000_MODEL.nominalResistanceOhm * (1 + A * temperatureC + B * temperatureC * temperatureC);
  }

  return PT1000_MODEL.nominalResistanceOhm
    * (1 + A * temperatureC + B * temperatureC * temperatureC + C * (temperatureC - 100) * temperatureC ** 3);
}

export function evaluatePt1000(temperatureC) {
  const validated = validateTemperatureInput(temperatureC);
  if (!validated.ok) {
    return {
      ok: false,
      errors: [validated.error],
    };
  }

  return {
    ok: true,
    result: {
      temperatureC,
      resistanceOhm: calculateResistance(temperatureC),
      modelId: PT1000_MODEL.modelId,
      modelVersion: PT1000_MODEL.modelVersion,
      warnings: [],
    },
  };
}
