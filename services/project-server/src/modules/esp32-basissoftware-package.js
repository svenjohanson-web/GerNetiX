const fs = require("node:fs");
const path = require("node:path");
const { renderPlatformioIni } = require("../../../shared/platformio-config");
const { normalizeBasissoftwareConfiguration, POWER_STATE_IDS } = require("../../../shared/basissoftware-configuration");

const DEFAULT_BASIS_ROOT = path.resolve(__dirname, "../../../../..", "GerNetiX-Projekte", "basissoftware-esp32");
const DEFAULT_RUNTIME_CORE_ROOT = path.resolve(__dirname, "../../../..", "firmware", "shared", "gernetix-runtime-core");
const INCLUDED_ROOT_FILES = new Set([
  "CMakeLists.txt", "dependencies.lock", "platformio.ini", "sdkconfig.esp32dev",
  "sdkconfig.esp32-s3-n16r8", "partitions_ota_4mb.csv",
]);
const PROFILE_PARTITION_FILE = /^partitions_(full|medium|low)_(4|8|16)mb\.csv$/;

function loadEsp32BasissoftwareFiles(root = process.env.GERNETIX_ESP32_BASISSOFTWARE_ROOT || DEFAULT_BASIS_ROOT) {
  if (!fs.existsSync(root)) {
    throw new Error(`ESP32-Basissoftware wurde nicht gefunden: ${root}`);
  }
  return walk(root)
    .filter((filePath) => includeFile(root, filePath))
    .map((filePath) => ({
      path: relativePath(root, filePath),
      content: fs.readFileSync(filePath, "utf8"),
      content_type: contentType(filePath),
    }));
}

