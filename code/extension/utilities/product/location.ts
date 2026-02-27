export function getProductIdentifierFromUrl(url: URL): string | null {
  const match = url.pathname.match(/^\/ad\/[^\/]+\/(\d+)/);
  return match ? match[1] : null;
}
