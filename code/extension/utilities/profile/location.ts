export function getProfileIdentifierFromUrl(url: URL): string | null {
  const match = url.pathname.match(/^\/profile\/([^/]+)/);
  return match ? match[1] : null;
}

export function isProfilePage(url: URL): boolean {
  return /^\/profile\/[^/]+/.test(url.pathname);
}

export function getProfileUrl(userIdentifier: string): string {
  return `https://www.leboncoin.fr/profile/${userIdentifier}`;
}
