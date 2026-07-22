# This file was automatically generated for projects
# without default 'CMakeLists.txt' file.

FILE(GLOB_RECURSE app_sources ${CMAKE_SOURCE_DIR}/src/*.*)

# BLE is used by the Arduino BLE facade in main.cpp.  With Arduino built as
# an ESP-IDF component, the application must declare the ESP-IDF Bluetooth
# component explicitly or the Bluedroid GAP/GATT symbols are not linked.
idf_component_register(SRCS ${app_sources} INCLUDE_DIRS "../include" REQUIRES bt)
