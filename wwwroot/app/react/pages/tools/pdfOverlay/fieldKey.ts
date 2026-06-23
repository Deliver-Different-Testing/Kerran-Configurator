// Ported verbatim from pdf-overlay-tool (src/lib/fieldKey.ts).
/**
 * The binding key is the contract a data producer sends values under (the renderer keys off it).
 * It's auto-derived from the field's human-readable Name, following the form-builder convention
 * of a camelCase machine key with a manual-edit escape hatch.
 */

/** camelCase slug of a Name: `"Pod recipient name"` → `"podRecipientName"`, `"field1"` → `"field1"`. */
export function toFieldKey(name: string): string {
  const words = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

/** Returns `key` if free, else the first of `key2`, `key3`, … not already in `taken`. */
export function dedupeKey(key: string, taken: Set<string>): string {
  if (!taken.has(key)) return key;
  let n = 2;
  while (taken.has(`${key}${n}`)) n += 1;
  return `${key}${n}`;
}

/**
 * The binding key after a Name change. Re-derives (deduped) only while the key was still in sync
 * with the old Name — `prevId === toFieldKey(prevLabel)`; once the user diverges the key manually,
 * the old key is kept. `taken` is the set of other fields' keys (excluding this one).
 */
export function nextBindingKey(prevId: string, prevLabel: string, nextLabel: string, taken: Set<string>): string {
  if (prevId !== toFieldKey(prevLabel)) return prevId;
  return dedupeKey(toFieldKey(nextLabel), taken);
}
