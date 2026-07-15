#pragma once

// Provides the local USB-only WLAN provisioning contract used by the browser HMI.
// It never sends WiFi passwords to a server and never writes them to the log.
void startSerialProvisioning();
