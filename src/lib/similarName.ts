/**
 * "Is this the same person, spelled differently?"
 *
 * Two different questions, with two different answers:
 *
 *   "Mehaboob" vs "MEHABOOB"  — the same name typed differently. The caller
 *                               treats this as a duplicate and refuses it
 *                               (see normalizeName / the DB's unique index).
 *   "MEHABOOB" vs "MAHABOOB"  — a different spelling. It *might* be the same
 *                               person and it might be two real people, and
 *                               nothing here can tell which. So this module
 *                               only ever reports a suspicion; whether to go
 *                               ahead is the user's call, never the code's.
 *
 * Transliterated names are the whole reason this exists. The same person can
 * reasonably be written Mehaboob / Mahaboob / Mehboob / Mahboob, and a plain
 * string comparison sees four unrelated people.
 */

/** Letters and digits only, lower-cased — spacing and punctuation never matter. */
function letters(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Collapses the spellings that differ only in how a sound was written down,
 * so Mehaboob / Mahaboob / Mehboob all reduce to the same key.
 *
 * Deliberately crude: it is a *hint* generator, and over-matching here costs
 * the user one glance at a list, while under-matching costs a duplicate
 * driver nobody notices until the wages are wrong.
 */
function soundKey(value: string): string {
  let key = letters(value);
  if (!key) return "";

  // Common transliteration pairs, applied before vowels are dropped.
  key = key
    .replace(/ph/g, "f")
    .replace(/[kq]h?/g, "k")
    .replace(/gh/g, "g")
    .replace(/[sc]h/g, "s")
    .replace(/th/g, "t")
    .replace(/dh/g, "d")
    .replace(/bh/g, "b")
    .replace(/[vw]/g, "v")
    .replace(/[yj]/g, "y")
    .replace(/z/g, "s");

  // Keep the first letter (it is the one people get right), then drop vowels
  // from the rest: the vowels are exactly what varies between Mehaboob and
  // Mahaboob, while the consonant skeleton m-h-b-b stays put.
  const first = key[0];
  const rest = key.slice(1).replace(/[aeiou]/g, "");

  // Collapse doubled letters last ("boob" → "bob"), so a repeated letter in
  // one spelling and not the other still matches.
  return (first + rest).replace(/(.)\1+/g, "$1");
}

/**
 * Levenshtein distance, capped: once it is clear the strings are further
 * apart than [max] the exact number stops mattering, so it bails early
 * rather than filling the whole matrix.
 */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + cost, // substitution
      );
      current.push(value);
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * How many single-character edits are tolerated for a name of this length.
 * Short names get no slack — "Ravi" and "Ravu" are two letters apart out of
 * four and far more likely to be two people than one typo.
 */
function allowedEdits(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * True when [candidate] is close enough to [existing] to be worth showing the
 * user before they add it. Never a reason to refuse anything on its own.
 */
export function isSimilarName(candidate: string, existing: string): boolean {
  const a = letters(candidate);
  const b = letters(existing);
  if (!a || !b) return false;

  // Identical once case and spacing are ignored. The caller blocks this
  // outright, but report it so a caller that only warns still sees it.
  if (a === b) return true;

  // One name contains the other in full ("Ramesh" vs "Ramesh Kumar"). Guarded
  // by a length floor so a two-letter name doesn't match half the roster.
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;

  // Same consonant skeleton: Mehaboob / Mahaboob / Mehboob. Dropping vowels
  // throws away a lot, so it only gets a say on names long enough for the
  // consonants that remain to be distinctive — otherwise "Ravi" and "Ravu"
  // both collapse to "rv" and read as one person.
  if (Math.min(a.length, b.length) >= 5) {
    const keyA = soundKey(a);
    const keyB = soundKey(b);
    if (keyA && keyA === keyB) return true;
  }

  // A spelling slip or two, scaled to the length of the name.
  const max = allowedEdits(Math.min(a.length, b.length));
  return max > 0 && editDistance(a, b, max) <= max;
}

export interface SimilarNameCandidate {
  id: number;
  name: string;
}

/**
 * Every existing row whose name is close enough to [name] to be worth a
 * second look, newest-match-first order left to the caller.
 */
export function findSimilarNames<T extends SimilarNameCandidate>(
  name: string,
  rows: T[],
  excludeId: number | null = null,
): T[] {
  return rows.filter(
    (row) => row.id !== excludeId && isSimilarName(name, row.name),
  );
}
