/** Case/whitespace-insensitive key for matching near-duplicate entity names
 * ("SS LOGISTICS - SUKANYA" vs "SS LOGISTICS -SUKANYA" vs
 * "SSLOGISTICS-DEEKSHITH") — mirrors the DB index in
 * sql/42_entities_normalized_name_unique.sql. */
export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}
