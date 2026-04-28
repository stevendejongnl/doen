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

export function purgeOffers(
  groupId: string,
  statuses: string[],
): Promise<{ deleted_offer_ids: string[] }> {
  return request(`/households/${groupId}/admin/offers/purge`, {
    method: 'POST',
    body: JSON.stringify({ statuses }),
  });
}

export function resetBalances(
  groupId: string,
  userIds: string[] | null,
): Promise<void> {
  return request(`/households/${groupId}/admin/points/reset`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export function adjustBalance(
  groupId: string,
  userId: string,
  delta: number,
  note: string | null,
): Promise<import('./types').PointTransaction> {
  return request(`/households/${groupId}/admin/points/adjust`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, delta, note }),
  });
}

const SSE_EVENTS = [
  'task_created', 'task_updated', 'task_completed', 'task_deleted',
  'offer_created', 'offer_updated', 'offers_purged',
  'points_updated',
  'category_created', 'category_updated', 'category_deleted',
  'project_created', 'project_updated', 'project_deleted',
  'group_created', 'group_updated', 'group_deleted',
  'group_member_added', 'group_member_removed',
  'heartbeat',
] as const;

export interface SSEClient { stop(): void; }

export function sseConnect(onEvent: (name: string, data: unknown) => void): SSEClient {
  let src: EventSource | null = null;
  let stopped = false;
  let backoff = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let lastEvent = Date.now();

  function clearReconnect() {
    if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  }

  function open() {
    if (stopped) return;
    const token = localStorage.getItem('access_token');
    const es = new EventSource(`${BASE}/events?token=${token}`);
    src = es;

    es.onopen = () => { backoff = 1000; lastEvent = Date.now(); };

    es.onerror = () => {
      es.close();
      if (src === es) src = null;
      if (stopped) return;
      const jitter = backoff * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.min(backoff + jitter, 30_000);
      backoff = Math.min(backoff * 2, 30_000);
      reconnectTimer = setTimeout(reconnect, delay);
    };

    const handle = (name: string) => (e: MessageEvent) => {
      lastEvent = Date.now();
      if (name === 'heartbeat') return;
      try { onEvent(name, JSON.parse(e.data)); } catch { /* skip */ }
    };
    for (const ev of SSE_EVENTS) {
      es.addEventListener(ev, handle(ev) as EventListener);
    }
  }

  async function reconnect() {
    if (stopped) return;
    await tryRefresh();
    open();
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible' && (!src || src.readyState !== EventSource.OPEN)) {
      clearReconnect();
      void reconnect();
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  watchdogTimer = setInterval(() => {
    if (!stopped && Date.now() - lastEvent > 90_000) {
      src?.close(); src = null;
      clearReconnect();
      void reconnect();
    }
  }, 20_000);

  open();

  return {
    stop() {
      stopped = true;
      clearReconnect();
      if (watchdogTimer !== null) { clearInterval(watchdogTimer); watchdogTimer = null; }
      document.removeEventListener('visibilitychange', onVisible);
      src?.close(); src = null;
    },
  };
}
