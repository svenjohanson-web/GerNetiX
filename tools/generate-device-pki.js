#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : fallback;
}

const outputDirectory = path.resolve(argument("--out", path.join(process.cwd(), ".runtime", "device-pki")));
const openssl = argument("--openssl", process.env.OPENSSL_COMMAND || "openssl");
const files = ["device-ca-key.pem", "device-ca.pem", "ota-signing-key.pem", "ota-signing-public.pem"];

fs.mkdirSync(outputDirectory, { recursive: true });
for (const file of files) {
  if (fs.existsSync(path.join(outputDirectory, file))) {
    throw new Error(`Refusing to overwrite existing PKI file: ${path.join(outputDirectory, file)}`);
  }
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-pki-"));
const run = (...args) => {
  try {
    return execFileSync(openssl, args, { cwd: temporaryDirectory, stdio: "inherit" });
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`OpenSSL executable not found: ${openssl}. Install OpenSSL or pass --openssl <path>.`);
    }
    throw error;
  }
};

try {
  run("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "device-ca-key.pem");
  run(
    "req", "-x509", "-new", "-sha256", "-key", "device-ca-key.pem", "-out", "device-ca.pem",
    "-days", "3650", "-subj", "/CN=GerNetiX Device Issuing CA",
    "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign"
  );
  run("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "ota-signing-key.pem");
  run("pkey", "-in", "ota-signing-key.pem", "-pubout", "-out", "ota-signing-public.pem");

  for (const file of files) {
    const destination = path.join(outputDirectory, file);
    fs.copyFileSync(path.join(temporaryDirectory, file), destination, fs.constants.COPYFILE_EXCL);
    if (file.endsWith("-key.pem")) fs.chmodSync(destination, 0o600);
  }
  process.stdout.write(`GerNetiX P-256 PKI created in ${outputDirectory}\n`);
  process.stdout.write("Keep device-ca-key.pem and ota-signing-key.pem private and outside the repository.\n");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
