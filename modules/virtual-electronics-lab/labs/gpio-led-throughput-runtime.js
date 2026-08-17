export const COMMAND_TYPES = {
  UpdateSourceFile: "UpdateSourceFile",
  StartSimulation: "StartSimulation",
  ResetSimulation: "ResetSimulation",
  LoadLabExample: "LoadLabExample",
  AttachProbe: "AttachProbe",
  DetachProbe: "DetachProbe",
};

const MODEL_VALUES = {
  mcuVersion: "virtual-generic",
  schemaVersion: "1.0.0",
  gpioPin: 5,
  gpioVoltageHigh: 3.3,
  gpioVoltageLow: 0,
  resistorOhm: 330,
  ledForwardVoltage: 2,
  maxGpioSourceCurrentA: 0.012,
  maxLedCurrentA: 0.02,
};

const PWM_CYCLES_FOR_SIMULATION = 4;
const PWM_TIMEBASE_MICROSECONDS = "1e-9 us deterministic rounded trace";
const PWM_EXAMPLES = {
  pwmThroughput: "gpio-pwm-led",
};
const OSCILLOSCOPE_INSTRUMENT_ID = "scope-1";
const OSCILLOSCOPE_CHANNEL_ID = "ch1";
const OSCILLOSCOPE_TRIGGER_LEVEL = 1.65;
const OSCILLOSCOPE_TRIGGER_SLOPE = "rising";
const OSCILLOSCOPE_SECONDS_PER_DIVISION_US = 500;
const OSCILLOSCOPE_DIVISIONS_HORIZONTAL = 8;
const OSCILLOSCOPE_DIVISIONS_VERTICAL = 8;
const OSCILLOSCOPE_VISIBLE_WINDOW_US = OSCILLOSCOPE_SECONDS_PER_DIVISION_US * OSCILLOSCOPE_DIVISIONS_HORIZONTAL;
const OSCILLOSCOPE_VOLTAGE_LOW_DISPLAY = -0.2;
const OSCILLOSCOPE_VOLTAGE_HIGH_DISPLAY = 3.5;
const OSCILLOSCOPE_INSTRUMENT_MODEL_VERSION = "oscilloscope-shared-trace-v1";
const MEASUREMENT_POINTS = {
  "gpio-5": { id: "gpio-5", label: "GPIO 5" },
  gnd: { id: "gnd", label: "GND" },
};
const OSCILLOSCOPE_DEFAULT_CHANNEL = {
  kind: "voltage",
  coupling: "dc",
  probeFactor: 1,
  voltsPerDivision: 1,
  secondsPerDivision: OSCILLOSCOPE_SECONDS_PER_DIVISION_US,
  triggerSlope: OSCILLOSCOPE_TRIGGER_SLOPE,
  triggerLevel: OSCILLOSCOPE_TRIGGER_LEVEL,
  tipConnection: null,
  referenceConnection: null,
};

function createDefaultLabProject(sourceFile, model) {
  return {
    schemaVersion: model.schemaVersion,
    metadata: {
      id: "elab-ds-001-gpio-led",
      kind: "virtual-electronics-lab-project",
      title: "GPIO 5 → LED",
    },
    circuit: {
      controller: {
        kind: "virtual-microcontroller",
        modelVersion: model.mcuVersion,
        gpioPin: model.gpioPin,
        voltageHighV: model.gpioVoltageHigh,
        voltageLowV: model.gpioVoltageLow,
      },
      components: {
        resistor: { kind: "resistor", resistanceOhm: model.resistorOhm },
        led: { kind: "led", forwardVoltageV: model.ledForwardVoltage },
      },
      nets: ["gpio-5", "gnd"],
    },
    controller: {
      sourceFile: normalizeSource(sourceFile),
    },
    simulation: {
      modelVersions: {
        controller: model.mcuVersion,
        electrical: "gpio-led-ideal-v1",
        trace: "pwm-trace-v1",
      },
    },
    instruments: {
      instances: {
        [OSCILLOSCOPE_INSTRUMENT_ID]: {
          kind: "oscilloscope",
          modelVersion: OSCILLOSCOPE_INSTRUMENT_MODEL_VERSION,
          channels: {
            [OSCILLOSCOPE_CHANNEL_ID]: {
              ...OSCILLOSCOPE_DEFAULT_CHANNEL,
            },
          },
        },
      },
    },
    measurementPoints: cloneModelLike(MEASUREMENT_POINTS),
  };
}

function cloneModelLike(value) {
  return JSON.parse(JSON.stringify(value));
}

export const ELAB_DS_001_START_CODE = `void setup() {
  pinMode(5, OUTPUT);
  digitalWrite(5, HIGH);
}

void loop() {
}`;

export const ELAB_DS_002_PWM_START_CODE = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 25);
  pwmStart(5);
}

void loop() {
}`;
export const ELAB_DS_002_PWM_STOP_CODE = `void setup() {
  pinMode(5, OUTPUT);
  pwmConfigure(5, 1000, 25);
  pwmStart(5);
  pwmStop(5);
}

