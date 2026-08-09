"use strict";

const { createStaticLearningProjectModel } = require("./static-learning-project-model");

function createArduinoAtmelBareMetalCourseModel() {
  return createStaticLearningProjectModel({
    slug: "arduino-atmel-bare-metal",
    title: "Arduino Atmel/AVR ohne Arduino",
    area: "Firmware",
    summary: "Bare-Metal-Basissoftware fuer Arduino-kompatible AVR-Boards mit avr-libc, Build und USB-Flash.",
    steps: [
      { title: "Runtime waehlen", text: "Dieses Projekt nutzt ein Arduino-kompatibles AVR-Board ohne Arduino-Framework.", insight: "Die Board-Hardware bleibt Arduino-kompatibel, die Software spricht aber direkt AVR-Register an." },
      { title: "User-Datei bearbeiten", text: "Deine Logik liegt in src/user/user_app.c; main.c bleibt geschuetzte Basissoftware.", insight: "Basis und User-Code bleiben getrennt." },
      { title: "Build starten", text: "Die IDE baut das Projekt mit PlatformIO fuer atmelavr/nanoatmega328.", insight: "Das Ergebnis ist fuer AVR typischerweise eine firmware.hex." },
      { title: "USB-Flash starten", text: "Der Flash-Button nutzt den ausgewaehlten Arduino Nano und den COM-Port.", insight: "Build und Upload laufen ueber denselben Build-&-Deploy-Pfad wie andere Firmware-Projekte." },
    ],
    options: {
      access_model: "subscription",
      hardware_profile_id: "hardware.processor_board.arduino_nano_r3_atmega328p",
      default_device_id: "device_arduino_nano_1",
      build_config: { environment: "uno", platform: "atmelavr", board: "uno", framework: "", monitorSpeed: "9600" },
      source_files: [{ path: "src/user/user_app.c", role: "user_code" }],
      required_capability_ids: ["capability.atmel_avr_bare_metal_runtime", "capability.flash_firmware"],
      learning_category: "embedded",
      tags: ["platform:arduino", "platform:avr", "topic:bare-metal"],
    },
    sources: [
      { path: "src/main.c", role: "base_runtime", content: ["#include <avr/io.h>", "#include \"user/user_app.h\"", "", "int main(void) {", "  user_setup();", "", "  while (1) {", "    user_loop();", "  }", "}", ""].join("\n") },
      { path: "include/user/user_app.h", role: "header", content: ["#pragma once", "", "void user_setup(void);", "void user_loop(void);", ""].join("\n") },
      { role: "user_code", content: ["#include <avr/io.h>", "#include <util/delay.h>", "", "void user_setup(void) {", "  DDRB |= _BV(DDB5);", "}", "", "void user_loop(void) {", "  PORTB ^= _BV(PORTB5);", "  _delay_ms(250);", "}", ""].join("\n") },
    ],
  });
}

module.exports = { createArduinoAtmelBareMetalCourseModel };
