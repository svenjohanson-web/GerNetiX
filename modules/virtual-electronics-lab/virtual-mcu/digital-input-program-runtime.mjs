export const DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL = Object.freeze({
  modelId: "virtual-electronics-lab-virtual-mcu-digital-input-program-runtime",
  modelVersion: "1.1.0",
  architecture: "interpreter",
  inputQuantity: "arduino-source-code",
  inputUnit: "code",
  outputQuantity: "digital-state",
  outputUnit: "bool",
  limits: Object.freeze({
    maxSourceLength: 4096,
    maxRelevantStatements: 16,
  }),
  supportedPin: Object.freeze([4]),
  supportedPinModes: Object.freeze(["INPUT_PULLUP", "INPUT_PULLDOWN", "INPUT"]),
  supportedLevels: Object.freeze(["HIGH", "LOW"]),
});

export const DIGITAL_INPUT_PROGRAM_START_CODE = `int buttonState = LOW;

void setup() {
  pinMode(4, INPUT_PULLUP);
}

void loop() {
  buttonState = digitalRead(4);
}`;

const HIGH = "HIGH";
const LOW = "LOW";
const TARGET_PIN = 4;
const MAX_SOURCE_LENGTH = 4096;
const MAX_STATEMENT_COUNT = 16;

function normalizeSource(sourceCode) {
  if (typeof sourceCode !== "string") return "";
  return sourceCode.replace(/\r\n/g, "\n");
}

function syntaxError(source, position, code, message) {
  const starts = lineStarts(source);
  const location = toLineColumn(position, starts);
  return {
    code,
    message,
    line: location.line,
    column: location.column,
    position,
  };
}

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
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
          error: syntaxError(
            source,
            commentStart,
            "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
            "Blockkommentar ist nicht geschlossen.",
          ),
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
        code: "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
        message: `Funktion ${functionName}() fehlt.`,
        line: 1,
        column: 1,
      },
    };
  }
  if (matches.length > 1) {
    const location = toLineColumn(matches[1].index, lineStarts(source));
    return {
      ok: false,
      error: {
        code: "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
        message: `Funktion ${functionName}() darf nur einmal vorkommen.`,
        line: location.line,
        column: location.column,
        position: matches[1].index,
      },
    };
  }

  const headerIndex = matches[0].index;
  const openBrace = source.indexOf("{", headerIndex);
  if (openBrace === -1) {
    const location = toLineColumn(headerIndex, lineStarts(source));
    return {
      ok: false,
      error: {
        code: "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
        message: `Funktion ${functionName}() hat keine geschlossene Klammer.`,
        line: location.line,
        column: location.column,
        position: headerIndex,
      },
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
    error: {
      code: "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
      message: `Funktion ${functionName}() hat keine geschlossene Klammer.`,
      line: location.line,
      column: location.column,
      position: openBrace,
    },
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
        error: syntaxError(
          sourceForPosition,
          bodyStartOffset + start,
          "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
          "Eine Anweisung ohne Abschluss-Semikolon ist ungültig.",
        ),
      };
    }
  }

  return { statements, error: null };
}

function parseVariableDeclaration(sourceText, sourceForPosition) {
  const declarations = [];
  const split = splitStatements(sourceText, 0, sourceForPosition);
  if (split.error) return split;

  const declaration = "int buttonState = LOW";
  for (const statement of split.statements) {
    if (statement.text !== declaration) {
      const location = toLineColumn(statement.start, lineStarts(sourceForPosition));
      return {
        declarations: null,
        error: {
          code: "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
          message: "Nur die globale Deklaration int buttonState = LOW; ist erlaubt.",
          line: location.line,
          column: location.column,
          position: statement.start,
        },
      };
    }
    declarations.push(statement);
  }

  return {
    declarations,
    error: null,
  };
}

function parseCommand(statementText, sourceForPosition, statementStartOffset) {
  const pinModeMatch = /^pinMode\s*\(\s*(\d+)\s*,\s*(INPUT_PULLUP|INPUT_PULLDOWN|INPUT)\s*\)$/g.exec(statementText);
  if (pinModeMatch) {
    return {
      ok: true,
      command: {
        kind: "pinMode",
        pin: Number(pinModeMatch[1]),
        mode: pinModeMatch[2],
        start: statementStartOffset,
      },
    };
  }

  const digitalReadMatch = /^buttonState\s*=\s*digitalRead\s*\(\s*(\d+)\s*\)$/g.exec(statementText);
  if (digitalReadMatch) {
    return {
      ok: true,
      command: {
        kind: "digitalRead",
        pin: Number(digitalReadMatch[1]),
        destination: "buttonState",
        start: statementStartOffset,
      },
    };
  }

  return {
    ok: false,
    error: syntaxError(
      sourceForPosition,
      statementStartOffset,
      "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
      "Ungültige Anweisung im Quelltext.",
    ),
  };
}

