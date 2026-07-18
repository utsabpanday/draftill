export function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select'));
}

export function eventMatchesShortcut(event: KeyboardEvent, shortcut: string) {
  const parts = shortcut.trim().split(/[+-]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return false;

  const expectedKey = parts.at(-1)!.toLowerCase();
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));
  const expectsControl = modifiers.has('ctrl') || modifiers.has('control') || modifiers.has('mod');
  const expectsMeta = modifiers.has('meta') || modifiers.has('cmd') || modifiers.has('command');
  const expectsAlt = modifiers.has('alt') || modifiers.has('option');
  const expectsShift = modifiers.has('shift');
  const controlMatches = modifiers.has('mod')
    ? event.ctrlKey || event.metaKey
    : event.ctrlKey === expectsControl && event.metaKey === expectsMeta;

  const aliases: Record<string, string> = {
    esc: 'escape',
    return: 'enter',
    space: ' ',
    comma: ',',
    period: '.'
  };
  const actualKey = event.key.toLowerCase();
  const normalizedExpectedKey = aliases[expectedKey] ?? expectedKey;
  const keyMatches = actualKey === normalizedExpectedKey
    || (/^\d$/.test(normalizedExpectedKey) && event.code.toLowerCase() === `digit${normalizedExpectedKey}`);

  return controlMatches
    && event.altKey === expectsAlt
    && event.shiftKey === expectsShift
    && keyMatches;
}
