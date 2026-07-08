class LocalHardwareCatalogClient {
  constructor(service) {
    this.service = service;
  }

  listCapabilities() {
    return this.service.listCapabilities();
  }

  getCapability(capabilityId) {
    return this.service.getCapability(capabilityId);
  }

  listHardwareItems(query = {}) {
    return this.service.listHardwareItems(query);
  }

  getHardwareItem(itemId) {
    return this.service.getHardwareItem(itemId);
  }

  listProcessorBoards() {
    return this.service.listProcessorBoards();
  }
}

class HttpHardwareCatalogClient {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl || "").replace(/\/$/, "");
  }

  async listCapabilities() {
    return (await this.getJson("/api/hardware-catalog/capabilities")).items || [];
  }

  async getCapability(capabilityId) {
    return this.getJson(`/api/hardware-catalog/capabilities/${encodeURIComponent(capabilityId)}`);
  }

  async listHardwareItems(query = {}) {
    const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value)).toString();
    return (await this.getJson(`/api/hardware-catalog/hardware-items${search ? `?${search}` : ""}`)).items || [];
  }

  async getHardwareItem(itemId) {
    return this.getJson(`/api/hardware-catalog/hardware-items/${encodeURIComponent(itemId)}`);
  }

  async listProcessorBoards() {
    return (await this.getJson("/api/hardware-catalog/processor-boards")).items || [];
  }

  async getJson(pathname) {
    const response = await fetch(`${this.baseUrl}${pathname}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || "Hardware Catalog request failed.");
      error.status = response.status;
      error.code = payload.error;
      throw error;
    }
    return payload;
  }
}

module.exports = { LocalHardwareCatalogClient, HttpHardwareCatalogClient };
