#pragma once

#include <cstddef>

// Narrow project-to-web contract.  Project code may publish a named current
// value and a short human-readable event, but it cannot register or replace
// HTTP routes of the protected basis software.
void projectDashboardPublishMeasurement(int value);
void projectDashboardAppendLog(const char *message);
void writeProjectDashboardJson(char *target, size_t targetSize);
const char *projectDashboardPageHtml();