function parseStatements(bodyResult, sourceForPosition, functionName, statementOffset) {
  const split = splitStatements(bodyResult.body, bodyResult.bodyStart, sourceForPosition);
  if (split.error) return split;

  if (statementOffset + split.statements.length > MAX_STATEMENT_COUNT) {
    const overflowIndex = MAX_STATEMENT_COUNT - statementOffset;
    const overflowStatement = split.statements[overflowIndex];
    const errorPosition = overflowStatement ? overflowStatement.start : bodyResult.bodyStart;
    return {
      statements: null,
      error: syntaxError(
        sourceForPosition,
        errorPosition,
        "DIGITAL_INPUT_PROGRAM_STATEMENT_LIMIT_EXCEEDED",
        "Mehr als 16 Anweisungen sind nicht zulässig.",
      ),
      statementCount: split.statements.length,
    };
  }

  const commands = [];
  for (const statement of split.statements) {
    const parsed = parseCommand(statement.text, sourceForPosition, statement.start);
    if (!parsed.ok) return { statements: null, error: parsed.error };

    if (functionName === "setup") {
      if (parsed.command.kind !== "pinMode") {
        return {
          statements: null,
          error: syntaxError(sourceForPosition, statement.start, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "In setup() ist nur pinMode(4, INPUT_PULLUP/PULLDOWN/INPUT) erlaubt."),
        };
      }

      if (parsed.command.pin !== TARGET_PIN) {
        return {
          statements: null,
          error: {
            code: "DIGITAL_INPUT_PROGRAM_PIN_NOT_AVAILABLE",
            message: `Pin ${parsed.command.pin} ist im Labor nicht verfügbar.`,
            ...toLineColumn(statement.start, lineStarts(sourceForPosition)),
            position: statement.start,
          },
        };
      }
    }

    if (functionName === "loop") {
      if (parsed.command.kind !== "digitalRead") {
        return {
          statements: null,
          error: syntaxError(sourceForPosition, statement.start, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "In loop() ist nur buttonState = digitalRead(4) erlaubt."),
        };
      }

      if (parsed.command.pin !== TARGET_PIN) {
        return {
          statements: null,
          error: {
            code: "DIGITAL_INPUT_PROGRAM_PIN_NOT_AVAILABLE",
            message: `Pin ${parsed.command.pin} ist im Labor nicht verfügbar.`,
            ...toLineColumn(statement.start, lineStarts(sourceForPosition)),
            position: statement.start,
          },
        };
      }

      if (parsed.command.destination !== "buttonState") {
        return {
          statements: null,
          error: syntaxError(sourceForPosition, statement.start, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "digitalRead muss in buttonState gespeichert werden."),
        };
      }
    }

    commands.push(parsed.command);
  }

  return {
    statements: commands,
    error: null,
    statementCount: split.statements.length,
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

function parseDigitalInputProgram(sourceFile) {
  const source = normalizeSource(sourceFile);

  if (!source || typeof sourceFile !== "string" || source.trim().length === 0) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_SOURCE_REQUIRED",
        message: "sourceFile ist erforderlich.",
        line: 1,
        column: 1,
        position: 0,
      }],
    };
  }

  if (source.length > MAX_SOURCE_LENGTH) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_SOURCE_TOO_LARGE",
        message: "Der Quellcode ist größer als 4.096 Zeichen.",
        line: 1,
        column: 1,
        position: 0,
      }],
    };
  }

  const stripped = stripComments(source);
  if (!stripped.ok) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [stripped.error],
    };
  }

  const cleaned = stripped.source;

  const setup = extractFunction(cleaned, "setup");
  if (!setup.ok) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [setup.error],
    };
  }

  const loop = extractFunction(cleaned, "loop");
  if (!loop.ok) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [loop.error],
    };
  }

  if (setup.headerStart > loop.headerStart) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [syntaxError(cleaned, loop.headerStart, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "setup muss vor loop stehen.")],
    };
  }

  if (cleaned.slice(setup.end, loop.headerStart).trim().length) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [syntaxError(cleaned, setup.end, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "Unbekannter Code zwischen setup und loop." )],
    };
  }

  if (cleaned.slice(loop.end).trim().length) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [syntaxError(cleaned, loop.end, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "Nach loop sind keine Konstrukte erlaubt.")],
    };
  }

  const declarations = parseVariableDeclaration(cleaned.slice(0, setup.headerStart), cleaned);
  if (declarations.error) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [declarations.error],
    };
  }

  if (declarations.declarations.length !== 1) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR",
        message: "Die globale Deklaration int buttonState = LOW; muss genau einmal vorkommen.",
        line: 1,
        column: 1,
        position: 0,
      }],
    };
  }

  const parsedSetup = parseStatements(setup, cleaned, "setup", 0);
  if (parsedSetup.error) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [parsedSetup.error],
    };
  }

  const parsedLoop = parseStatements(loop, cleaned, "loop", parsedSetup.statementCount || 0);
  if (parsedLoop.error) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [parsedLoop.error],
    };
  }

  if (parsedSetup.statements.length > 1) {
    const position = parsedSetup.statements.length
      ? parsedSetup.statements[0].start
      : setup.bodyStart;
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [syntaxError(cleaned, position, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "setup() darf genau einen Befehl enthalten.")],
    };
  }

  if (parsedLoop.statements.length !== 1) {
    const position = parsedLoop.statements.length
      ? parsedLoop.statements[0].start
      : loop.bodyStart;
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [syntaxError(cleaned, position, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR", "loop() muss exakt einen Befehl enthalten.")],
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

function evaluateButtonState(inputLevel, pullMode) {
  if (inputLevel === HIGH) {
    return {
      logicLevel: HIGH,
      normalizedValue: 1,
      pullMode,
    };
  }

  return {
    logicLevel: LOW,
    normalizedValue: 0,
    pullMode,
  };
}

export function executeDigitalInputProgram(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_SOURCE_REQUIRED",
        message: "sourceFile ist erforderlich.",
        line: 1,
        column: 1,
        position: 0,
      }],
      warnings: Object.freeze([]),
      result: null,
    };
  }

  const { sourceFile, digitalInputs } = options;

  const parsed = parseDigitalInputProgram(sourceFile);
  if (!parsed.ok) {
    return {
      ok: false,
      errorSource: parsed.errorSource,
      errors: parsed.errors,
      warnings: Object.freeze([]),
      result: null,
    };
  }

  const hasDigitalInputs = digitalInputs && typeof digitalInputs === "object" && !Array.isArray(digitalInputs);
  if (!hasDigitalInputs || !Object.hasOwn(digitalInputs, String(TARGET_PIN))) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_INPUT_REQUIRED",
        message: `digitalInputs muss den Pin ${TARGET_PIN} enthalten.`,
        line: 1,
        column: 1,
        position: 0,
      }],
      warnings: Object.freeze([]),
      result: null,
    };
  }

  const rawLevel = digitalInputs[String(TARGET_PIN)];
  if (rawLevel !== HIGH && rawLevel !== LOW) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_LEVEL_INVALID",
        message: `digitalInputs[${TARGET_PIN}] muss \"HIGH\" oder \"LOW\" sein.`,
        line: 1,
        column: 1,
        position: 0,
      }],
      warnings: Object.freeze([]),
      result: null,
    };
  }

  const setupCommand = parsed.program.setup[0];
  const loopCommand = parsed.program.loop[0];

  if (!setupCommand || setupCommand.pin !== TARGET_PIN) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_PIN_NOT_CONFIGURED_AS_INPUT",
        message: `pinMode für Pin ${TARGET_PIN} wurde nicht korrekt gesetzt.`,
        line: 1,
        column: 1,
        position: 0,
      }],
      warnings: Object.freeze([]),
      result: null,
    };
  }

  if (loopCommand.pin !== TARGET_PIN) {
    return {
      ok: false,
      errorSource: "digital-input-program-runtime",
      errors: [{
        code: "DIGITAL_INPUT_PROGRAM_PIN_NOT_AVAILABLE",
        message: `Pin ${loopCommand ? loopCommand.pin : TARGET_PIN} ist im Labor nicht verfügbar.`,
        line: 1,
        column: 1,
        position: 0,
      }],
      warnings: Object.freeze([]),
      result: null,
    };
  }

  const evaluation = evaluateButtonState(rawLevel, setupCommand.mode);

  return {
    ok: true,
    result: Object.freeze({
      sourceHash: parsed.program.sourceHash,
      pin: TARGET_PIN,
      pullMode: evaluation.pullMode,
      logicLevel: evaluation.logicLevel,
      normalizedValue: evaluation.normalizedValue,
      variables: Object.freeze({
        buttonState: evaluation.normalizedValue,
      }),
      modelId: DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelId,
      modelVersion: DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelVersion,
    }),
    warnings: Object.freeze([]),
  };
}
