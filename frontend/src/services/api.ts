// Empty string = same origin (production). Set VITE_API_URL for a separate backend in dev.
const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init);
    logout();
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('access_token', data.access_token);
    return true;
  } catch {
    return false;
  }
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.dispatchEvent(new CustomEvent('doen:logout'));
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function sseConnect(onEvent: (name: string, data: unknown) => void): EventSource {
  const token = localStorage.getItem('access_token');
  const src = new EventSource(`${BASE}/events?token=${token}`);
  const handle = (name: string) => (e: MessageEvent) => {
    try { onEvent(name, JSON.parse(e.data)); } catch { /* skip */ }
  };
  for (const ev of [
    'task_created', 'task_updated', 'task_completed', 'task_deleted',
    'offer_created', 'offer_updated',
    'category_created', 'category_updated', 'category_deleted',
  ]) {
    src.addEventListener(ev, handle(ev) as EventListener);
  }
  return src;
}
