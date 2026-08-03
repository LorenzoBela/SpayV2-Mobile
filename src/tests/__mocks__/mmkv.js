const memoryStore = new Map();

class MMKV {
  constructor() {}
  getString(key) {
    return memoryStore.get(key);
  }
  set(key, value) {
    memoryStore.set(key, String(value));
  }
  delete(key) {
    memoryStore.delete(key);
  }
  clearAll() {
    memoryStore.clear();
  }
}

module.exports = {
  MMKV,
  createMMKV: () => new MMKV(),
};
