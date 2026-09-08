export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  /** Machine-readable error code, stable across releases. */
  code: string;
  /** Present only for validation errors — field-level messages. */
  details?: Record<string, string[]>;
}
