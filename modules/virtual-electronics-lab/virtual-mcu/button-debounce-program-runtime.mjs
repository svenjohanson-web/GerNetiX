import { debounceDigitalTrace, DIGITAL_TRACE_DEBOUNCE_MODEL } from "../input-models/digital-trace-debouncer.mjs";

export const BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-virtual-mcu-button-debounce-program-runtime",
  modelVersion: "1.0.0",
  architecture: "interpreter",
  inputQuantity: "arduino-source-code-and-measurement-trace",
  inputUnit: "code-and-sample-array-microseconds",
  outputQuantity: "debounced-digital-trace-and-button-state",
  outputUnit: "trace-and-state",
  dependencies: Object.freeze({
    digitalTraceDebouncerModelId: DIGITAL_TRACE_DEBOUNCE_MODEL.modelId,
    digitalTraceDebouncerModelVersion: DIGITAL_TRACE_DEBOUNCE_MODEL.modelVersion,
  }),
  supportedPin: Object.freeze([4]),
  supportedPinModes: Object.freeze(["INPUT_PULLUP"]),
  supportedLevels: Object.freeze(["HIGH", "LOW"]),
  limits: Object.freeze({
    maxSourceLength: 12_000,
  }),
});

export const BUTTON_DEBOUNCE_PROGRAM_START_CODE = `const unsigned long debounceUs = 700;
int buttonState = HIGH;
int lastRawState = HIGH;
unsigned long changedAtUs = 0;

void setup() {
  pinMode(4, INPUT_PULLUP);
}
void loop() {
  int rawState = digitalRead(4);
  if (rawState != lastRawState) {
    changedAtUs = micros();
    lastRawState = rawState;
  }
  if (micros() - changedAtUs >= debounceUs) {
    buttonState = rawState;
  }
}`;

const TARGET_PIN = 4;
const TARGET_PIN_MODE = "INPUT_PULLUP";
const LOW = "LOW";
const MIN_DEBOUNCE_WINDOW_US = 50;
const MAX_DEBOUNCE_WINDOW_US = 100_000;

function normalizeSource(sourceFile) {
  return String(sourceFile ?? "").replace(/\r\n/g, "\n");
}

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function toLineColumn(position, starts) {
  let low = 0;
  let high = starts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (starts[mid] <= position) {
      if (mid === starts.length - 1 || starts[mid + 1] > position) {
        return {
          line: mid + 1,
          column: position - starts[mid] + 1,
        };
      }
      low = mid + 1;
      continue;
    }
    high = mid - 1;
  }

  return {
    line: 1,
    column: position + 1,
  };
}

function makeSourceHash(source) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function clone(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => clone(entry));
  }

  if (value && typeof value === "object") {
    const copy = {};
    for (const key of Object.keys(value)) {
      copy[key] = clone(value[key]);
    }
    return copy;
  }

  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);
  for (const key of Object.keys(value)) {
    const child = value[key];
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return value;
}

