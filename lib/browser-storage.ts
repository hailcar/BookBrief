const memoryStorage = new Map<string, string>();
const memorySessionStorage = new Map<string, string>();

export function getBrowserStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (memoryStorage.has(key)) return memoryStorage.get(key) ?? null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setBrowserStorageItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;

  memoryStorage.set(key, value);
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getBrowserSessionItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (memorySessionStorage.has(key)) {
    return memorySessionStorage.get(key) ?? null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setBrowserSessionItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;

  memorySessionStorage.set(key, value);
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
