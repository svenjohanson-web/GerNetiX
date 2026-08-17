import { ADC_QUANTIZER_MODEL, quantizeAdcSample } from "../peripherals/adc-quantizer.mjs";

export const ADC_PROGRAM_RUNTIME_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-virtual-mcu-adc-program-runtime",
  modelVersion: "1.0.0",
  architecture: "interpreter",
  inputQuantity: "arduino-source-code",
  inputUnit: "code",
  outputQuantity: "adc-code-and-quantized-voltage",
  outputUnit: "code/V",
  dependencies: Object.freeze({
    adcQuantizerModelId: ADC_QUANTIZER_MODEL.modelId,
    adcQuantizerModelVersion: ADC_QUANTIZER_MODEL.modelVersion,
  }),
});

export const ADC_PROGRAM_START_CODE = `int adcValue = 0;

void setup() {
  pinMode(A0, INPUT);
}

void loop() {
  adcValue = analogRead(A0);
}`;

const MAX_SOURCE_LENGTH = 4096;
const MAX_STATEMENT_COUNT = 16;

function normalizeSource(sourceCode) {
  return String(sourceCode ?? "").replace(/\r\n/g, "\n");
}

function syntaxError(source, position, code, message) {
  const location = toLineColumn(position, lineStarts(source));
  return {
    code,
    message,
    line: location.line,
    column: location.column,
    position,
  };
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

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
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
          error: syntaxError(source, commentStart, "ADC_PROGRAM_SYNTAX_ERROR", "Blockkommentar ist nicht geschlossen."),
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
      error: { code: "ADC_PROGRAM_SYNTAX_ERROR", message: `Funktion ${functionName}() fehlt.`, line: 1, column: 1 },
    };
  }
  if (matches.length > 1) {
    const location = toLineColumn(matches[1].index, lineStarts(source));
    return {
      ok: false,
      error: { code: "ADC_PROGRAM_SYNTAX_ERROR", message: `Funktion ${functionName}() darf nur einmal vorkommen.`, line: location.line, column: location.column },
    };
  }

  const headerIndex = matches[0].index;
  const openBrace = source.indexOf("{", headerIndex);
  if (openBrace === -1) {
    const location = toLineColumn(headerIndex, lineStarts(source));
    return {
      ok: false,
      error: { code: "ADC_PROGRAM_SYNTAX_ERROR", message: `Funktion ${functionName}() hat keine geschlossene Klammer.`, line: location.line, column: location.column },
    };
  }

  let depth = 0;
  let cursor = openBrace;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "{") depth += 1;
    if (char === "}") {
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

  const location = toLineColumn(openBrace, lineStarts(source));
  return {
    ok: false,
    error: { code: "ADC_PROGRAM_SYNTAX_ERROR", message: `Funktion ${functionName}() hat keine geschlossene Klammer.`, line: location.line, column: location.column },
  };
}

function splitStatements(bodyText, bodyStartOffset, sourceForPosition) {
  const statements = [];
  let start = 0;

  for (let index = 0; index < bodyText.length; index += 1) {
    if (bodyText[index] !== ";") continue;
    const piece = bodyText.slice(start, index + 1).trim();
    if (piece.length) {
      statements.push({ text: piece.slice(0, -1).trim(), start: bodyStartOffset + start });
    }
    start = index + 1;
  }

  const trailing = bodyText.slice(start).trim();
  if (trailing.length) {
    const text = trailing.replace(/\s+$/g, "");
    if (text.length) {
      return {
        statements,
        error: syntaxError(sourceForPosition, bodyStartOffset + start, "ADC_PROGRAM_SYNTAX_ERROR", "Eine Anweisung ohne Abschluss-Semikolon ist ungültig."),
      };
    }
  }

  return { statements, error: null };
}

function parseVariableDeclaration(sourceText, sourceForPosition) {
  const declaration = "int adcValue = 0";
  const declarations = [];
  const split = splitStatements(sourceText, 0, sourceForPosition);
  if (split.error) return split;

  for (const statement of split.statements) {
    if (statement.text === declaration) {
      declarations.push(statement);
      continue;
    }
    return {
      statements: null,
      error: {
        code: "ADC_PROGRAM_SYNTAX_ERROR",
        message: "Nur die globale Deklaration int adcValue = 0; ist erlaubt.",
        line: toLineColumn(statement.start, lineStarts(sourceForPosition)).line,
        column: toLineColumn(statement.start, lineStarts(sourceForPosition)).column,
      },
    };
  }

  return {
    declarations,
    error: null,
  };
}

