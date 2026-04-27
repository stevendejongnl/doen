import { vi } from 'vitest';

// Stub the global defined by Vite at build time
(globalThis as Record<string, unknown>)['__APP_VERSION__'] = '0.0.0-test';

// Mock EventSource (jsdom doesn't include it)
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  readyState = MockEventSource.CONNECTING;
  url: string;
  private _listeners: Map<string, EventListener[]> = new Map();

  constructor(url: string) {
    this.url = url;
    setTimeout(() => { this.readyState = MockEventSource.OPEN; }, 0);
  }

  addEventListener(type: string, listener: EventListener) {
    const list = this._listeners.get(type) ?? [];
    list.push(listener);
    this._listeners.set(type, list);
  }

  removeEventListener(type: string, listener: EventListener) {
    const list = this._listeners.get(type) ?? [];
    this._listeners.set(type, list.filter(l => l !== listener));
  }

  dispatchEvent(event: Event): boolean {
    const list = this._listeners.get(event.type) ?? [];
    list.forEach(l => l(event));
    return true;
  }

  close() { this.readyState = MockEventSource.CLOSED; }

  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.dispatchEvent(event);
  }
}

(globalThis as Record<string, unknown>)['EventSource'] = MockEventSource;
(globalThis as Record<string, unknown>)['MockEventSource'] = MockEventSource;

// Mock localStorage
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
  length: 0,
  key: (_i: number) => null,
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Auto-mock the api and auth modules — tests can override with vi.mocked(api.get).mockResolvedValue(...)
vi.mock('../src/services/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  logout: vi.fn(),
  purgeOffers: vi.fn(),
  resetBalances: vi.fn(),
  adjustBalance: vi.fn(),
  sseConnect: vi.fn(() => new MockEventSource('/events?token=test')),
}));

vi.mock('../src/services/auth', () => ({
  getMe: vi.fn(),
  getAuthStatus: vi.fn(),
  login: vi.fn(),
  registerFirst: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  isLoggedIn: vi.fn(() => true),
}));
