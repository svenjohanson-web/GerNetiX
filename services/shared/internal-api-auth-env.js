"use strict";

const { readInternalApiAuthConfig } = require("./internal-api-auth");

const configuredVariables = [
  "INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON",
  "INTERNAL_API_SIGNING_KEY_ID",
  "INTERNAL_API_SIGNING_PRIVATE_KEY_B64",
];

function readOptionalInternalApiAuthConfig(env = process.env, serviceId) {
  const configured = configuredVariables.some((name) => String(env?.[name] || ""));
  if (!configured) return "";
  return readInternalApiAuthConfig(env, { serviceId });
}

module.exports = { readOptionalInternalApiAuthConfig };
