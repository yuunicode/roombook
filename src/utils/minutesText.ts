const BULLET_PREFIX_PATTERN = /^(([-*•◦▪▫])\s+)+/;

function normalizeAgendaLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '';

  const withoutRepeatedBullets = trimmed.replace(BULLET_PREFIX_PATTERN, '- ');
  return withoutRepeatedBullets.replace(/\s+/g, ' ').trim();
}

export function formatAgendaMultiline(value: string | null | undefined): string {
  return (value ?? '')
    .split('\n')
    .map(normalizeAgendaLine)
    .filter(Boolean)
    .join('\n');
}

export function formatAgendaInline(value: string | null | undefined): string {
  const normalized = formatAgendaMultiline(value);
  if (!normalized) return '';
  return normalized.split('\n').join(' / ');
}
