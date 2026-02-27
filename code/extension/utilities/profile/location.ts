export function extractProfileIdentifierFromUrl(url: URL): string | null {
  const match = url.pathname.match(/^\/profile\/([^\/]+)/);
  return match ? match[1] : null;
}
