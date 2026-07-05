class AuthProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  authenticate() {
    throw new Error("AuthProvider.authenticate must be implemented.");
  }
}

module.exports = { AuthProvider };
