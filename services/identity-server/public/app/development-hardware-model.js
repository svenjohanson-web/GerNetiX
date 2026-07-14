const DevelopmentHardwareModel = (() => {
  function processorKey(board) {
    const family = String(board?.processor_family || "").trim().toLowerCase();
    const variant = String(board?.mcu_variant || "").trim();
    return family && variant ? `${family}::${variant}` : "";
  }

  function processorOptions(boards) {
    const options = new Map();
    for (const board of Array.isArray(boards) ? boards : []) {
      const key = processorKey(board);
      if (!key || options.has(key)) continue;
      options.set(key, {
        key,
        family: String(board.processor_family || "").trim().toLowerCase(),
        variant: String(board.mcu_variant || "").trim(),
      });
    }
    return [...options.values()].sort((left, right) => left.variant.localeCompare(right.variant, "de"));
  }

  function boardsForProcessor(boards, key) {
    if (!key) return [];
    return (Array.isArray(boards) ? boards : []).filter((board) => processorKey(board) === key);
  }

  function selectionForComponent(component, boards) {
    const storedFamily = String(component?.processor_family || "").trim().toLowerCase();
    const storedVariant = String(component?.processor_variant || "").trim();
    if (storedFamily && storedVariant) return `${storedFamily}::${storedVariant}`;
    const boardId = String(component?.board_profile_id || "");
    const board = (Array.isArray(boards) ? boards : []).find((item) => boardIdentifier(item) === boardId);
    return processorKey(board);
  }

  function applyProcessorSelection(component, key, boards) {
    const option = processorOptions(boards).find((item) => item.key === key);
    const compatibleBoards = boardsForProcessor(boards, key);
    const boardIsCompatible = compatibleBoards.some((board) => boardIdentifier(board) === component.board_profile_id);
    return {
      ...component,
      processor_family: option?.family || "",
      processor_variant: option?.variant || "",
      board_profile_id: boardIsCompatible ? component.board_profile_id : "",
    };
  }

  function boardIdentifier(board) {
    return String(board?.hardware_item_id || board?.hardware_profile_id || "");
  }

  const SENSOR_CATEGORY_LABELS = {
    temperature: "Temperatur",
    humidity: "Luftfeuchtigkeit",
    soil_moisture: "Bodenfeuchtigkeit",
    light: "Helligkeit",
    pressure: "Druck",
    distance: "Abstand",
    position: "Position / Winkel",
    rotation: "Drehung",
    acceleration: "Beschleunigung",
    speed: "Drehzahl / Geschwindigkeit",
    magnetic_field: "Magnetfeld / Hall",
    contact: "Kontakt / Reedkontakt",
    motion: "Bewegung / Praesenz",
    level: "Fuellstand / Wasserstand",
    current: "Strom",
    voltage: "Spannung",
    weight: "Gewicht",
    force: "Kraft",
  };

  const SIGNAL_TYPE_LABELS = {
    analog: "Analog",
    digital: "Digital",
    pulse_counter: "Impuls / Zaehler",
    incremental_ab: "Inkremental A/B",
    i2c: "I2C",
    spi: "SPI",
    one_wire: "1-Wire",
    uart: "UART",
  };

  function sensorCategoryOptions(sensors) {
    const used = new Set((Array.isArray(sensors) ? sensors : []).flatMap((sensor) => sensor.measurement_kinds || []));
    return Object.entries(SENSOR_CATEGORY_LABELS)
      .filter(([id]) => used.has(id))
      .map(([id, label]) => ({ id, label }));
  }

  function signalTypeOptions(sensors, category) {
    const used = new Set(sensorTypesFor(sensors, category).map((sensor) => sensor.signal_type).filter(Boolean));
    return Object.entries(SIGNAL_TYPE_LABELS)
      .filter(([id]) => used.has(id))
      .map(([id, label]) => ({ id, label }));
  }

  function sensorTypesFor(sensors, category, signalType = "") {
    return (Array.isArray(sensors) ? sensors : []).filter((sensor) => (
      (!category || (sensor.measurement_kinds || []).includes(category))
      && (!signalType || sensor.signal_type === signalType)
    ));
  }

  function reconcileSensor(component, sensors) {
    const concrete = (Array.isArray(sensors) ? sensors : []).find((sensor) => sensor.sensor_type_id === component?.concrete_type);
    const category = component?.sensor_category || concrete?.measurement_kinds?.[0] || "";
    const signalType = component?.signal_type || concrete?.signal_type || "";
    return applySignalType(applySensorCategory(component, category, sensors), signalType, sensors);
  }

  function applySensorCategory(component, category, sensors) {
    const validSignals = signalTypeOptions(sensors, category).map((item) => item.id);
    const signalType = validSignals.includes(component?.signal_type) ? component.signal_type : "";
    const concreteIsValid = sensorTypesFor(sensors, category, signalType)
      .some((sensor) => sensor.sensor_type_id === component?.concrete_type);
    return { ...component, sensor_category: category, signal_type: signalType, concrete_type: concreteIsValid ? component.concrete_type : "" };
  }

  function applySignalType(component, signalType, sensors) {
    const validSignals = signalTypeOptions(sensors, component?.sensor_category).map((item) => item.id);
    const normalizedSignal = validSignals.includes(signalType) ? signalType : "";
    const concreteIsValid = sensorTypesFor(sensors, component?.sensor_category, normalizedSignal)
      .some((sensor) => sensor.sensor_type_id === component?.concrete_type);
    return { ...component, signal_type: normalizedSignal, concrete_type: concreteIsValid ? component.concrete_type : "" };
  }

  return {
    applyProcessorSelection,
    applySensorCategory,
    applySignalType,
    boardIdentifier,
    boardsForProcessor,
    processorKey,
    processorOptions,
    reconcileSensor,
    selectionForComponent,
    sensorCategoryOptions,
    sensorTypesFor,
    signalTypeOptions,
  };
})();

if (typeof module !== "undefined") module.exports = DevelopmentHardwareModel;
