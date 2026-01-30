/**
 * Interface abstractions for stateful systems used by chat history.
 * Following CLAUDE.md guidelines for abstracting localStorage and fetch.
 */

/**
 * Interface for storage operations.
 * Abstracts localStorage to enable testing and alternative implementations.
 */
export interface StorageProvider {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Interface for HTTP client operations.
 * Abstracts fetch to enable testing and alternative implementations.
 */
export interface HttpClient {
  post<T>(url: string, body: unknown): Promise<T>;
}

/**
 * Default localStorage implementation of StorageProvider.
 */
export function createLocalStorageProvider(): StorageProvider {
  return {
    getItem(key: string): string | null {
      if (typeof window === "undefined") return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(key, value);
      } catch {
        console.warn("Failed to save to localStorage");
      }
    },
    removeItem(key: string): void {
      if (typeof window === "undefined") return;
      try {
        localStorage.removeItem(key);
      } catch {
        console.warn("Failed to remove from localStorage");
      }
    },
  };
}

/**
 * Default fetch implementation of HttpClient.
 */
export function createFetchHttpClient(): HttpClient {
  return {
    async post<T>(url: string, body: unknown): Promise<T> {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      return response.json() as Promise<T>;
    },
  };
}

/**
 * In-memory storage provider for testing.
 */
export function createMemoryStorageProvider(
  initialData: Record<string, string> = {},
): StorageProvider {
  const store = new Map<string, string>(Object.entries(initialData));

  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
  };
}

/**
 * Response type for chat preview API.
 */
export interface ChatPreviewResponse {
  preview: string;
}
