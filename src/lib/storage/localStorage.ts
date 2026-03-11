const PREFIX = 'styleai_';

export function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    console.warn(`Failed to save ${key} to localStorage`);
  }
}

export function removeItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore errors (e.g. private browsing mode)
  }
}
