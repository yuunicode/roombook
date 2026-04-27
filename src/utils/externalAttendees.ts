export function parseExternalAttendees(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;

      const normalized = item.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function mergeExternalAttendeeTokens(tokens: string[], input: string): string[] {
  const nextTokens = tokens.slice();
  const seen = new Set(tokens.map((item) => item.toLowerCase()));

  for (const item of parseExternalAttendees(input)) {
    const normalized = item.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    nextTokens.push(item);
  }

  return nextTokens;
}

export function serializeExternalAttendees(tokens: string[]): string {
  return tokens.join(', ');
}
