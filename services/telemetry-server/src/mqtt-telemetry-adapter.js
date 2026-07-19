const { MqttTransport } = require("../../build-deploy-server/src/modules/mqtt-transport");

function startMqttTelemetryAdapter({ mqttBrokerUrl, service, MqttTransportClass = MqttTransport, log = console }) {
  if (!mqttBrokerUrl) return null;
  const transport = new MqttTransportClass({
    url: mqttBrokerUrl,
    clientId: `gernetix-telemetry-${process.pid}`,
    topicFilter: "gernetix/devices/+/telemetry",
    onMessage: async (topic, payload) => {
      const deviceId = deviceIdFromTopic(topic);
      if (!deviceId) return;
      let message;
      try { message = JSON.parse(payload); }
      catch { log.warn?.(`Telemetry payload von ${deviceId} ist kein JSON.`); return; }
      try { await service.ingest({ ...message, device_id: deviceId }); }
      catch (error) { log.warn?.(`Telemetry von ${deviceId} wurde abgewiesen: ${error.code || error.message}`); }
    },
  });
  transport.start().catch((error) => log.error?.(`MQTT-Telemetrieadapter nicht verbunden: ${error.message}`));
  return transport;
}

function startMqttRuntimeAdapter({ mqttBrokerUrl, service, MqttTransportClass = MqttTransport, log = console }) {
  if (!mqttBrokerUrl) return null;
  const transport = new MqttTransportClass({
    url: mqttBrokerUrl,
    clientId: `gernetix-runtime-${process.pid}`,
    topicFilter: "gernetix/devices/+/runtime",
    onMessage: async (topic, payload) => {
      const deviceId = deviceIdFromRuntimeTopic(topic);
      if (!deviceId) return;
      let message;
      try { message = JSON.parse(payload); }
      catch { log.warn?.(`Runtime-Payload von ${deviceId} ist kein JSON.`); return; }
      try { await service.relayRuntime({ ...message, device_id: deviceId }); }
      catch (error) { log.warn?.(`Runtime-Meldung von ${deviceId} wurde abgewiesen: ${error.code || error.message}`); }
    },
  });
  transport.start().catch((error) => log.error?.(`MQTT-Runtimeadapter nicht verbunden: ${error.message}`));
  return transport;
}

function deviceIdFromTopic(topic) {
  const match = String(topic || "").match(/^gernetix\/devices\/([^/]+)\/telemetry$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function deviceIdFromRuntimeTopic(topic) {
  const match = String(topic || "").match(/^gernetix\/devices\/([^/]+)\/runtime$/);
  return match ? decodeURIComponent(match[1]) : "";
}

module.exports = { startMqttTelemetryAdapter, startMqttRuntimeAdapter, deviceIdFromTopic, deviceIdFromRuntimeTopic };
