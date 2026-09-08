export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const RATE_LIMITS = {
  DEFAULT: { ttlSeconds: 60, limit: 100 },
  AUTH_LOGIN: { ttlSeconds: 60, limit: 5 },
  AUTH_REGISTER: { ttlSeconds: 3600, limit: 5 },
  AUTH_PASSWORD_RESET: { ttlSeconds: 3600, limit: 5 },
  CSV_IMPORT: { ttlSeconds: 3600, limit: 10 },
  DATA_EXPORT: { ttlSeconds: 3600, limit: 5 },
} as const;

export const SESSION = {
  COOKIE_NAME: "esaas_session",
  CSRF_COOKIE_NAME: "esaas_csrf",
  CSRF_HEADER_NAME: "x-csrf-token",
  DEFAULT_TTL_HOURS: 720,
} as const;

export const CSV_IMPORT = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_ROWS: 10_000,
  MAX_CELL_LENGTH: 500,
  ALLOWED_MIME_TYPES: ["text/csv", "application/vnd.ms-excel", "text/plain"],
} as const;

export const DATA_EXPORT = {
  EXPIRY_HOURS: 24,
} as const;

export const ACCOUNT_DELETION = {
  GRACE_PERIOD_DAYS: 7,
} as const;

export const QUEUE_NAMES = {
  CSV_IMPORT: "csv-import",
  DATA_EXPORT: "data-export",
} as const;

/**
 * Leading characters that make a CSV cell interpretable as a spreadsheet
 * formula by Excel/Sheets/LibreOffice. Any exported/imported-then-exported
 * value starting with one of these must be neutralized (e.g. prefixed with
 * a leading apostrophe) to prevent CSV formula injection.
 */
export const CSV_FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"] as const;
