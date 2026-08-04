set(GERNETIX_PROJECT_SOURCES)
set(GERNETIX_PROJECT_REQUIRES)
set(GERNETIX_PROJECT_INCLUDE_DIRS)
file(GLOB GERNETIX_PACKAGED_USER_SOURCES "user/*.cpp")
file(GLOB_RECURSE GERNETIX_PACKAGED_PROJECT_SOURCES "user_project/*.cpp")
list(APPEND GERNETIX_PROJECT_SOURCES ${GERNETIX_PACKAGED_USER_SOURCES})
list(APPEND GERNETIX_PROJECT_SOURCES ${GERNETIX_PACKAGED_PROJECT_SOURCES})
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../include/user_project")
  list(APPEND GERNETIX_PROJECT_INCLUDE_DIRS ../include/user_project)
endif()
if(GERNETIX_CAMERA_DISPLAY_SLICE)
  list(APPEND GERNETIX_PROJECT_REQUIRES esp32-camera esp_http_client esp_lcd esp_driver_i2c esp_driver_spi mdns)
endif()
if(DEFINED GERNETIX_PROJECT_SOURCE_DIR)
  # The build package passes one selected project source directory.  The
  # project stays outside the basissoftware tree, but is compiled into the
  # firmware's application component until project components are split into
  # their own public SDK target.
  file(GLOB GERNETIX_PROJECT_SOURCES "${GERNETIX_PROJECT_SOURCE_DIR}/*.cpp")
endif()

idf_component_register(
  SRCS
    main.cpp
    functions/crash_diagnostics.cpp
    functions/factory_provisioning.cpp
    functions/feedback.cpp
    functions/handleNetwork.cpp
    functions/initPins.cpp
    functions/initSerial.cpp
    functions/initWifi.cpp
    functions/mqtt_ota.cpp
    functions/ota_update.cpp
    functions/project_dashboard.cpp
    functions/startCaptiveDnsServer.cpp
    functions/publishStatus.cpp
    functions/provisioning_config.cpp
    ../../../firmware/shared/gernetix-runtime-core/src/runtime_core.cpp
    functions/readSensors.cpp
    functions/runDiagnostics.cpp
    functions/serial_provisioning.cpp
    functions/startDeviceWebServer.cpp
    functions/startRuntimeTasks.cpp
    functions/updateActuators.cpp
    hooks/onProjectInit.cpp
    hooks/onProjectTick.cpp
    ${GERNETIX_PROJECT_SOURCES}
  INCLUDE_DIRS
    ../include
    ../../../firmware/shared/gernetix-runtime-core/include
    ${GERNETIX_PROJECT_INCLUDE_DIRS}
  REQUIRES
    app_update
    esp_app_format
    esp_codec_dev
    espcoredump
    driver
    esp_driver_gpio
    esp_driver_i2c
    esp_driver_i2s
    esp_driver_uart
    esp_driver_usb_serial_jtag
    esp_event
    esp_http_server
    esp_hw_support
    esp_https_ota
    esp_netif
    esp_timer
    esp_wifi
    freertos
    heap
    log
    led_strip
    lwip
    mbedtls
    mqtt
    ${GERNETIX_PROJECT_REQUIRES}
    nvs_flash
)
