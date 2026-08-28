import { isIP } from 'node:net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google.com',
  'host.docker.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

function normalizeHost(host) {
  return host.toLowerCase().replace(/^\[|\]$/g, '');
}

function isPrivateIpv4(host) {
  const parts = host.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(host) {
  if (host === '::1' || host === '::' || host === '0:0:0:0:0:0:0:1') return true;
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

/**
 * True when delivering to this URL would let HookVault be used as an SSRF
 * trampoline onto the host's loopback, link-local metadata, or RFC1918 net.
 * Hostname-only checks (no DNS) — operators can still target a public name
 * that later resolves privately; blocking literals covers the common cases.
 */
export function isBlockedDeliveryUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
  const host = normalizeHost(u.hostname);
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.localhost')) return true;
  const version = isIP(host);
  if (version === 4) return isPrivateIpv4(host);
  if (version === 6) return isPrivateIpv6(host);
  return false;
}
