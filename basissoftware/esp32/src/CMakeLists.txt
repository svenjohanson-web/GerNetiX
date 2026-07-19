set(GERNETIX_PROJECT_SOURCES)
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
    functions/readSensors.cpp
    functions/runDiagnostics.cpp
    functions/serial_provisioning.cpp
    functions/startDeviceWebServer.cpp
    functions/startRuntimeTasks.cpp
    functions/updateActuators.cpp
    hooks/onProjectInit.cpp
    hooks/onProjectTick.cpp
    user/user_app.cpp
    ${GERNETIX_PROJECT_SOURCES}
  INCLUDE_DIRS ../include
  REQUIRES
    app_update
    esp_driver_gpio
    esp_driver_uart
    esp_driver_usb_serial_jtag
    esp_event
    esp_http_server
    esp_https_ota
    esp_netif
    esp_timer
    esp_wifi
    freertos
    log
    lwip
    mbedtls
    mqtt
    nvs_flash
)