function composeEsp32BasissoftwarePackage({ basisFiles, projectSources, buildConfig }) {
  const effectiveBuildConfig = {
    platform: "espressif32",
    board: "esp32dev",
    environment: "esp32dev",
    framework: "espidf",
    monitor_speed: 115200,
    firmware_basis_id: "gernetix-runtime-basissoftware",
    firmware_basis_variant: "full",
    flash_size_mb: 4,
    ...(buildConfig || {}),
  };
  const userSourcePath = effectiveBuildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp";
  const userTargetPath = effectiveBuildConfig.user_target_path || "src/user/user_app.cpp";
  const userSource = projectSources.find((source) => source.path === userSourcePath);
  if (!userSource) {
    throw new Error(`Projektquelle fuer User-Main fehlt: ${userSourcePath}`);
  }
  if (/gernetix_board_configuration\.h/.test(userSource.content) && !effectiveBuildConfig.board_configuration) {
    throw new Error(`Boardkonfiguration fuer ${userSourcePath} fehlt im Build-Snapshot.`);
  }
  const byPath = new Map(basisFiles.map((file) => [file.path, { ...file }]));
  addRuntimeCore(byPath);
  rewriteRuntimeCorePaths(byPath);
  applyBasissoftwareProfile(byPath, effectiveBuildConfig);
  applyBoardConfiguration(byPath, effectiveBuildConfig.board_configuration);
  applyBasissoftwareConfiguration(byPath, effectiveBuildConfig.basissoftware_configuration);
  byPath.set("platformio.ini", {
    path: "platformio.ini",
    content: renderPlatformioIni(effectiveBuildConfig),
    content_type: "text/plain",
  });
  const sourceSegmentIndex = userSourcePath.lastIndexOf("/src/");
  const componentRoot = sourceSegmentIndex >= 0
    ? userSourcePath.slice(0, sourceSegmentIndex)
    : userSourcePath.startsWith("src/") ? "" : userSourcePath.replace(/\/[^/]+$/, "");
  const componentPrefix = componentRoot ? `${componentRoot}/` : "";
  const implementationRoot = `${componentPrefix}src/`;
  const includeRoot = `${componentPrefix}include/`;
  const usesSourceManifest = projectSources.some((source) => source.path === `${componentPrefix}sources.cmake`);
  if (usesSourceManifest) {
    packageProjectSourceTree(byPath, projectSources, componentPrefix, userSourcePath);
    configureExternalProjectSourceTree(byPath);
    return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
  }
  byPath.set(userTargetPath, {
    path: userTargetPath,
    content: userSource.content,
    content_type: userSource.content_type || "text/x-c++src",
    source_project_path: userSourcePath,
  });
  for (const projectSource of projectSources) {
    if (projectSource.path === userSourcePath) continue;
    const isImplementationFile = projectSource.path.startsWith(implementationRoot);
    const isPublicHeader = projectSource.path.startsWith(includeRoot);
    if (!isImplementationFile && !isPublicHeader) continue;
    const relative = projectSource.path.slice((isPublicHeader ? includeRoot : implementationRoot).length);
    if (isImplementationFile && relative === "idf_component.yml") {
      byPath.set("src/idf_component.yml", {
        path: "src/idf_component.yml",
        content: projectSource.content,
        content_type: "text/plain",
        source_project_path: projectSource.path,
      });
      continue;
    }
    const isHeader = /\.(h|hh|hpp|hxx|inc|inl|ipp|tpp|cuh)$/i.test(relative);
    const isCppSource = isImplementationFile && /\.(cc|cpp|cxx)$/i.test(relative);
    if ((!isHeader && !isCppSource) || relative.includes("..")) continue;
    const targetPath = isCppSource ? `src/user_project/${relative}` : `include/user_project/${relative}`;
    byPath.set(targetPath, {
      path: targetPath,
      content: projectSource.content,
      content_type: projectSource.content_type || (isCppSource ? "text/x-c++src" : "text/x-c++hdr"),
      source_project_path: projectSource.path,
    });
  }
  // ESP-IDF validates every INCLUDE_DIRS entry during CMake configuration.
  // Projects without an additional public header would otherwise omit this
  // directory from the file-only BuildPackage and fail before compilation.
  if (![...byPath.keys()].some((filePath) => filePath.startsWith("include/user_project/"))) {
    byPath.set("include/user_project/.gernetix-keep", {
      path: "include/user_project/.gernetix-keep",
      content: "",
      content_type: "text/plain",
    });
  }
  return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

function packageProjectSourceTree(byPath, projectSources, componentPrefix, userSourcePath) {
  for (const projectSource of projectSources) {
    if (!projectSource.path.startsWith(componentPrefix)) continue;
    const relative = projectSource.path.slice(componentPrefix.length);
    if (!relative || relative.includes("..")) continue;
    const targetPath = `src/user_project/${relative}`;
    byPath.set(targetPath, {
      path: targetPath,
      ...(projectSource.content_base64 ? { content_base64: projectSource.content_base64 } : { content: projectSource.content }),
      content_type: projectSource.content_type || "text/plain",
      source_project_path: projectSource.path,
    });
  }
  // Nexi's historical source manifest names its entry `voice_lab.cpp`; the
  // customer layout intentionally exposes it as `src/user_main.cpp`.
  const userSource = projectSources.find((source) => source.path === userSourcePath);
  if (userSource && !byPath.has("src/user_project/voice_lab.cpp")) {
    byPath.set("src/user_project/voice_lab.cpp", {
      path: "src/user_project/voice_lab.cpp",
      ...(userSource.content_base64 ? { content_base64: userSource.content_base64 } : { content: userSource.content }),
      content_type: userSource.content_type || "text/x-c++src",
      source_project_path: userSource.path,
    });
  }
}

function configureExternalProjectSourceTree(byPath) {
  const cmake = byPath.get("src/CMakeLists.txt");
  if (!cmake) return;
  const marker = 'set(GERNETIX_PROJECT_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/user_project")';
  if (String(cmake.content || "").includes(marker)) return;
  byPath.set("src/CMakeLists.txt", {
    ...cmake,
    content: String(cmake.content || "").replace("idf_component_register(", `${marker}\n\nidf_component_register(`),
  });
}

function applyBoardConfiguration(byPath, configuration) {
  if (!configuration) return;
  byPath.set("include/gernetix_board_configuration.h", {
    path: "include/gernetix_board_configuration.h",
    content: renderBoardConfigurationHeader(configuration),
    content_type: "text/x-c++hdr",
  });
}

function applyBasissoftwareConfiguration(byPath, configuration) {
  const normalized = normalizeBasissoftwareConfiguration(configuration);
  byPath.set("include/gernetix_basissoftware_configuration.h", {
    path: "include/gernetix_basissoftware_configuration.h",
    content: renderBasissoftwareConfigurationHeader(normalized),
    content_type: "text/x-c++hdr",
  });
}

function renderBasissoftwareConfigurationHeader(configuration) {
  const config = normalizeBasissoftwareConfiguration(configuration);
  const lines = [
    "#pragma once",
    "// Generated from the protected, project-owned GerNetiX basissoftware configuration.",
    "#define GERNETIX_BASISSOFTWARE_CONFIGURATION_SCHEMA_VERSION 1",
    `#define GERNETIX_WIFI_ENABLED ${config.wifi.enabled ? 1 : 0}`,
    `#define GERNETIX_WIFI_MODE ${cppString(config.wifi.mode)}`,
    `#define GERNETIX_WIFI_AUTO_RECONNECT ${config.wifi.auto_reconnect ? 1 : 0}`,
    `#define GERNETIX_COMMUNICATION_MANAGED_BY_PROJECT ${config.communication.managed_by_project ? 1 : 0}`,
    `#define GERNETIX_COMMUNICATION_TOPOLOGY ${cppString(config.communication.topology)}`,
    `#define GERNETIX_COMMUNICATION_DEVICE_ACCESS_POINT ${config.communication.topology === "device_access_point" ? 1 : 0}`,
    `#define GERNETIX_COMMUNICATION_ROLE ${cppString(config.communication.role)}`,
    `#define GERNETIX_COMMUNICATION_ROLE_HOST ${config.communication.role === "host" ? 1 : 0}`,
    `#define GERNETIX_COMMUNICATION_TRANSPORT ${cppString(config.communication.transport)}`,
    `#define GERNETIX_COMMUNICATION_INTERNET_ACCESS ${config.communication.internet_access ? 1 : 0}`,
    `#define GERNETIX_COMMUNICATION_OTA_AVAILABLE ${config.communication.ota_available ? 1 : 0}`,
    `#define GERNETIX_COMMUNICATION_OBSERVER_ACCESS ${config.communication.observer_access ? 1 : 0}`,
    `#define GERNETIX_COMMUNICATION_ENDPOINT_PORT ${config.communication.endpoint_port}`,
    `#define GERNETIX_COMMUNICATION_ENDPOINT_PATH ${cppString(config.communication.endpoint_path)}`,
    `#define GERNETIX_COMMUNICATION_LOCAL_HOSTNAME ${cppString(config.communication.local_hostname)}`,
    `#define GERNETIX_COMMUNICATION_PEER_HOSTNAME ${cppString(config.communication.peer_hostname)}`,
    `#define GERNETIX_PROJECT_AP_SSID ${cppString(config.communication.access_point_ssid)}`,
    `#define GERNETIX_PROJECT_AP_PASSWORD ${cppString(config.communication.access_point_password)}`,
    `#define GERNETIX_ACCESS_POINT_IPV4_ADDRESS ${cppString(config.communication.access_point_ipv4_address || "192.168.4.1")}`,
    `#define GERNETIX_ACCESS_POINT_SUBNET_MASK ${cppString(config.communication.access_point_subnet_mask || "255.255.255.0")}`,
    `#define GERNETIX_ACCESS_POINT_DHCP_START ${cppString(config.communication.access_point_dhcp_start || "192.168.4.100")}`,
    `#define GERNETIX_ACCESS_POINT_DHCP_END ${cppString(config.communication.access_point_dhcp_end || "192.168.4.199")}`,
    `#define GERNETIX_COMMUNICATION_PEER_COUNT ${config.communication.peer_software_unit_ids.length}`,
    ...config.communication.peer_software_unit_ids.map((peer, index) => `#define GERNETIX_COMMUNICATION_PEER_${index} ${cppString(peer)}`),
    `#define GERNETIX_MQTT_ENABLED ${config.mqtt.enabled ? 1 : 0}`,
    `#define GERNETIX_MQTT_BROKER_URL ${cppString(config.mqtt.broker_url)}`,
    `#define GERNETIX_MQTT_PORT ${config.mqtt.port}`,
    `#define GERNETIX_MQTT_TLS ${config.mqtt.tls ? 1 : 0}`,
    `#define GERNETIX_MQTT_CLIENT_ID_TEMPLATE ${cppString(config.mqtt.client_id_template)}`,
    `#define GERNETIX_MQTT_QOS ${config.mqtt.qos}`,
    `#define GERNETIX_MQTT_PUBLISH_TOPIC_COUNT ${config.mqtt.publish_topics.length}`,
    `#define GERNETIX_MQTT_SUBSCRIPTION_COUNT ${config.mqtt.subscriptions.length}`,
  ];
  config.mqtt.publish_topics.forEach((topic, index) => lines.push(`#define GERNETIX_MQTT_PUBLISH_TOPIC_${index} ${cppString(topic)}`));
  config.mqtt.subscriptions.forEach((topic, index) => lines.push(`#define GERNETIX_MQTT_SUBSCRIPTION_${index} ${cppString(topic)}`));
  lines.push(
    `#define GERNETIX_POWER_MANAGER_ENABLED ${config.power_manager.enabled ? 1 : 0}`,
    `#define GERNETIX_POWER_DEFAULT_STATE ${cppString(config.power_manager.default_state)}`,
  );
  for (const stateId of POWER_STATE_IDS) {
    const state = config.power_manager.states[stateId];
    const prefix = `GERNETIX_POWER_STATE_${macroName(stateId)}`;
    lines.push(`#define ${prefix}_ENABLED ${state.enabled ? 1 : 0}`);
    lines.push(`#define ${prefix}_ENTER_AFTER_SECONDS ${state.enter_after_seconds}`);
    lines.push(`#define ${prefix}_WAKE_SOURCES ${cppString(state.wake_sources.join(","))}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderBoardConfigurationHeader(configuration) {
  const lines = [
    "#pragma once",
    "// Generated from the immutable GerNetiX project board snapshot.",
    "#define GERNETIX_BOARD_CONFIGURATION_SCHEMA_VERSION 1",
    `#define GERNETIX_BOARD_CONFIGURATION_SOURCE ${cppString(configuration.source || "project")}`,
    `#define GERNETIX_BOARD_CONFIGURATION_NAME ${cppString(configuration.name || "")}`,
    `#define GERNETIX_BOARD_BASE_PROFILE_ID ${cppString(configuration.base_board_profile_id || "")}`,
    `#define GERNETIX_ACCOUNT_BOARD_ID ${cppString(configuration.account_board_id || "")}`,
    `#define GERNETIX_ACCOUNT_BOARD_VERSION ${Number(configuration.account_board_version) || 0}`,
  ];
  for (const [featureId, feature] of Object.entries(configuration.board_features || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const prefix = `GERNETIX_BOARD_FEATURE_${macroName(featureId)}`;
    lines.push(`#define ${prefix}_ENABLED ${feature.enabled === true ? 1 : 0}`);
    lines.push(`#define ${prefix}_HARDWARE ${cppString(feature.hardware || "")}`);
    lines.push(`#define ${prefix}_DRIVER ${cppString(feature.driver || "")}`);
    lines.push(`#define ${prefix}_CONNECTION ${cppString(feature.connection || "")}`);
    lines.push(`#define ${prefix}_VALUE ${cppString(feature.value || "")}`);
    for (const [signal, pin] of Object.entries(feature.pins || {}).sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`#define ${prefix}_PIN_${macroName(signal)} ${Number(pin)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function macroName(value) {
  return String(value || "UNKNOWN").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "UNKNOWN";
}

function cppString(value) {
  return JSON.stringify(String(value || ""));
}

function addRuntimeCore(byPath, root = process.env.GERNETIX_RUNTIME_CORE_ROOT || DEFAULT_RUNTIME_CORE_ROOT) {
  if (!fs.existsSync(root)) {
    throw new Error(`GerNetiX Runtime Core wurde nicht gefunden: ${root}`);
  }
  for (const filePath of walk(root)) {
    const relative = relativePath(root, filePath);
    if (relative !== "library.json" && !relative.startsWith("include/") && !relative.startsWith("src/")) continue;
    const targetPath = `lib/gernetix-runtime-core/${relative}`;
    byPath.set(targetPath, {
      path: targetPath,
      content: fs.readFileSync(filePath, "utf8"),
      content_type: contentType(filePath),
    });
  }
}

function rewriteRuntimeCorePaths(byPath) {
  const cmake = byPath.get("src/CMakeLists.txt");
  if (!cmake) return;
  cmake.content = cmake.content.replaceAll(
    "../../../firmware/shared/gernetix-runtime-core/",
    "../lib/gernetix-runtime-core/",
  );
}

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function includeFile(root, filePath) {
  const relative = relativePath(root, filePath);
  if (relative.startsWith(".pio/") || relative.startsWith(".vscode/") || relative.startsWith("build/")) return false;
  if (relative.startsWith("managed_components/espressif__mqtt/")) {
    return !relative.includes("/examples/")
      && !relative.includes("/test/")
      && !relative.includes("/docs/")
      && !relative.includes("/.git")
      && !/\.(html|xml|toml|yml)$/i.test(relative.replace(/idf_component\.yml$/i, ""));
  }
  return INCLUDED_ROOT_FILES.has(relative) || PROFILE_PARTITION_FILE.test(relative) || relative.startsWith("src/") || relative.startsWith("include/");
}

function applyBasissoftwareProfile(byPath, buildConfig = {}) {
  if (!byPath.has("platformio.ini")) return;
  if (!/^board_build\.partitions\s*=/m.test(byPath.get("platformio.ini").content)) return;
  const profile = normalizeProfile(buildConfig.firmware_basis_variant || buildConfig.basissoftware_profile?.class);
  const flashSizeMb = normalizeFlashSize(buildConfig.flash_size_mb);
  const requestedPartitionFile = `partitions_${profile}_${flashSizeMb}mb.csv`;
  const partitionFile = byPath.has(requestedPartitionFile)
    ? requestedPartitionFile
    : profile === "full" && flashSizeMb === 4 && byPath.has("partitions_ota_4mb.csv")
      ? "partitions_ota_4mb.csv"
      : requestedPartitionFile;
  if (!byPath.has(partitionFile)) {
    throw new Error(`Partitionslayout fuer ${profile.toUpperCase()} mit ${flashSizeMb} MB fehlt: ${partitionFile}`);
  }

  const platformioFile = byPath.get("platformio.ini");
  if (platformioFile) {
    platformioFile.content = platformioFile.content
      .replace(/^board_build\.flash_size\s*=.*$/m, `board_build.flash_size = ${flashSizeMb}MB`)
      .replace(/^board_build\.partitions\s*=.*$/m, `board_build.partitions = ${partitionFile}`)
      .replace(/^build_flags\s*=.*$/m, `build_flags = -D GERNETIX_BASISSOFTWARE_PROFILE_${profile.toUpperCase()}=1`);
  }

  const sdkconfigFile = byPath.get("sdkconfig.esp32dev");
  if (sdkconfigFile) {
    sdkconfigFile.content = [4, 8, 16].reduce((source, size) => source
      .replace(new RegExp(`^(?:# )?CONFIG_ESPTOOLPY_FLASHSIZE_${size}MB(?:=y| is not set)$`, "m"),
        size === flashSizeMb ? `CONFIG_ESPTOOLPY_FLASHSIZE_${size}MB=y` : `# CONFIG_ESPTOOLPY_FLASHSIZE_${size}MB is not set`), sdkconfigFile.content)
      .replace(/^CONFIG_ESPTOOLPY_FLASHSIZE="[^"]+"$/m, `CONFIG_ESPTOOLPY_FLASHSIZE="${flashSizeMb}MB"`)
      .replace(/^CONFIG_PARTITION_TABLE_FILENAME="[^"]+"$/m, `CONFIG_PARTITION_TABLE_FILENAME="${partitionFile}"`)
      .replace(/^CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="[^"]+"$/m, `CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="${partitionFile}"`);
  }
}

function normalizeProfile(value) {
  const normalized = String(value || "full").trim().toLowerCase();
  if (normalized === "comfort") return "full";
  if (["full", "medium", "low"].includes(normalized)) return normalized;
  throw new Error(`Unbekanntes Basissoftwareprofil: ${value}`);
}

function normalizeFlashSize(value) {
  const parsed = Number.parseInt(value, 10);
  return [4, 8, 16].includes(parsed) ? parsed : 4;
}

function relativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function contentType(filePath) {
  if (/\.(cpp|cc|c)$/i.test(filePath)) return "text/x-c++src";
  if (/\.(h|hpp)$/i.test(filePath)) return "text/x-c++hdr";
  return "text/plain";
}

module.exports = { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles, renderBoardConfigurationHeader, renderBasissoftwareConfigurationHeader };
