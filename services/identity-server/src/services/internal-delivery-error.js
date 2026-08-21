"use strict";

// Der reine HTTP-Status verraet bei internen Zustellungen nicht, woran es lag.
// Gerade Auth-Fehler (403) unterscheiden sich nur im Fehlercode des Bodys.
async function describeDeliveryFailure(response) {
  let body;
  try { body = await response.json(); }
  catch { return ""; }
  const detail = [body?.error, body?.message]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" · ");
  return detail ? ` ${detail}` : "";
}

module.exports = { describeDeliveryFailure };
