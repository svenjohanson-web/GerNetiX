#include "gernetix_flashbox_display.h"

#include "gernetix_flashbox_config.h"

namespace {

String currentHeadline;
String currentDetail;

void statusFallback(const String& channel, const String& headline, const String& detail) {
  currentHeadline = headline;
  currentDetail = detail;

  Serial.print("[flashbox-status:");
  Serial.print(channel);
  Serial.print("] ");
  Serial.print(headline);
  if (detail.length()) {
    Serial.print(" - ");
    Serial.print(detail);
  }
  Serial.println();
}

}  // namespace

void flashboxDisplayBegin() {
  statusFallback("ui", "Displayloser Helper", "Serial-/HTTP-Status aktiv");
}

void flashboxDisplayShowBoot(const String& serialNumber, const String& firmwareVersion) {
  statusFallback("boot", "Starte Flashbox", "SN: " + serialNumber + "\nFW: " + firmwareVersion);
}

void flashboxDisplayShowNetwork(const String& setupSsid) {
  statusFallback("network", "Setup WLAN aktiv", "SSID: " + setupSsid + "\nClaim braucht Challenge-Signatur.");
}

void flashboxDisplayShowWifiDisconnected(const String& setupSsid, const String& scannedSsids) {
  const String networks = scannedSsids.length() > 0 ? scannedSsids : "Suche WLANs...";
  statusFallback("wifi", "WLAN nicht verbunden", "Setup AP: " + setupSsid + "\nGefunden:\n" + networks);
}

void flashboxDisplayShowWifiConnected(const String& ssid, const String& ipAddress) {
  statusFallback("wifi", "WLAN verbunden", "SSID: " + ssid + "\nIP: " + ipAddress);
}

void flashboxDisplayShowClaimState(const String& claimState, const String& detail) {
  statusFallback("claim", "Claim: " + claimState, detail);
}

void flashboxDisplayShowTargetState(const String& targetState, const String& detail) {
  statusFallback("target", "USB: " + targetState, detail);
}

void flashboxDisplayShowError(const String& code, const String& detail) {
  statusFallback("error", "Fehler: " + code, detail);
}

void flashboxDisplayLoop() {
  // Displayless helper: status is event-driven via Serial and HTTP endpoints.
}
