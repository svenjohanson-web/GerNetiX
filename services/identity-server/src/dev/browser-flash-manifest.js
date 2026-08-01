function completeBrowserFlashDefinitions(runnerManifest = [], fallbackDefinitions = [], options = {}) {
  const definitions = new Map();
  const authoritativeFallbackNames = new Set(options.authoritativeFallbackNames || []);
  for (const item of runnerManifest) {
    const name = String(item?.name || "").trim();
    const address = Number(item?.address);
    if (!name || authoritativeFallbackNames.has(name) || !Number.isInteger(address) || address < 0 || definitions.has(name)) continue;
    definitions.set(name, address);
  }
  for (const [nameValue, addressValue] of fallbackDefinitions) {
    const name = String(nameValue || "").trim();
    const address = Number(addressValue);
    if (!name || !Number.isInteger(address) || address < 0 || definitions.has(name)) continue;
    definitions.set(name, address);
  }
  return [...definitions.entries()].sort((left, right) => left[1] - right[1]);
}

function esp32FirmwareAddress(buildConfig = {}) {
  const basisId = String(buildConfig.firmware_basis_id || "").trim();
  const variant = String(buildConfig.firmware_basis_variant || "full").trim().toLowerCase();
  return basisId === "gernetix-runtime-basissoftware" && variant !== "low"
    ? 0x20000
    : 0x10000;
}

function usesGerNetixOtaAppLayout(buildConfig = {}) {
  const basisId = String(buildConfig.firmware_basis_id || "").trim();
  const variant = String(buildConfig.firmware_basis_variant || "full").trim().toLowerCase();
  return basisId === "gernetix-runtime-basissoftware" && variant !== "low";
}

module.exports = { completeBrowserFlashDefinitions, esp32FirmwareAddress, usesGerNetixOtaAppLayout };