function parseCommand(statementText, statementStartOffset, sourceForPosition) {
  const pinModeMatch = /^pinMode\s*\(\s*([A-Za-z]\w*)\s*,\s*(INPUT)\s*\)$/i.exec(statementText);
  if (pinModeMatch) {
    return {
      ok: true,
      command: {
        kind: "pinMode",
        pin: pinModeMatch[1],
        mode: pinModeMatch[2].toUpperCase(),
        start: statementStartOffset,
      },
    };
  }

  const analogReadMatch = /^adcValue\s*=\s*analogRead\s*\(\s*([A-Za-z]\w*)\s*\)$/i.exec(statementText);
  if (analogReadMatch) {
    return {
      ok: true,
      command: {
        kind: "analogRead",
        pin: analogReadMatch[1],
        destination: "adcValue",
        start: statementStartOffset,
      },
    };
  }

  return {
    ok: false,
    error: syntaxError(sourceForPosition, statementStartOffset, "ADC_PROGRAM_SYNTAX_ERROR", "Ungültige Anweisung im Quelltext."),
  };
}

function parseStatements(bodyResult, sourceForPosition, functionName) {
  const split = splitStatements(bodyResult.body, bodyResult.bodyStart, sourceForPosition);
  if (split.error) return split;

  const commands = [];
  for (const statement of split.statements) {
    const parsed = parseCommand(statement.text, statement.start, sourceForPosition);
    if (!parsed.ok) return { statements: null, error: parsed.error };

    if (functionName === "setup") {
      if (parsed.command.kind !== "pinMode") {
        return {
          statements: null,
          error: syntaxError(
            sourceForPosition,
            statement.start,
            "ADC_PROGRAM_SYNTAX_ERROR",
            "In setup() ist nur pinMode(A0, INPUT) erlaubt."
          ),
        };
      }
      if (parsed.command.pin !== "A0") {
        return {
          statements: null,
          error: {
            code: "ADC_PROGRAM_PIN_NOT_AVAILABLE",
            message: `Pin ${parsed.command.pin} ist im Labor nicht verfügbar.`,
            line: toLineColumn(statement.start, lineStarts(sourceForPosition)).line,
            column: toLineColumn(statement.start, lineStarts(sourceForPosition)).column,
          },
        };
      }
      if (parsed.command.mode !== "INPUT") {
        return {
          statements: null,
          error: {
            code: "ADC_PROGRAM_SYNTAX_ERROR",
            message: "pinMode(A0, INPUT) ist im Analogeingangspfad erforderlich.",
            line: toLineColumn(statement.start, lineStarts(sourceForPosition)).line,
            column: toLineColumn(statement.start, lineStarts(sourceForPosition)).column,
          },
        };
      }
    }

    if (functionName === "loop") {
      if (parsed.command.kind !== "analogRead") {
        return {
          statements: null,
          error: syntaxError(
            sourceForPosition,
            statement.start,
            "ADC_PROGRAM_SYNTAX_ERROR",
            "In loop() ist nur adcValue = analogRead(A0) erlaubt."
          ),
        };
      }
      if (parsed.command.pin !== "A0") {
        return {
          statements: null,
          error: {
            code: "ADC_PROGRAM_PIN_NOT_AVAILABLE",
            message: `Pin ${parsed.command.pin} ist im Labor nicht verfügbar.`,
            line: toLineColumn(statement.start, lineStarts(sourceForPosition)).line,
            column: toLineColumn(statement.start, lineStarts(sourceForPosition)).column,
          },
        };
      }
      if (parsed.command.destination !== "adcValue") {
        return {
          statements: null,
          error: syntaxError(
            sourceForPosition,
            statement.start,
            "ADC_PROGRAM_SYNTAX_ERROR",
            "analogRead muss in adcValue gespeichert werden."
          ),
        };
      }
    }

    if (parsed.command) {
      commands.push(parsed.command);
    }
  }

  return { statements: commands, error: null };
}

