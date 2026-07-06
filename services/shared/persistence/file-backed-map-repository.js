class FileBackedMapRepository {
  constructor(store, collectionNames = []) {
    this.store = store;
    this.collectionNames = collectionNames;
    this.state = this.normalizeState(store.load());
  }

  collection(name) {
    if (!this.state[name]) this.state[name] = {};
    return this.state[name];
  }

  saveItem(collectionName, key, item) {
    this.collection(collectionName)[key] = item;
    this.persist();
    return item;
  }

  findItem(collectionName, key) {
    return this.collection(collectionName)[key] || null;
  }

  listItems(collectionName, predicate = null) {
    const items = Object.values(this.collection(collectionName));
    return predicate ? items.filter(predicate) : items;
  }

  deleteItem(collectionName, key) {
    const existing = this.findItem(collectionName, key);
    delete this.collection(collectionName)[key];
    this.persist();
    return existing;
  }

  persist() {
    this.store.save(this.state);
  }

  normalizeState(state) {
    const next = state && typeof state === "object" ? state : {};
    for (const collectionName of this.collectionNames) {
      if (!next[collectionName]) next[collectionName] = {};
    }
    return next;
  }
}

module.exports = { FileBackedMapRepository };
