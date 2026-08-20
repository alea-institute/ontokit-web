function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(String(key)) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem(key) {
      values.delete(String(key));
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
  };
}

Object.defineProperties(globalThis, {
  localStorage: { configurable: true, writable: true, value: createMemoryStorage() },
  sessionStorage: { configurable: true, writable: true, value: createMemoryStorage() },
});