void loop() {
}`;

function cloneModel(overrides) {
  return { ...MODEL_VALUES, ...(overrides || {}) };
}

export function createThroughputCommandTypes() {
  return COMMAND_TYPES;
}

function normalizeSource(source) {
  return String(source ?? "").replace(/\r\n/g, "\n");
}

function stripComments(source) {
  let index = 0;
  let output = "";
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      output += "  ";
      index += 2;
      while (index < source.length) {
        output += source[index] === "\n" ? "\n" : " ";
        if (source[index] === "\n") {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      const commentStart = index;
      output += "  ";
      index += 2;
      let closed = false;
      while (index < source.length - 1) {
        if (source[index] === "*" && source[index + 1] === "/") {
          output += "  ";
          index += 2;
          closed = true;
          break;
        }
        output += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (!closed) {
        return {
          ok: false,
          error: syntaxError(source, commentStart, "PROGRAM_SYNTAX_ERROR", "Blockkommentar ist nicht geschlossen."),
        };
      }
      continue;
    }

    output += char;
    index += 1;
  }

  return { ok: true, source: output };
}

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function toLineColumn(index, starts) {
  let low = 0;
  let high = starts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (starts[mid] <= index) {
      if (mid === starts.length - 1 || starts[mid + 1] > index) {
        return { line: mid + 1, column: index - starts[mid] + 1 };
      }
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }

  return { line: 1, column: index + 1 };
}

function makeRuntimeSourceHash(source) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function findFunction(source, functionName) {
  const finder = new RegExp(`\\bvoid\\s+${functionName}\\s*\\(\\s*\\)\\s*\\{`, "g");
  const matches = [];
  for (const match of source.matchAll(finder)) {
    matches.push({ index: match.index, match });
  }
  return matches;
}

function extractFunction(source, functionName) {
  const allMatches = findFunction(source, functionName);
  if (!allMatches.length) {
    return { error: { code: "PROGRAM_SYNTAX_ERROR", message: `Funktion ${functionName}() fehlt.`, line: 1, column: 1 } };
  }

  if (allMatches.length > 1) {
    const lineInfo = toLineColumn(allMatches[1].index, lineStarts(source));
    return { error: { code: "PROGRAM_SYNTAX_ERROR", message: `Funktion ${functionName}() darf nur einmal vorkommen.`, line: lineInfo.line, column: lineInfo.column } };
  }

  const { index, match } = allMatches[0];
  const openBrace = index + match[0].indexOf("{");
  let depth = 0;
  let cursor = openBrace;

  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const bodyStart = openBrace + 1;
        return {
          ok: true,
          headerStart: index,
          bodyStart,
          bodyEnd: cursor,
          body: source.slice(bodyStart, cursor),
          end: cursor + 1,
        };
      }
    }
    cursor += 1;
  }

  const lineInfo = toLineColumn(openBrace, lineStarts(source));
  return { error: { code: "PROGRAM_SYNTAX_ERROR", message: `Funktion ${functionName}() hat keine geschlossene Klammer.`, line: lineInfo.line, column: lineInfo.column } };
}

function syntaxError(source, position, code, message) {
  const location = toLineColumn(position, lineStarts(source));
  return { code, message, line: location.line, column: location.column, position };
}

function splitStatements(bodyText, bodyStartOffset, sourceForPosition) {
  const list = [];
  let start = 0;

  for (let index = 0; index < bodyText.length; index += 1) {
    if (bodyText[index] !== ";") continue;
    const piece = bodyText.slice(start, index + 1).trim();
    if (piece.length) {
      list.push({
        text: piece.slice(0, -1).trim(),
        start: bodyStartOffset + start,
      });
    }
    start = index + 1;
  }

  const remainder = bodyText.slice(start).trim();
  if (remainder.length) {
    const trimmed = remainder.replace(/\s+$/g, "");
    if (trimmed.length) {
      return {
        statements: list,
        error: syntaxError(
          sourceForPosition,
          bodyStartOffset + start,
          "PROGRAM_SYNTAX_ERROR",
          "Eine Anweisung ohne Abschluss-Semikolon ist ungültig."
        ),
      };
    }
  }

  return { statements: list, error: null };
}

function parseNumericLiteral(rawValue, position, sourceForPosition) {
  const token = String(rawValue ?? "").trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(token)) {
    return {
      ok: false,
      error: syntaxError(
        sourceForPosition,
        position,
        "PWM_NUMERIC_ARGUMENT_REQUIRED",
        "Ein numerischer Wert wird im PWM-Aufruf erwartet."
      ),
    };
  }

  const value = Number(token);
  if (!Number.isFinite(value)) {
    return {
      ok: false,
      error: syntaxError(
        sourceForPosition,
        position,
        "PWM_NUMERIC_ARGUMENT_REQUIRED",
        "Der PWM-Wert muss eine endliche Zahl sein."
      ),
    };
  }

  return { ok: true, value };
}

function parseCommand(text, statementStartOffset, sourceForPosition) {
  const pinModeMatch = /^pinMode\s*\(\s*(\d+)\s*,\s*OUTPUT\s*\)$/i.exec(text);
  if (pinModeMatch) {
    return {
      ok: true,
      command: {
        kind: "pinMode",
        pin: Number(pinModeMatch[1]),
        start: statementStartOffset,
      },
    };
  }

  const writeMatch = /^digitalWrite\s*\(\s*(\d+)\s*,\s*(HIGH|LOW)\s*\)$/i.exec(text);
  if (writeMatch) {
    return {
      ok: true,
      command: {
        kind: "digitalWrite",
        pin: Number(writeMatch[1]),
        value: writeMatch[2].toUpperCase(),
        start: statementStartOffset,
      },
    };
  }

  const pwmConfigureMatch = /^pwmConfigure\s*\(\s*(\d+)\s*,\s*([^,]+)\s*,\s*([^\)]+)\s*\)$/i.exec(text);
  if (pwmConfigureMatch) {
    const frequencyParsed = parseNumericLiteral(pwmConfigureMatch[2], statementStartOffset, sourceForPosition);
    if (!frequencyParsed.ok) return frequencyParsed;
    const dutyParsed = parseNumericLiteral(pwmConfigureMatch[3], statementStartOffset, sourceForPosition);
    if (!dutyParsed.ok) return dutyParsed;

    const frequencyHz = frequencyParsed.value;
    const dutyPercent = dutyParsed.value;

    if (frequencyHz < 1 || frequencyHz > 100000) {
      return {
        ok: false,
        error: syntaxError(
          sourceForPosition,
          statementStartOffset,
          "PWM_FREQUENCY_OUT_OF_RANGE",
          "Frequenz muss zwischen 1 und 100.000 Hz liegen."
        ),
      };
    }

    if (dutyPercent < 0 || dutyPercent > 100) {
      return {
        ok: false,
        error: syntaxError(
          sourceForPosition,
          statementStartOffset,
          "PWM_DUTY_CYCLE_OUT_OF_RANGE",
          "Tastgrad muss zwischen 0 und 100 Prozent liegen."
        ),
      };
    }

    return {
      ok: true,
      command: {
        kind: "pwmConfigure",
        pin: Number(pwmConfigureMatch[1]),
        frequencyHz,
        dutyPercent,
        start: statementStartOffset,
      },
    };
  }

  if (/^pwmStart\s*\(/i.test(text)) {
    const pwmStartMatch = /^pwmStart\s*\(\s*(\d+)\s*\)$/i.exec(text);
    if (pwmStartMatch) {
      return {
        ok: true,
        command: {
          kind: "pwmStart",
          pin: Number(pwmStartMatch[1]),
          start: statementStartOffset,
        },
      };
    }
    return {
      ok: false,
      error: syntaxError(
        sourceForPosition,
        statementStartOffset,
        "PROGRAM_SYNTAX_ERROR",
        "Ungültiger pwmStart-Aufruf."
      ),
    };
  }

  if (/^pwmStop\s*\(/i.test(text)) {
    const pwmStopMatch = /^pwmStop\s*\(\s*(\d+)\s*\)$/i.exec(text);
    if (pwmStopMatch) {
      return {
        ok: true,
        command: {
          kind: "pwmStop",
          pin: Number(pwmStopMatch[1]),
          start: statementStartOffset,
        },
      };
    }
    return {
      ok: false,
      error: syntaxError(
        sourceForPosition,
        statementStartOffset,
        "PROGRAM_SYNTAX_ERROR",
        "Ungültiger pwmStop-Aufruf."
      ),
    };
  }

  return {
    ok: false,
    error: syntaxError(
      sourceForPosition,
      statementStartOffset,
      "PROGRAM_SYNTAX_ERROR",
      "Ungültiger Konstruktionstyp im Quelltext."
    ),
  };
}

function parseStatements(bodyResult, sourceForPosition, bodyType) {
  const statementSplit = splitStatements(bodyResult.body, bodyResult.bodyStart, sourceForPosition);
  if (statementSplit.error) {
    return statementSplit;
  }

  const commands = [];
  for (const statement of statementSplit.statements) {
    if (!statement.text.trim()) continue;
    const parsed = parseCommand(statement.text, statement.start, sourceForPosition);
    if (!parsed.ok) {
      return { statements: null, error: parsed.error };
    }
    if (parsed.command) {
      commands.push(parsed.command);
    }
  }

  return { statements: commands, error: null, kind: bodyType };
}

export function parseThroughputProgram(sourceCode) {
  const source = normalizeSource(sourceCode);

  if (source.length > 4096) {
    const first = toLineColumn(0, lineStarts(source));
    return { ok: false, errors: [{ code: "SOURCE_TOO_LARGE", message: "Der Quellcode ist größer als 4.096 Zeichen.", line: first.line, column: first.column }] };
  }

  const stripped = stripComments(source);
  if (!stripped.ok) return { ok: false, errors: [stripped.error] };
  const cleanSource = stripped.source;
  const setup = extractFunction(cleanSource, "setup");
  if (!setup.ok) return { ok: false, errors: [setup.error] };

  const loop = extractFunction(cleanSource, "loop");
  if (!loop.ok) return { ok: false, errors: [loop.error] };

  if (setup.headerStart > loop.headerStart) {
    return {
      ok: false,
      errors: [
        syntaxError(cleanSource, loop.headerStart, "PROGRAM_SYNTAX_ERROR", "setup muss vor loop stehen."),
      ],
    };
  }

  const lead = cleanSource.slice(0, setup.headerStart).trim();
  if (lead.length) {
    return {
      ok: false,
      errors: [syntaxError(cleanSource, 0, "PROGRAM_SYNTAX_ERROR", "Es sind nur setup und loop erlaubt.")],
    };
  }

  if (cleanSource.slice(setup.end, loop.headerStart).trim().length) {
    return {
      ok: false,
      errors: [syntaxError(cleanSource, setup.end, "PROGRAM_SYNTAX_ERROR", "Unbekannter Code zwischen setup und loop." )],
    };
  }

  const tail = cleanSource.slice(loop.end).trim();
  if (tail.length) {
    return {
      ok: false,
      errors: [syntaxError(cleanSource, loop.end, "PROGRAM_SYNTAX_ERROR", "Nach loop sind keine Konstrukte erlaubt.")],
    };
  }

  const parsedSetup = parseStatements(setup, cleanSource, "setup");
  if (parsedSetup.error) return { ok: false, errors: [parsedSetup.error] };

  const parsedLoop = parseStatements(loop, cleanSource, "loop");
  if (parsedLoop.error) return { ok: false, errors: [parsedLoop.error] };

  const statementCount = parsedSetup.statements.length + parsedLoop.statements.length;
  if (statementCount > 32) {
    const position = parsedLoop.statements.length ? parsedLoop.statements[31]?.start : loop.end;
    return { ok: false, errors: [syntaxError(cleanSource, position, "PROGRAM_STATEMENT_LIMIT_EXCEEDED", "Mehr als 32 Anweisungen sind nicht zulässig.")] };
  }

  return {
    ok: true,
    program: {
      setup: parsedSetup.statements,
      loop: parsedLoop.statements,
    },
  };
}

function toMicroseconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Number(value.toFixed(9));
}

function formatFrequencyForLedState(frequencyHz) {
  const frequency = Number(frequencyHz);
  if (!Number.isFinite(frequency)) return "-";
  return `${(frequency / 1000).toFixed(2).replace(".", ",")} kHz`;
}

function formatDutyForLedState(dutyPercent) {
  const duty = Number(dutyPercent);
  if (!Number.isFinite(duty)) return "-";
  return `${duty.toFixed(1).replace(".", ",")}`;
}

function commandError(code, message) {
  return {
    ok: false,
    errors: [{
      code,
      message,
      line: 1,
      column: 1,
    }],
  };
}

function getMeasurementPointValue(pointId, traceEntry) {
  if (pointId === "gpio-5") {
    return traceEntry.gpioVoltageV;
  }

  if (pointId === "gnd") {
    return 0;
  }

  return null;
}

function toScopeTrace(measurement, channelConfig) {
  if (!measurement || !Array.isArray(measurement.trace) || measurement.trace.length === 0) return [];

  const tip = channelConfig?.tipConnection;
  const reference = channelConfig?.referenceConnection;
  const mapped = [];

  for (const entry of measurement.trace) {
    const tipVoltage = getMeasurementPointValue(tip, entry);
    const referenceVoltage = getMeasurementPointValue(reference, entry);

    if (tipVoltage === null || referenceVoltage === null) {
      return [];
    }

    mapped.push({
      time: entry.time,
      value: Number((tipVoltage - referenceVoltage).toFixed(9)),
    });
  }

  return mapped;
}

function uniqueCodes(codes) {
  const set = new Set();
  const ordered = [];
  for (const code of codes) {
    if (!code || set.has(code)) continue;
    set.add(code);
    ordered.push(code);
  }
  return ordered;
}

function getFirstGreater(items, threshold) {
  for (const value of items) {
    if (value > threshold) return value;
  }
  return null;
}

function buildOscilloscopeReadout(measurement, labProject) {
  const scopeInstance = labProject?.instruments?.instances?.[OSCILLOSCOPE_INSTRUMENT_ID];
  const channel = scopeInstance?.channels?.[OSCILLOSCOPE_CHANNEL_ID] || {};
  const scopeSettings = {
    instrumentId: OSCILLOSCOPE_INSTRUMENT_ID,
    channelId: OSCILLOSCOPE_CHANNEL_ID,
    coupling: channel.coupling || OSCILLOSCOPE_DEFAULT_CHANNEL.coupling,
    probeFactor: channel.probeFactor ?? OSCILLOSCOPE_DEFAULT_CHANNEL.probeFactor,
    voltsPerDivision: channel.voltsPerDivision || OSCILLOSCOPE_DEFAULT_CHANNEL.voltsPerDivision,
    secondsPerDivision: channel.secondsPerDivision || OSCILLOSCOPE_DEFAULT_CHANNEL.secondsPerDivision,
    triggerSlope: channel.triggerSlope || OSCILLOSCOPE_DEFAULT_CHANNEL.triggerSlope,
    triggerLevel: channel.triggerLevel ?? OSCILLOSCOPE_DEFAULT_CHANNEL.triggerLevel,
    tipConnection: channel.tipConnection || null,
    referenceConnection: channel.referenceConnection || null,
    visibleTimeWindowUs: OSCILLOSCOPE_VISIBLE_WINDOW_US,
    horizontalDivisions: OSCILLOSCOPE_DIVISIONS_HORIZONTAL,
    verticalDivisions: OSCILLOSCOPE_DIVISIONS_VERTICAL,
    gridMinVoltage: OSCILLOSCOPE_VOLTAGE_LOW_DISPLAY,
    gridMaxVoltage: OSCILLOSCOPE_VOLTAGE_HIGH_DISPLAY,
  };

  const codes = [];
  if (!measurement) {
    codes.push("MEASUREMENT_TRACE_NOT_AVAILABLE");
  }

  if (!scopeSettings.tipConnection) {
    codes.push("PROBE_TIP_NOT_CONNECTED");
  }

  if (!scopeSettings.referenceConnection) {
    codes.push("PROBE_REFERENCE_NOT_CONNECTED");
  }

  const signalTrace = measurement ? toScopeTrace(measurement, scopeSettings) : [];

  if (!signalTrace.length) {
    return {
      ...scopeSettings,
      statusCodes: uniqueCodes(codes),
      signalTrace: [],
      minimumVoltage: null,
      maximumVoltage: null,
      peakToPeakVoltage: null,
      frequencyHz: null,
      periodUs: null,
      dutyCyclePercent: null,
      triggerTimeUs: null,
      measurementBus: {
        measurementPointId: scopeSettings.tipConnection,
        referencePointId: scopeSettings.referenceConnection,
        quantity: "voltage",
        unit: "V",
        virtualTimeBase: measurement?.virtualTimeBase || PWM_TIMEBASE_MICROSECONDS,
        simulationDuration: measurement?.simulationDuration ?? 0,
        trace: signalTrace,
        modelVersions: {
          model: measurement?.modelVersions?.model,
          trace: measurement?.modelVersions?.trace,
          oscilloscope: OSCILLOSCOPE_INSTRUMENT_MODEL_VERSION,
        },
      },
    };
  }

  const values = signalTrace.map((entry) => entry.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const peakToPeak = Number((max - min).toFixed(9));

  const rising = [];
  const falling = [];
  const triggerLevel = scopeSettings.triggerLevel;

  for (let index = 1; index < signalTrace.length; index += 1) {
    const previous = signalTrace[index - 1];
    const current = signalTrace[index];
    if (previous.value <= triggerLevel && current.value > triggerLevel) rising.push(current.time);
    if (previous.value > triggerLevel && current.value <= triggerLevel) falling.push(current.time);
  }

  const firstTriggerUs = rising[0] || null;
  if (!firstTriggerUs) {
    codes.push("OSCILLOSCOPE_TRIGGER_NOT_FOUND");
  }

  let periodUs = null;
  let frequencyHz = null;
  let dutyCyclePercent = null;

  if (rising.length >= 2) {
    periodUs = toMicroseconds(rising[1] - rising[0]);
    const firstFallingAfterFirstRise = getFirstGreater(
      falling.filter((time) => time > rising[0]),
      rising[0]
    );
    const highDuration = firstFallingAfterFirstRise === null ? null : firstFallingAfterFirstRise - rising[0];
    if (highDuration !== null && periodUs > 0) {
      dutyCyclePercent = Number((100 * (highDuration / periodUs)).toFixed(1));
    }

    frequencyHz = periodUs > 0 ? Number((1_000_000 / periodUs).toFixed(9)) : null;
  }

  if (rising.length < 2) {
    codes.push("OSCILLOSCOPE_PERIOD_NOT_MEASURABLE");
  }

  return {
    ...scopeSettings,
    statusCodes: uniqueCodes(codes),
    signalTrace,
    minimumVoltage: Number(min.toFixed(9)),
    maximumVoltage: Number(max.toFixed(9)),
    peakToPeakVoltage: peakToPeak,
    frequencyHz,
    periodUs,
    dutyCyclePercent,
    triggerTimeUs: firstTriggerUs,
    measurementBus: {
      measurementPointId: scopeSettings.tipConnection,
      referencePointId: scopeSettings.referenceConnection,
      quantity: "voltage",
      unit: "V",
      virtualTimeBase: measurement.virtualTimeBase,
      simulationDuration: measurement.simulationDuration,
      trace: signalTrace,
      modelVersions: {
        model: measurement.modelVersions.model,
        trace: measurement.modelVersions.trace,
        oscilloscope: OSCILLOSCOPE_INSTRUMENT_MODEL_VERSION,
      },
    },
    modelVersions: {
      oscilloscope: OSCILLOSCOPE_INSTRUMENT_MODEL_VERSION,
    },
    warnings: uniqueCodes(codes.filter((code) => code.startsWith("OSCILLOSCOPE_"))),
  };
}

function buildPwmTrace({ running, configured, frequencyHz, dutyPercent }, model, finalStaticValue) {
  const highCurrentA = Math.max(0, (model.gpioVoltageHigh - model.ledForwardVoltage) / model.resistorOhm);

  if (!configured || !running) {
    return {
      simulationDurationUs: 0,
      periodUs: null,
      dutyPercent: null,
      highDurationUs: null,
      lowDurationUs: null,
      trace: [{
        time: 0,
        logicLevel: finalStaticValue,
        gpioVoltageV: finalStaticValue === "HIGH" ? model.gpioVoltageHigh : model.gpioVoltageLow,
        ledCurrentA: finalStaticValue === "HIGH" ? Number(highCurrentA.toFixed(9)) : 0,
      }],
      meanCurrentA: finalStaticValue === "HIGH" ? highCurrentA : 0,
      highCurrentA,
    };
  }

  const periodUs = 1_000_000 / frequencyHz;
  const highDurationUs = periodUs * (dutyPercent / 100);
  const lowDurationUs = periodUs - highDurationUs;
  const simulationDurationUs = periodUs * PWM_CYCLES_FOR_SIMULATION;

  const firstState = dutyPercent === 0 ? "LOW" : "HIGH";
  const points = [];

  const append = (time, level) => {
    const normalizedTime = toMicroseconds(time);
    const current = level === "HIGH" ? highCurrentA : 0;
    const voltageV = level === "HIGH" ? model.gpioVoltageHigh : model.gpioVoltageLow;
    const previous = points[points.length - 1];

    if (previous && previous.time === normalizedTime && previous.logicLevel === level) {
      return;
    }

    points.push({
      time: normalizedTime,
      logicLevel: level,
      gpioVoltageV: Number(voltageV.toFixed(4)),
      ledCurrentA: Number(current.toFixed(9)),
    });
  };

  append(0, firstState);

  if (highDurationUs > 0 && lowDurationUs > 0) {
    for (let cycle = 0; cycle < PWM_CYCLES_FOR_SIMULATION; cycle += 1) {
      const cycleStartUs = cycle * periodUs;
      const lowEdgeUs = cycleStartUs + highDurationUs;
      append(lowEdgeUs, "LOW");
      if (cycle < PWM_CYCLES_FOR_SIMULATION - 1) {
        append(cycleStartUs + periodUs, "HIGH");
      }
    }
  }

  const finalLevel = points[points.length - 1].logicLevel;
  append(simulationDurationUs, finalLevel);

  return {
    simulationDurationUs,
    periodUs: toMicroseconds(periodUs),
    dutyPercent,
    highDurationUs: toMicroseconds(highDurationUs),
    lowDurationUs: toMicroseconds(lowDurationUs),
    trace: points,
    meanCurrentA: highCurrentA * (dutyPercent / 100),
    highCurrentA,
  };
}

function executeRuntime(program, sourceCode, modelValues) {
  const model = cloneModel(modelValues);
  const mcuState = {
    configuredAsOutput: false,
    value: "LOW",
    pwm: {
      configured: false,
      running: false,
      pin: model.gpioPin,
      frequencyHz: null,
      dutyPercent: null,
      phaseOriginUs: 0,
    },
  };
  const warnings = [];

  function stopPwm() {
    mcuState.pwm.running = false;
    mcuState.pwm.phaseOriginUs = 0;
  }

  function execCommand(command) {
    if (command.kind === "pinMode") {
      if (command.pin !== model.gpioPin) {
        const position = command.start;
        const location = toLineColumn(position, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "GPIO_PIN_NOT_AVAILABLE",
            message: `Pin ${command.pin} ist im Durchstich nicht verfügbar.`,
            line: location.line,
            column: location.column,
          }],
        };
      }
      mcuState.configuredAsOutput = true;
      return { ok: true };
    }

    if (command.kind === "digitalWrite") {
      if (command.pin !== model.gpioPin) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "GPIO_PIN_NOT_AVAILABLE",
            message: `Pin ${command.pin} ist im Durchstich nicht verfügbar.`,
            line: location.line,
            column: location.column,
          }],
        };
      }
      if (!mcuState.configuredAsOutput) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "GPIO_NOT_CONFIGURED_AS_OUTPUT",
            message: "digitalWrite wurde vor pinMode(5, OUTPUT) ausgeführt.",
            line: location.line,
            column: location.column,
          }],
        };
      }
      stopPwm();
      mcuState.value = command.value;
      return { ok: true };
    }

    if (command.kind === "pwmConfigure") {
      if (command.pin !== model.gpioPin) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "PWM_PIN_NOT_AVAILABLE",
            message: `Pin ${command.pin} ist im Durchstich nicht verfügbar.`,
            line: location.line,
            column: location.column,
          }],
        };
      }
      if (!mcuState.configuredAsOutput) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "PWM_PIN_NOT_CONFIGURED_AS_OUTPUT",
            message: "pwmConfigure wurde vor pinMode(5, OUTPUT) ausgeführt.",
            line: location.line,
            column: location.column,
          }],
        };
      }
      mcuState.pwm.configured = true;
      mcuState.pwm.frequencyHz = command.frequencyHz;
      mcuState.pwm.dutyPercent = command.dutyPercent;
      mcuState.pwm.running = false;
      return { ok: true };
    }

    if (command.kind === "pwmStart") {
      if (command.pin !== model.gpioPin) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "PWM_PIN_NOT_AVAILABLE",
            message: `Pin ${command.pin} ist im Durchstich nicht verfügbar.`,
            line: location.line,
            column: location.column,
          }],
        };
      }
      if (!mcuState.configuredAsOutput) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "PWM_PIN_NOT_CONFIGURED_AS_OUTPUT",
            message: "pwmStart wurde vor pinMode(5, OUTPUT) ausgeführt.",
            line: location.line,
            column: location.column,
          }],
        };
      }
      if (!mcuState.pwm.configured || mcuState.pwm.frequencyHz === null || mcuState.pwm.dutyPercent === null) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "PWM_CONFIGURATION_REQUIRED",
            message: "pwmStart wurde vor pwmConfigure(5, f, duty) ausgeführt.",
            line: location.line,
            column: location.column,
          }],
        };
      }
      mcuState.pwm.running = true;
      mcuState.pwm.phaseOriginUs = 0;
      mcuState.value = "HIGH";
      return { ok: true };
    }

    if (command.kind === "pwmStop") {
      if (command.pin !== model.gpioPin) {
        const location = toLineColumn(command.start, lineStarts(sourceCode));
        return {
          ok: false,
          errors: [{
            code: "PWM_PIN_NOT_AVAILABLE",
            message: `Pin ${command.pin} ist im Durchstich nicht verfügbar.`,
            line: location.line,
            column: location.column,
          }],
        };
      }
      stopPwm();
      mcuState.value = "LOW";
      return { ok: true };
    }

    return { ok: true };
  }

  for (const command of program.setup) {
    const execution = execCommand(command);
    if (!execution.ok) return execution;
  }
  for (const command of program.loop) {
    const execution = execCommand(command);
    if (!execution.ok) return execution;
  }

  const highCurrentA = Math.max(0, (model.gpioVoltageHigh - model.ledForwardVoltage) / model.resistorOhm);
  const pwmTrace = buildPwmTrace(
    {
      running: mcuState.pwm.running,
      configured: mcuState.pwm.configured,
      frequencyHz: mcuState.pwm.frequencyHz,
      dutyPercent: mcuState.pwm.dutyPercent,
    },
    model,
    mcuState.value
  );

  const trace = pwmTrace.trace;
  const current = trace.length ? trace[trace.length - 1].ledCurrentA : (mcuState.value === "HIGH" ? highCurrentA : 0);

  const finalState = trace.length ? trace[trace.length - 1].logicLevel : mcuState.value;
  const isPulsing = mcuState.pwm.running && mcuState.pwm.configured;
  const warningCurrentA = isPulsing ? highCurrentA : current;
  if (warningCurrentA > model.maxGpioSourceCurrentA) warnings.push("GPIO_SOURCE_CURRENT_EXCEEDED");
  if (warningCurrentA > model.maxLedCurrentA) warnings.push("LED_CURRENT_EXCEEDED");
  const ledState = isPulsing
    ? `pulst mit ${formatFrequencyForLedState(mcuState.pwm.frequencyHz)} · mittlerer Tastgrad ${formatDutyForLedState(mcuState.pwm.dutyPercent)} %`
    : finalState === "HIGH" ? "leuchtet" : "aus";

  const runId = `elab-ds-001-${makeRuntimeSourceHash(`${sourceCode}|${JSON.stringify(model)}`)}`;

  return {
    ok: true,
    measurement: {
      simulationRunId: runId,
      virtualTime: 0,
      virtualTimeBase: PWM_TIMEBASE_MICROSECONDS,
      simulationDuration: toMicroseconds(pwmTrace.simulationDurationUs),
      gpio: {
        pin: model.gpioPin,
        logicLevel: finalState,
        voltageV: Number((finalState === "HIGH" ? model.gpioVoltageHigh : model.gpioVoltageLow).toFixed(4)),
      },
      branch: {
        ledCurrentA: Number(current.toFixed(9)),
      },
      led: {
        state: ledState,
        highCurrentA: Number(pwmTrace.highCurrentA.toFixed(9)),
        meanCurrentA: Number(pwmTrace.meanCurrentA.toFixed(9)),
      },
      pwm: {
        pin: model.gpioPin,
        running: isPulsing,
        frequencyHz: mcuState.pwm.configured ? mcuState.pwm.frequencyHz : null,
        period: pwmTrace.periodUs,
        dutyPercent: pwmTrace.dutyPercent,
        highDuration: pwmTrace.highDurationUs,
        lowDuration: pwmTrace.lowDurationUs,
        phaseOrigin: mcuState.pwm.phaseOriginUs,
      },
      trace,
      warnings,
      modelVersions: {
        model: model.mcuVersion,
        formula: "I_LED = max(0, (U_GPIO - U_F_LED) / R)",
        trace: "v1",
      },
    },
  };
}

export function runThroughputSimulation({ sourceFile, modelValues }) {
  const source = normalizeSource(sourceFile);
  const parsed = parseThroughputProgram(source);
  if (!parsed.ok) {
    return {
      ok: false,
      errors: parsed.errors,
      measurement: null,
    };
  }
  return executeRuntime(parsed.program, source, modelValues || MODEL_VALUES);
}

export function createThroughputRuntime({ sourceFile = ELAB_DS_001_START_CODE, modelValues } = {}) {
  const model = cloneModel(modelValues || MODEL_VALUES);
  let resetSourceFile = normalizeSource(sourceFile);
  let snapshot = {
    sourceFile: resetSourceFile,
    measurement: null,
    error: null,
    labProject: createDefaultLabProject(resetSourceFile, model),
  };

  function resetToSource(source) {
    snapshot = {
      ...snapshot,
      sourceFile: normalizeSource(source),
      measurement: null,
      error: null,
      labProject: {
        ...snapshot.labProject,
        controller: {
          ...snapshot.labProject.controller,
          sourceFile: normalizeSource(source),
        },
      },
    };
  }

  function applyAttachProbe(command) {
    const instrument = snapshot.labProject.instruments?.instances?.[command.instrumentId];
    if (!instrument) {
      return commandError("INSTRUMENT_NOT_FOUND", `Instrument ${command.instrumentId} ist nicht vorhanden.`);
    }

    const channel = instrument.channels?.[command.channelId];
    if (!channel) {
      return commandError("INSTRUMENT_CHANNEL_NOT_FOUND", `Kanal ${command.channelId} ist bei ${command.instrumentId} nicht vorhanden.`);
    }

    if (command.lead !== "tip" && command.lead !== "reference") {
      return commandError("PROBE_LEAD_NOT_SUPPORTED", `Leitung ${command.lead} ist für diesen Kanal nicht unterstützt.`);
    }

    if (!snapshot.labProject.measurementPoints?.[command.measurementPointId]) {
      return commandError("MEASUREMENT_POINT_NOT_FOUND", `Messpunkt ${command.measurementPointId} ist nicht vorhanden.`);
    }

    if (command.lead === "tip") {
      channel.tipConnection = command.measurementPointId;
    } else {
      channel.referenceConnection = command.measurementPointId;
    }

    return { ok: true };
  }

  function applyDetachProbe(command) {
    const instrument = snapshot.labProject.instruments?.instances?.[command.instrumentId];
    if (!instrument) {
      return commandError("INSTRUMENT_NOT_FOUND", `Instrument ${command.instrumentId} ist nicht vorhanden.`);
    }

    const channel = instrument.channels?.[command.channelId];
    if (!channel) {
      return commandError("INSTRUMENT_CHANNEL_NOT_FOUND", `Kanal ${command.channelId} ist bei ${command.instrumentId} nicht vorhanden.`);
    }

    if (command.lead !== "tip" && command.lead !== "reference") {
      return commandError("PROBE_LEAD_NOT_SUPPORTED", `Leitung ${command.lead} ist für diesen Kanal nicht unterstützt.`);
    }

    if (command.lead === "tip") {
      channel.tipConnection = null;
    } else {
      channel.referenceConnection = null;
    }

    return { ok: true };
  }

  function getScopeSnapshot() {
    return buildOscilloscopeReadout(snapshot.measurement, snapshot.labProject);
  }

  function dispatch(command) {
    if (!command || typeof command.type !== "string") {
      return {
        ok: false,
        errors: [{
          code: "PROGRAM_SYNTAX_ERROR",
          message: "Ungültiger Command.",
          line: 1,
          column: 1,
        }],
      };
    }

    if (command.type === COMMAND_TYPES.UpdateSourceFile) {
      resetToSource(command.sourceFile ?? "");
      return { ok: true, sourceFile: snapshot.sourceFile };
    }

    if (command.type === COMMAND_TYPES.LoadLabExample) {
      if (!command.exampleId || command.exampleId !== PWM_EXAMPLES.pwmThroughput) {
        const location = toLineColumn(0, lineStarts(sourceFile));
        return {
          ok: false,
          errors: [{
            code: "PROGRAM_SYNTAX_ERROR",
            message: "Unbekannte Beispiel-ID für LoadLabExample.",
            line: location.line,
            column: location.column,
          }],
        };
      }
      resetSourceFile = normalizeSource(ELAB_DS_002_PWM_START_CODE);
      resetToSource(ELAB_DS_002_PWM_START_CODE);
      return { ok: true, sourceFile: snapshot.sourceFile, measurement: snapshot.measurement };
    }

    if (command.type === COMMAND_TYPES.StartSimulation) {
      const execution = runThroughputSimulation({ sourceFile: snapshot.sourceFile, modelValues: model });
      if (!execution.ok) {
        snapshot = {
          ...snapshot,
          error: execution.errors,
        };
        return {
          ok: false,
          errors: execution.errors,
          sourceFile: snapshot.sourceFile,
          measurement: snapshot.measurement,
        };
      }
      snapshot = {
        sourceFile: snapshot.sourceFile,
        measurement: execution.measurement,
        error: null,
        labProject: snapshot.labProject,
      };
      return {
        ok: true,
        sourceFile: snapshot.sourceFile,
        measurement: snapshot.measurement,
      };
    }

    if (command.type === COMMAND_TYPES.AttachProbe) {
      const applied = applyAttachProbe(command);
      if (!applied.ok) {
        return {
          ok: false,
          errors: applied.errors,
          sourceFile: snapshot.sourceFile,
          measurement: snapshot.measurement,
        };
      }

      return {
        ok: true,
        sourceFile: snapshot.sourceFile,
        measurement: snapshot.measurement,
      };
    }

    if (command.type === COMMAND_TYPES.DetachProbe) {
      const applied = applyDetachProbe(command);
      if (!applied.ok) {
        return {
          ok: false,
          errors: applied.errors,
          sourceFile: snapshot.sourceFile,
          measurement: snapshot.measurement,
        };
      }

      return {
        ok: true,
        sourceFile: snapshot.sourceFile,
        measurement: snapshot.measurement,
      };
    }

    if (command.type === COMMAND_TYPES.ResetSimulation) {
      const labProject = snapshot.labProject;
      snapshot = {
        sourceFile: resetSourceFile,
        measurement: null,
        error: null,
        labProject: {
          ...labProject,
          controller: {
            ...labProject.controller,
            sourceFile: resetSourceFile,
          },
        },
      };
      return { ok: true, sourceFile: snapshot.sourceFile, measurement: snapshot.measurement };
    }

    return {
      ok: false,
      errors: [{
        code: "PROGRAM_SYNTAX_ERROR",
        message: `Unbekannter Command ${command.type}.`,
        line: 1,
        column: 1,
      }],
    };
  }

  function getSnapshot() {
    return cloneModelLike({
      sourceFile: snapshot.sourceFile,
      measurement: snapshot.measurement,
      error: snapshot.error,
      model,
      labProject: snapshot.labProject,
      scope: getScopeSnapshot(),
    });
  }

  return { dispatch, getSnapshot };
}
