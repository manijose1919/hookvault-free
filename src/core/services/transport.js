import { signPayload } from '../../shared/signing.js';

// The HTTP transport used to POST a signed payload to a customer endpoint.
// Isolated behind a single function so the delivery engine can be tested with
// a fake transport (no network) and so timeouts are enforced consistently.

export async function httpDeliver({ url, signingSecret, body, timeoutMs }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(signingSecret, timestamp, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'HookVault/1.0',
        'x-hookvault-timestamp': timestamp,
        'x-hookvault-signature': `v1=${signature}`,
      },
      body,
      signal: controller.signal,
    });

    // We don't use the response body; cancel the stream so the connection is
    // released back to the pool (otherwise sockets leak under load).
    if (res.body) {
      try {
        await res.body.cancel();
      } catch {
        /* stream already closed */
      }
    }

    return {
      ok: res.ok, // 2xx
      status: res.status,
      durationMs: Date.now() - startedAt,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: err.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}