function dedupeWarnings(warnings) {
  if (!Array.isArray(warnings)) {
    return Object.freeze([]);
  }

  const seen = new Set();
  const result = [];
  for (const warning of warnings) {
    if (!warning || typeof warning !== "object") {
      continue;
    }
    const key = `${warning.code || ""}|${warning.message || ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(clone(warning));
  }

  return Object.freeze(result);
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
          error: {
            code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
            message: "Blockkommentar ist nicht geschlossen.",
            ...toLineColumn(commentStart, lineStarts(source)),
            position: commentStart,
          },
        };
      }
      continue;
    }

    output += char;
    index += 1;
  }

  return { ok: true, source: output };
}

function findFunction(source, functionName) {
  const finder = new RegExp(`\\bvoid\\s+${functionName}\\s*\\(\\s*\\)\\s*\\{`, "g");
  const matches = [];
  for (const match of source.matchAll(finder)) {
    matches.push({ index: match.index });
  }
  return matches;
}

function extractFunction(source, functionName) {
  const matches = findFunction(source, functionName);
  if (!matches.length) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: `Funktion ${functionName}() fehlt.`,
        ...toLineColumn(0, lineStarts(source)),
      },
    };
  }

  if (matches.length > 1) {
    const duplicate = matches[1];
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: `Funktion ${functionName}() darf nur einmal vorkommen.`,
        ...toLineColumn(duplicate.index, lineStarts(source)),
        position: duplicate.index,
      },
    };
  }

  const headerIndex = matches[0].index;
  const openBrace = source.indexOf("{", headerIndex);
  if (openBrace === -1) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: `Funktion ${functionName}() hat keine geschlossene Klammer.`,
        ...toLineColumn(headerIndex, lineStarts(source)),
        position: headerIndex,
      },
    };
  }

  let depth = 0;
  let cursor = openBrace;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          ok: true,
          headerStart: headerIndex,
          bodyStart: openBrace + 1,
          bodyEnd: cursor,
          body: source.slice(openBrace + 1, cursor),
          end: cursor + 1,
        };
      }
    }
    cursor += 1;
  }

  return {
    ok: false,
    error: {
      code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
      message: `Funktion ${functionName}() hat keine geschlossene Klammer.`,
      ...toLineColumn(openBrace, lineStarts(source)),
      position: openBrace,
    },
  };
}

function splitStatements(bodyText, bodyStartOffset, sourceForPosition) {
  const statements = [];
  let start = 0;

  for (let index = 0; index < bodyText.length; index += 1) {
    if (bodyText[index] !== ";") {
      continue;
    }

    const text = bodyText.slice(start, index + 1).trim();
    if (text.length) {
      statements.push({
        text: text.slice(0, -1).trim(),
        start: bodyStartOffset + start,
      });
    }
    start = index + 1;
  }

  const trailing = bodyText.slice(start).trim();
  if (trailing.length) {
    const normalizedTrailing = trailing.replace(/\s+$/g, "");
    if (normalizedTrailing.length) {
      return {
        statements: null,
        error: {
          code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
          message: "Eine Anweisung ohne Abschluss-Semikolon ist ungültig.",
          ...toLineColumn(bodyStartOffset + start, lineStarts(sourceForPosition)),
          position: bodyStartOffset + start,
        },
      };
    }
  }

  return { statements, error: null };
}

function parseGlobalDeclarations(sourceText, sourceForPosition) {
  const split = splitStatements(sourceText, 0, sourceForPosition);
  if (split.error) {
    return { ok: false, error: split.error };
  }

  if (split.statements.length !== 4) {
    const position = split.statements.length ? split.statements[0].start : 0;
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Es müssen genau vier globale Deklarationen enthalten sein.",
        ...toLineColumn(position, lineStarts(sourceForPosition)),
        position,
      },
    };
  }

  const debounceMatch = /^const\s+unsigned\s+long\s+debounceUs\s*=\s*(\d+)$/u.exec(split.statements[0].text);
  if (!debounceMatch) {
    const first = split.statements[0];
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Die erste Deklaration muss const unsigned long debounceUs = <Ganzzahl> sein.",
        ...toLineColumn(first.start, lineStarts(sourceForPosition)),
        position: first.start,
      },
    };
  }

  const debounceUs = Number(debounceMatch[1]);
  if (!Number.isInteger(debounceUs) || debounceUs < MIN_DEBOUNCE_WINDOW_US || debounceUs > MAX_DEBOUNCE_WINDOW_US) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_DEBOUNCE_WINDOW_INVALID",
        message: "debounceUs muss eine Ganzzahl von 50 bis 100_000 sein.",
        ...toLineColumn(split.statements[0].start, lineStarts(sourceForPosition)),
        position: split.statements[0].start,
      },
    };
  }

  const buttonStateMatch = /^int\s+buttonState\s*=\s*HIGH$/u.exec(split.statements[1].text);
  if (!buttonStateMatch) {
    const second = split.statements[1];
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Die zweite Deklaration muss int buttonState = HIGH sein.",
        ...toLineColumn(second.start, lineStarts(sourceForPosition)),
        position: second.start,
      },
    };
  }

  const lastRawStateMatch = /^int\s+lastRawState\s*=\s*HIGH$/u.exec(split.statements[2].text);
  if (!lastRawStateMatch) {
    const third = split.statements[2];
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Die dritte Deklaration muss int lastRawState = HIGH sein.",
        ...toLineColumn(third.start, lineStarts(sourceForPosition)),
        position: third.start,
      },
    };
  }

  const changedAtMatch = /^unsigned\s+long\s+changedAtUs\s*=\s*0$/u.exec(split.statements[3].text);
  if (!changedAtMatch) {
    const fourth = split.statements[3];
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Die vierte Deklaration muss unsigned long changedAtUs = 0 sein.",
        ...toLineColumn(fourth.start, lineStarts(sourceForPosition)),
        position: fourth.start,
      },
    };
  }

  return {
    ok: true,
    declarations: {
      debounceUs,
    },
  };
}

function parseSetup(source, setup) {
  const split = splitStatements(setup.body, setup.bodyStart, source);
  if (split.error) {
    return { ok: false, error: split.error };
  }

  if (split.statements.length !== 1) {
    const statement = split.statements.length ? split.statements[0] : { start: setup.bodyStart };
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "setup() darf genau einen Befehl enthalten.",
        ...toLineColumn(statement.start, lineStarts(source)),
        position: statement.start,
      },
    };
  }

  const statement = split.statements[0].text;
  const pinModeMatch = /^pinMode\s*\(\s*(\d+)\s*,\s*(\w+)\s*\)$/u.exec(statement);
  if (!pinModeMatch) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "In setup() ist nur pinMode(4, INPUT_PULLUP) erlaubt.",
        ...toLineColumn(split.statements[0].start, lineStarts(source)),
        position: split.statements[0].start,
      },
    };
  }

  const configuredPin = Number(pinModeMatch[1]);
  if (configuredPin !== TARGET_PIN) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_PIN_NOT_AVAILABLE",
        message: `Pin ${pinModeMatch[1]} ist im Labor nicht verfügbar.`,
        ...toLineColumn(split.statements[0].start, lineStarts(source)),
        position: split.statements[0].start,
      },
    };
  }

  const configuredMode = pinModeMatch[2];
  if (configuredMode !== TARGET_PIN_MODE) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_PIN_MODE_NOT_SUPPORTED",
        message: "pinMode(4, INPUT_PULLUP) ist erforderlich.",
        ...toLineColumn(split.statements[0].start, lineStarts(source)),
        position: split.statements[0].start,
      },
    };
  }

  return {
    ok: true,
    command: {
      pin: configuredPin,
      mode: configuredMode,
    },
  };
}

function parseLoopBlock(statementsText, source, blockStart, expectedCount, lineMessage, invalidMessage) {
  const statements = splitStatements(statementsText, blockStart, source);
  if (statements.error) {
    return { ok: false, error: statements.error };
  }

  if (statements.statements.length !== expectedCount) {
    const statement = statements.statements.length ? statements.statements[0] : { start: blockStart };
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: lineMessage,
        ...toLineColumn(statement.start, lineStarts(source)),
        position: statement.start,
      },
    };
  }

  for (const statement of statements.statements) {
    if (!statement.text) {
      continue;
    }

    if (!invalidMessage || invalidMessage(statement.text)) {
      continue;
    }

    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: lineMessage,
        ...toLineColumn(statement.start, lineStarts(source)),
        position: statement.start,
      },
    };
  }

  return { ok: true, statements: statements.statements };
}

function parseLoop(source, loop) {
  const body = loop.body;
  const rawStateMatch = /^\s*int\s+rawState\s*=\s*digitalRead\s*\(\s*(\d+)\s*\)\s*;/u.exec(body);
  if (!rawStateMatch) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "In loop() ist die Initialisierung int rawState = digitalRead(4) erforderlich.",
        ...toLineColumn(loop.bodyStart, lineStarts(source)),
        position: loop.bodyStart,
      },
    };
  }

  const rawPin = Number(rawStateMatch[1]);
  if (rawPin !== TARGET_PIN) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_PIN_NOT_AVAILABLE",
        message: `digitalRead(${rawPin}) ist im Labor nicht verfügbar.`,
        ...toLineColumn(loop.bodyStart + rawStateMatch[0].indexOf("(") + 1, lineStarts(source)),
        position: loop.bodyStart + rawStateMatch[0].indexOf("(") + 1,
      },
    };
  }

  const afterRaw = body.slice(rawStateMatch[0].length);
  const firstIfMatch = /^\s*if\s*\(\s*rawState\s*!=\s*lastRawState\s*\)\s*\{([\s\S]*?)\}\s*/u.exec(afterRaw);
  if (!firstIfMatch) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "In loop() fehlt der rawState != lastRawState Block.",
        ...toLineColumn(loop.bodyStart + rawStateMatch[0].length, lineStarts(source)),
        position: loop.bodyStart + rawStateMatch[0].length,
      },
    };
  }

  const firstAfter = afterRaw.slice(firstIfMatch[0].length);
  const firstBlock = parseLoopBlock(
    firstIfMatch[1],
    source,
    loop.bodyStart + rawStateMatch[0].length + firstIfMatch[0].indexOf("{") + 1,
    2,
    "Der rawState-Zweig muss changedAtUs = micros(); lastRawState = rawState; enthalten.",
    (text) => /^(changedAtUs\s*=\s*micros\(\))|(lastRawState\s*=\s*rawState)$/u.test(text),
  );
  if (!firstBlock.ok) {
    return firstBlock;
  }

  if (firstBlock.statements[0].text !== "changedAtUs = micros()" || firstBlock.statements[1].text !== "lastRawState = rawState") {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Der rawState-Zweig enthält eine ungültige Reihenfolge oder Zuweisung.",
        ...toLineColumn(firstBlock.statements[0].start, lineStarts(source)),
        position: firstBlock.statements[0].start,
      },
    };
  }

  const debounceIfMatch = /^\s*if\s*\(\s*micros\s*\(\)\s*-\s*changedAtUs\s*>=\s*debounceUs\s*\)\s*\{([\s\S]*?)\}\s*$/u.exec(firstAfter);
  if (!debounceIfMatch) {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "In loop() fehlt der Vergleich micros() - changedAtUs >= debounceUs.",
        ...toLineColumn(loop.bodyStart + rawStateMatch[0].length + firstIfMatch[0].length, lineStarts(source)),
        position: loop.bodyStart + rawStateMatch[0].length + firstIfMatch[0].length,
      },
    };
  }

  const secondBlock = parseLoopBlock(
    debounceIfMatch[1],
    source,
    loop.bodyStart + rawStateMatch[0].length + firstIfMatch[0].length + debounceIfMatch[0].indexOf("{") + 1,
    1,
    "Der debounce-Zweig darf nur buttonState = rawState enthalten.",
    (text) => text === "buttonState = rawState",
  );
  if (!secondBlock.ok) {
    return secondBlock;
  }

  if (secondBlock.statements[0].text !== "buttonState = rawState") {
    return {
      ok: false,
      error: {
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Der debounce-Zweig muss buttonState = rawState setzen.",
        ...toLineColumn(secondBlock.statements[0].start, lineStarts(source)),
        position: secondBlock.statements[0].start,
      },
    };
  }

  return { ok: true };
}

function parseProgram(sourceFile) {
  const source = normalizeSource(sourceFile);
  if (typeof sourceFile !== "string" || source.trim().length === 0) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [{
        code: "BUTTON_DEBOUNCE_PROGRAM_SOURCE_REQUIRED",
        message: "sourceFile ist erforderlich.",
        line: 1,
        column: 1,
        position: 0,
      }],
    };
  }

  if (source.length > BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.limits.maxSourceLength) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [{
        code: "BUTTON_DEBOUNCE_PROGRAM_SOURCE_TOO_LARGE",
        message: "Der Quellcode ist größer als 12.000 Zeichen.",
        ...toLineColumn(0, lineStarts(source)),
      }],
    };
  }

  const stripped = stripComments(source);
  if (!stripped.ok) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [stripped.error],
    };
  }

  const cleaned = stripped.source;

  const setup = extractFunction(cleaned, "setup");
  if (!setup.ok) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [setup.error],
    };
  }

  const loop = extractFunction(cleaned, "loop");
  if (!loop.ok) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [loop.error],
    };
  }

  if (setup.headerStart > loop.headerStart) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [{
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "setup muss vor loop stehen.",
        ...toLineColumn(loop.headerStart, lineStarts(cleaned)),
        position: loop.headerStart,
      }],
    };
  }

  if (cleaned.slice(setup.end, loop.headerStart).trim().length) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [{
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Unbekannter Code zwischen setup und loop.",
        ...toLineColumn(setup.end, lineStarts(cleaned)),
        position: setup.end,
      }],
    };
  }

  if (cleaned.slice(loop.end).trim().length) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [{
        code: "BUTTON_DEBOUNCE_PROGRAM_SYNTAX_ERROR",
        message: "Nach loop sind keine Konstrukte erlaubt.",
        ...toLineColumn(loop.end, lineStarts(cleaned)),
        position: loop.end,
      }],
    };
  }

  const declarations = parseGlobalDeclarations(cleaned.slice(0, setup.headerStart), cleaned);
  if (!declarations.ok) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [declarations.error],
    };
  }

  const setupParsed = parseSetup(cleaned, setup);
  if (!setupParsed.ok) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [setupParsed.error],
    };
  }

  const loopParsed = parseLoop(cleaned, loop);
  if (!loopParsed.ok) {
    return {
      ok: false,
      errorSource: "button-debounce-program-runtime",
      errors: [loopParsed.error],
    };
  }

  return {
    ok: true,
    program: {
      sourceHash: makeSourceHash(source),
      debounceUs: declarations.declarations.debounceUs,
      source,
      setupPinMode: setupParsed.command,
    },
  };
}

function freezeMeasurementTrace(trace) {
  return deepFreeze(clone(trace));
}

export function executeButtonDebounceProgram(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return {
      ok: false,
      result: null,
      errorSource: "button-debounce-program-runtime",
      errors: [{
        code: "BUTTON_DEBOUNCE_PROGRAM_SOURCE_REQUIRED",
        message: "sourceFile ist erforderlich.",
        line: 1,
        column: 1,
        position: 0,
      }],
      warnings: Object.freeze([]),
    };
  }

  const parseResult = parseProgram(options.sourceFile);
  if (!parseResult.ok) {
    return deepFreeze({
      ok: false,
      result: null,
      errorSource: parseResult.errorSource,
      errors: deepFreeze(clone(parseResult.errors)),
      warnings: Object.freeze([]),
    });
  }

  const traceResult = debounceDigitalTrace({
    trace: options.measurementTrace,
    stableWindowUs: parseResult.program.debounceUs,
  });

  if (!traceResult.ok) {
    return deepFreeze({
      ok: false,
      result: null,
      errorSource: traceResult.errorSource || "digital-trace-debouncer",
      errors: deepFreeze(clone(traceResult.errors)),
      warnings: dedupeWarnings(traceResult.warnings),
    });
  }

  const debouncedTrace = traceResult.result.trace;
  const finalSample = debouncedTrace.at(-1);

  return {
    ok: true,
    result: deepFreeze({
      sourceHash: parseResult.program.sourceHash,
      debounceUs: parseResult.program.debounceUs,
      rawTrace: freezeMeasurementTrace(options.measurementTrace),
      debouncedTrace: deepFreeze(clone(debouncedTrace)),
      buttonState: finalSample ? finalSample.debouncedNormalizedValue : 0,
      buttonStateLogicLevel: finalSample ? finalSample.debouncedLogicLevel : LOW,
      modelId: BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.modelId,
      modelVersion: BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.modelVersion,
      modelVersions: Object.freeze({
        buttonDebounceProgramRuntime: BUTTON_DEBOUNCE_PROGRAM_RUNTIME_MODEL.modelVersion,
        digitalTraceDebouncer: DIGITAL_TRACE_DEBOUNCE_MODEL.modelVersion,
      }),
      units: Object.freeze({
        timeUs: "microseconds",
        rawLogicLevel: "binary",
        debouncedLogicLevel: "binary",
        debouncedNormalizedValue: "ratio",
      }),
    }),
    warnings: dedupeWarnings(traceResult.warnings),
  };
}
