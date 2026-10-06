export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
    [key: string]: any;
  };
  error?: string;
  code?: string;
  details?: any;
}

export function success<T>(data: T, meta?: object): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: meta || undefined
  };
}

export function error(message: string, code?: string, details?: unknown): ApiResponse<null> {
  return {
    success: false,
    error: message,
    code: code || undefined,
    details: details || undefined
  };
}
