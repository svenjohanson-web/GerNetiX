#pragma once

#include <Arduino.h>
#include <U8g2lib.h>

void gernetixUserApplicationBegin(U8G2 &display);
void gernetixUserApplicationTick(U8G2 &display, uint32_t nowMs);
