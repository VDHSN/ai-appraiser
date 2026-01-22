/**
 * Wraps an image URL with the proxy endpoint to bypass hotlink protection.
 */
export function getProxiedImageUrl(url: string): string {
  return `/api/image?url=${encodeURIComponent(url)}`;
}
