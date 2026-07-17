class PublicDemoService {
  constructor({ repository }) {
    this.repository = repository;
  }

  listPublicDemos() {
    return this.repository.listPublicDemos();
  }

  getPublicDemo(demoId) {
    return this.repository.getPublicDemo(demoId);
  }

  getFirmware(demoId, version) {
    return this.repository.getFirmware(demoId, version);
  }

  getFlashManifest(demoId, version) { return this.repository.getFlashManifest(demoId, version); }
  getAsset(demoId, version, assetId) { return this.repository.getAsset(demoId, version, assetId); }

  publishDemo(input) {
    return this.repository.publish(input);
  }
}

module.exports = { PublicDemoService };
