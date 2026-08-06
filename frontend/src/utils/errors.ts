/** Extracts a human-readable message from a caught value, falling back when it isn't an Error. */
export function toErrorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}
