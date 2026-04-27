import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.unmock('../services/api');

import { api, ApiError, logout, purgeOffers, resetBalances, adjustBalance, sseConnect } from './api';

const mockFetch = vi.fn();
(globalThis as Record<string, unknown>).fetch = mockFetch;

function makeResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('ApiError', () => {
  it('has status and message', () => {
    const err = new ApiError(404, 'not found');
    expect(err.status).toBe(404);
    expect(err.message).toBe('not found');
    expect(err instanceof Error).toBe(true);
  });
});

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  it('get sends GET request and returns json', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { id: 1 }));
    const result = await api.get('/test');
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test'), expect.objectContaining({}));
    expect(result).toEqual({ id: 1 });
  });

  it('includes Authorization header when access_token exists', async () => {
    localStorage.setItem('access_token', 'mytoken');
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await api.get('/test');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Authorization']).toBe('Bearer mytoken');
  });

  it('post sends POST with JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { ok: true }));
    await api.post('/test', { name: 'foo' });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'foo' });
  });

  it('put sends PUT with JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await api.put('/test', { x: 1 });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('PUT');
  });

  it('patch sends PATCH with JSON body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, {}));
    await api.patch('/test', { x: 1 });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('PATCH');
  });

  it('delete sends DELETE request', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) } as Response);
    await api.delete('/test');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('DELETE');
  });

  it('returns undefined for 204 responses', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(null) } as Response);
    const result = await api.get('/test');
    expect(result).toBeUndefined();
  });

  it('throws ApiError on non-ok response with detail', async () => {
    mockFetch.mockResolvedValue(makeResponse(422, { detail: 'Validation failed' }, false));
    await expect(api.get('/test')).rejects.toThrow('Validation failed');
  });

  it('throws ApiError with HTTP status code fallback when no detail', async () => {
    mockFetch.mockResolvedValue(makeResponse(500, {}, false));
    await expect(api.get('/test')).rejects.toThrow('HTTP 500');
  });

  it('on 401 tries refresh and retries if successful', async () => {
    localStorage.setItem('refresh_token', 'refresh123');
    mockFetch
      .mockResolvedValueOnce(makeResponse(401, {}, false))
      .mockResolvedValueOnce(makeResponse(200, { access_token: 'newtoken' }))
      .mockResolvedValueOnce(makeResponse(200, { data: 'retried' }));
    const result = await api.get('/protected');
    expect(result).toEqual({ data: 'retried' });
    expect(localStorage.getItem('access_token')).toBe('newtoken');
  });

  it('on 401 throws ApiError if refresh fails', async () => {
    localStorage.setItem('refresh_token', 'refresh123');
    mockFetch
      .mockResolvedValueOnce(makeResponse(401, {}, false))
      .mockResolvedValueOnce(makeResponse(401, {}, false));
    await expect(api.get('/protected')).rejects.toThrow('Unauthorized');
  });

  it('on 401 with no refresh_token throws immediately', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}, false));
    await expect(api.get('/protected')).rejects.toThrow('Unauthorized');
  });

  it('on 401 with refresh network error throws ApiError', async () => {
    localStorage.setItem('refresh_token', 'tok');
    mockFetch
      .mockResolvedValueOnce(makeResponse(401, {}, false))
      .mockRejectedValueOnce(new Error('network'));
    await expect(api.get('/protected')).rejects.toThrow('Unauthorized');
  });
});

describe('logout', () => {
  it('removes tokens and dispatches doen:logout event', () => {
    localStorage.setItem('access_token', 'tok');
    localStorage.setItem('refresh_token', 'ref');
    const events: Event[] = [];
    window.addEventListener('doen:logout', e => events.push(e), { once: true });
    logout();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(events.length).toBe(1);
  });
});

describe('purgeOffers', () => {
  beforeEach(() => { mockFetch.mockReset(); localStorage.clear(); });

  it('posts to the correct endpoint', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { deleted_offer_ids: ['o1'] }));
    const result = await purgeOffers('g1', ['open', 'expired']);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/households/g1/admin/offers/purge');
    expect(init.method).toBe('POST');
    expect(result).toEqual({ deleted_offer_ids: ['o1'] });
  });
});

describe('resetBalances', () => {
  beforeEach(() => { mockFetch.mockReset(); localStorage.clear(); });

  it('posts to the correct endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(null) } as Response);
    await resetBalances('g1', ['u1', 'u2']);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/households/g1/admin/points/reset');
  });
});

describe('adjustBalance', () => {
  beforeEach(() => { mockFetch.mockReset(); localStorage.clear(); });

  it('posts adjustment to correct endpoint', async () => {
    const tx = { id: 'tx1', amount: 5 };
    mockFetch.mockResolvedValue(makeResponse(200, tx));
    const result = await adjustBalance('g1', 'u1', 5, 'note');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/households/g1/admin/points/adjust');
    expect(JSON.parse(init.body)).toMatchObject({ user_id: 'u1', delta: 5, note: 'note' });
    expect(result).toEqual(tx);
  });
});

describe('sseConnect', () => {
  it('creates EventSource and registers event listeners', () => {
    localStorage.setItem('access_token', 'tok');
    const received: [string, unknown][] = [];
    const src = sseConnect((name, data) => received.push([name, data]));
    expect(src).toBeTruthy();
    // Emit a task_created event via MockEventSource
    (src as any).emit('task_created', { id: 't1', title: 'Test' });
    expect(received[0]).toEqual(['task_created', { id: 't1', title: 'Test' }]);
    src.close();
  });

  it('silently handles malformed SSE data', () => {
    const src = sseConnect(() => {});
    // Bad JSON should not throw
    const badEvent = new MessageEvent('task_created', { data: 'not-json{{' });
    expect(() => (src as any).dispatchEvent(badEvent)).not.toThrow();
    src.close();
  });
});
