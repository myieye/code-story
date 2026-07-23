/** Host of a URL for display in a title, or the raw string when it doesn't parse. */
export function linkHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
