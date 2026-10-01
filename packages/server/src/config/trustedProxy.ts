import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

// Cloudflare's published origin ranges, verified 2026-10-01:
// https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
const cloudflareRanges = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22', '2400:cb00::/32',
  '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];
const proxyLayers = [
  ['127.0.0.1/32', '::1/128'], // Render's local ingress; actual socket peer.
  ['10.0.0.0/8'],             // Render's private proxy appended to XFF.
  cloudflareRanges,          // Public edge appended before Render ingress.
].map(layer => layer.map(cidr => ipaddr.parseCIDR(cidr)));

/** Trust address AND position in the observed Render ingress chain. Never
 * consume a caller's prefix, even when the client itself is in a proxy CIDR.
 * Missing/unknown layers stop traversal; no guessed hop or trust-all fallback.
 * Forwarded/CF-Connecting-IP/X-Real-IP are deliberately not identity sources.
 */
export function renderProxyTrust(address: string, layer: number): boolean {
  if (!isIP(address) || !proxyLayers[layer]) return false;
  const ip = ipaddr.process(address);
  return proxyLayers[layer].some(([network, bits]) =>
    ip instanceof ipaddr.IPv4 && network instanceof ipaddr.IPv4 ? ip.match(network, bits) :
    ip instanceof ipaddr.IPv6 && network instanceof ipaddr.IPv6 ? ip.match(network, bits) : false);
}

export function getTrustProxy(env: NodeJS.ProcessEnv = process.env): false | typeof renderProxyTrust {
  const mode = env.TRUST_PROXY ?? 'false';
  if (mode === 'false' || mode === '0') return false;
  if (mode === 'render' && env.RENDER === 'true') return renderProxyTrust;
  throw new Error('TRUST_PROXY must be false (direct traffic), or render on a Render service. Numeric hop counts and trust-all are unsupported.');
}

/** Collapse IPv4-mapped IPv6 and equivalent IPv6 spellings. IPv6 clients share
 * a /64 bucket so rotating interface/privacy addresses cannot mint new limits.
 * Invalid addresses collapse to one fail-closed bucket, never raw header text.
 */
export function normalizeRateLimitIp(address: string | undefined): string {
  if (!address || !isIP(address)) return 'unknown';
  const ip = ipaddr.process(address);
  if (ip instanceof ipaddr.IPv4) return ip.toString();
  return `${new ipaddr.IPv6([...ip.parts.slice(0, 4), 0, 0, 0, 0]).toString()}/64`;
}