function makeSourceHash(source) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function parseAdcProgram(sourceFile) {
  const source = normalizeSource(sourceFile);

  if (source.length > MAX_SOURCE_LENGTH) {
    const location = toLineColumn(0, lineStarts(source));
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [{
        code: "ADC_PROGRAM_SOURCE_TOO_LARGE",
        message: "Der Quellcode ist größer als 4.096 Zeichen.",
        line: location.line,
        column: location.column,
      }],
    };
  }

  const stripped = stripComments(source);
  if (!stripped.ok) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [stripped.error],
    };
  }

  const cleaned = stripped.source;
  const setup = extractFunction(cleaned, "setup");
  if (!setup.ok) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [setup.error],
    };
  }

  const loop = extractFunction(cleaned, "loop");
  if (!loop.ok) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [loop.error],
    };
  }

  if (setup.headerStart > loop.headerStart) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [syntaxError(cleaned, loop.headerStart, "ADC_PROGRAM_SYNTAX_ERROR", "setup muss vor loop stehen.")],
    };
  }

  if (cleaned.slice(setup.end, loop.headerStart).trim().length) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [syntaxError(cleaned, setup.end, "ADC_PROGRAM_SYNTAX_ERROR", "Unbekannter Code zwischen setup und loop.")],
    };
  }

  if (cleaned.slice(loop.end).trim().length) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [syntaxError(cleaned, loop.end, "ADC_PROGRAM_SYNTAX_ERROR", "Nach loop sind keine Konstrukte erlaubt.")],
    };
  }

  const declarations = parseVariableDeclaration(cleaned.slice(0, setup.headerStart), cleaned);
  if (declarations.error) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [declarations.error],
    };
  }
  if (declarations.declarations.length !== 1) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [{
        code: "ADC_PROGRAM_SYNTAX_ERROR",
        message: "Die globale Deklaration int adcValue = 0; muss genau einmal vorkommen.",
        line: 1,
        column: 1,
      }],
    };
  }

  const parsedSetup = parseStatements(setup, cleaned, "setup");
  if (parsedSetup.error) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [parsedSetup.error],
    };
  }

  const parsedLoop = parseStatements(loop, cleaned, "loop");
  if (parsedLoop.error) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [parsedLoop.error],
    };
  }

  const statementCount = parsedSetup.statements.length + parsedLoop.statements.length;
  if (statementCount > MAX_STATEMENT_COUNT) {
    const position = parsedLoop.statements.length
      ? parsedLoop.statements[MAX_STATEMENT_COUNT]?.start || loop.end
      : loop.end;
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [syntaxError(cleaned, position, "ADC_PROGRAM_STATEMENT_LIMIT_EXCEEDED", "Mehr als 16 Anweisungen sind nicht zulässig.")],
    };
  }

  return {
    ok: true,
    program: {
      setup: parsedSetup.statements,
      loop: parsedLoop.statements,
      sourceHash: makeSourceHash(source),
    },
  };
}

function normalizeAnalogInputs(analogInputs) {
  if (!analogInputs || typeof analogInputs !== "object") return undefined;
  if (!Object.hasOwn(analogInputs, "A0")) return undefined;
  return analogInputs.A0;
}

