"use strict";

// Erzeugt das Recovery-Schluesselpaar fuer Kundendaten-Sicherungen.
//
//   node tools/generate-backup-recovery-key.js \
//     --private-key-out <pfad-ausserhalb-des-repositorys> \
//     --public-key-out  <pfad-fuer-den-vps>
//
// Der private Schluessel wird ausschliesslich in die genannte Datei
// geschrieben, niemals nach stdout und niemals in das Repository. Er gehoert
// offline an mindestens zwei getrennte Verwahrorte; ohne ihn sind die
// Sicherungen absichtlich nicht lesbar.

const fs = require("node:fs");
const path = require("node:path");

const { generateRecoveryKeyPair, parsePrivateKeyFile, parsePublicKeyFile } = require("./backup/recovery-key");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Fehlender Wert fuer ${flag}`);
    if (flag === "--private-key-out") options.privateKeyOut = value;
    else if (flag === "--public-key-out") options.publicKeyOut = value;
    else throw new Error(`Unbekannte Option: ${flag}`);
  }
  if (!options.privateKeyOut || !options.publicKeyOut) {
    throw new Error("Verwendung: --private-key-out <pfad> --public-key-out <pfad>");
  }
  return options;
}

// Der private Schluessel darf nie an einem Ort landen, der mit dem Deployment
// oder dem Repository mitgereicht wird.
function assertPrivateKeyTargetIsOutsideRepository(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(REPOSITORY_ROOT, resolved);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    throw new Error(
      `Der private Recovery-Key darf nicht im Repository liegen: ${resolved}\n` +
        "Waehle einen Pfad ausserhalb des Projektverzeichnisses, zum Beispiel auf einem verschluesselten Offline-Datentraeger.",
    );
  }
}

function writeNewFile(target, content, mode) {
  const resolved = path.resolve(target);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, { flag: "wx", mode });
  return resolved;
}

function main(argv) {
  const options = parseArguments(argv);
  assertPrivateKeyTargetIsOutsideRepository(options.privateKeyOut);

  const keyPair = generateRecoveryKeyPair();
  const privatePath = writeNewFile(options.privateKeyOut, keyPair.privateKeyFile, 0o600);
  const publicPath = writeNewFile(options.publicKeyOut, keyPair.publicKeyFile, 0o644);

  // Beide Dateien werden sofort zurueckgelesen: ein Schluesselpaar, das sich
  // nicht wieder einlesen laesst, waere ein stiller Totalverlust.
  const restoredPrivate = parsePrivateKeyFile(fs.readFileSync(privatePath, "utf8"));
  const restoredPublic = parsePublicKeyFile(fs.readFileSync(publicPath, "utf8"));
  if (restoredPrivate.keyId !== keyPair.keyId || restoredPublic.keyId !== keyPair.keyId) {
    throw new Error("Das erzeugte Schluesselpaar liess sich nicht fehlerfrei zurueckgelesen.");
  }

  process.stdout.write(
    [
      `Recovery-Key erzeugt. Schluessel-ID: ${keyPair.keyId}`,
      `Privater Schluessel: ${privatePath} (Rechte 0600)`,
      `Oeffentlicher Schluessel: ${publicPath}`,
      "",
      "Naechste Schritte:",
      "  1. Den privaten Schluessel auf mindestens zwei getrennte, verschluesselte Offline-Verwahrorte bringen.",
      "     Ein Passwortmanager allein ist kein zweiter Verwahrort.",
      "  2. Die hier erzeugte private Schluesseldatei danach von diesem Rechner loeschen.",
      "  3. Nur den oeffentlichen Schluessel auf den VPS ausrollen.",
      "  4. Einen Restore-Test durchfuehren, bevor der Schluessel als verwahrt gilt.",
      "",
    ].join("\n"),
  );
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { assertPrivateKeyTargetIsOutsideRepository, main, parseArguments };
