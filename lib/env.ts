// Helpers for reading configuration from environment variables (.env — see .env.example).

/** Fail fast with an actionable message when a required variable is missing. */
export function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        'Copy .env.example to .env and fill in the values.'
    );
  }
  return value;
}

/** Same as `required`, but the value must also parse as an integer. */
export function int(value: string | undefined, name: string): number {
  const n = Number.parseInt(required(value, name), 10);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable "${name}" must be an integer (got "${value}").`);
  }
  return n;
}
