/** Hosts that require proxying due to hotlink protection */
const PROXY_REQUIRED_HOSTS = ["liveauctioneers.com"];

/**
 * Wraps an image URL with the proxy endpoint if it needs hotlink bypass.
 * URLs from other domains are returned as-is.
 */
export function getProxiedImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const needsProxy = PROXY_REQUIRED_HOSTS.some((host) =>
      parsed.hostname.endsWith(host),
    );
    if (needsProxy) {
      return `/api/image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Invalid URL, return as-is
  }
  return url;
}