export function executeAdcProgram({
  sourceFile,
  analogInputs,
  referenceVoltageV = 3.3,
  resolutionBits = 12,
}) {
  const parsed = parseAdcProgram(sourceFile);
  if (!parsed.ok) {
    return {
      ok: false,
      errorSource: parsed.errorSource,
      errors: parsed.errors,
      warnings: [],
      result: null,
    };
  }

  const inputVoltage = normalizeAnalogInputs(analogInputs);
  if (!Number.isFinite(inputVoltage)) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [{
        code: "ADC_PROGRAM_ANALOG_INPUT_REQUIRED",
        message: "Analog-Eingang A0 muss einen endlichen Zahlenwert enthalten.",
        line: 1,
        column: 1,
      }],
    };
  }

  const state = {
    configuredAsInput: false,
  };

  for (const command of parsed.program.setup) {
    if (command.kind === "pinMode") {
      if (command.pin !== "A0") {
        const location = toLineColumn(command.start, lineStarts(normalizeSource(sourceFile)));
        return {
          ok: false,
          errorSource: "adc-program-runtime",
          errors: [{
            code: "ADC_PROGRAM_PIN_NOT_AVAILABLE",
            message: `Pin ${command.pin} ist im Labor nicht verfügbar.`,
            line: location.line,
            column: location.column,
          }],
        };
      }
      if (command.mode !== "INPUT") {
        const location = toLineColumn(command.start, lineStarts(normalizeSource(sourceFile)));
        return {
          ok: false,
          errorSource: "adc-program-runtime",
          errors: [{
            code: "ADC_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT",
            message: "analogRead wurde vor pinMode(A0, INPUT) ausgeführt.",
            line: location.line,
            column: location.column,
          }],
        };
      }
      state.configuredAsInput = true;
      continue;
    }

    if (command.kind !== "analogRead") {
      return {
        ok: false,
        errorSource: "adc-program-runtime",
        errors: [{
          code: "ADC_PROGRAM_SYNTAX_ERROR",
          message: "Ungültiger Befehl in setup().",
          line: 1,
          column: 1,
        }],
      };
    }
  }

  let lastResult = null;
  for (const command of parsed.program.loop) {
    if (command.kind === "analogRead") {
      if (command.pin !== "A0") {
        const location = toLineColumn(command.start, lineStarts(normalizeSource(sourceFile)));
        return {
          ok: false,
          errorSource: "adc-program-runtime",
          errors: [{
            code: "ADC_PROGRAM_PIN_NOT_AVAILABLE",
            message: `Pin ${command.pin} ist im Labor nicht verfügbar.`,
            line: location.line,
            column: location.column,
          }],
        };
      }
      if (!state.configuredAsInput) {
        const location = toLineColumn(command.start, lineStarts(normalizeSource(sourceFile)));
        return {
          ok: false,
          errorSource: "adc-program-runtime",
          errors: [{
            code: "ADC_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT",
            message: "analogRead wurde vor pinMode(A0, INPUT) ausgeführt.",
            line: location.line,
            column: location.column,
          }],
        };
      }

      const quantized = quantizeAdcSample({
        inputVoltageV: inputVoltage,
        referenceVoltageV,
        resolutionBits,
      });
      if (!quantized.ok) {
        return {
          ok: false,
          errorSource: "adc-quantizer",
          errors: quantized.errors,
        };
      }

      lastResult = {
        sourceHash: parsed.program.sourceHash,
        pinModes: { A0: "INPUT" },
        variables: { adcValue: quantized.result.code },
        adc: {
          pin: "A0",
          inputVoltageV: inputVoltage,
          referenceVoltageV,
          resolutionBits,
          code: quantized.result.code,
          quantizedVoltageV: quantized.result.quantizedVoltageV,
        },
        modelVersions: {
          runtime: ADC_PROGRAM_RUNTIME_MODEL.modelVersion,
          adcQuantizer: ADC_QUANTIZER_MODEL.modelVersion,
        },
        warningCodes: quantized.warnings,
      };
    }
  }

  if (lastResult === null) {
    return {
      ok: false,
      errorSource: "adc-program-runtime",
      errors: [{
        code: "ADC_PROGRAM_SYNTAX_ERROR",
        message: "Kein gültiger ADC-Leseaufruf in loop() gefunden.",
      }],
    };
  }

  return {
    ok: true,
    result: Object.freeze({
      sourceHash: lastResult.sourceHash,
      pinModes: Object.freeze({ A0: lastResult.pinModes.A0 }),
      variables: Object.freeze({ adcValue: lastResult.variables.adcValue }),
      adc: Object.freeze({
        pin: lastResult.adc.pin,
        inputVoltageV: lastResult.adc.inputVoltageV,
        referenceVoltageV: lastResult.adc.referenceVoltageV,
        resolutionBits: lastResult.adc.resolutionBits,
        code: lastResult.adc.code,
        quantizedVoltageV: lastResult.adc.quantizedVoltageV,
      }),
      modelVersions: Object.freeze({
        runtime: lastResult.modelVersions.runtime,
        adcQuantizer: lastResult.modelVersions.adcQuantizer,
      }),
    }),
    warnings: Object.freeze([...lastResult.warningCodes]),
  };
}
