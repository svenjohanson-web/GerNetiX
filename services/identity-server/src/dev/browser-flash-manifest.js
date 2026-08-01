function completeBrowserFlashDefinitions(runnerManifest = [], fallbackDefinitions = []) {
  const definitions = new Map();
  for (const item of runnerManifest) {
    const name = String(item?.name || "").trim();
    const address = Number(item?.address);
    if (!name || !Number.isInteger(address) || address < 0 || definitions.has(name)) continue;
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

module.exports = { completeBrowserFlashDefinitions };
