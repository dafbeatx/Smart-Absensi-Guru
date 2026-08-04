import { APP_CONFIG } from '../config/app.config';
import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';

export interface ApiResponse<T = unknown> {
  success?: boolean;
  status?: 'success' | 'error';
  statusCode?: number;
  message?: string;
  code?: string;
  data?: T;
  payload?: T;
  timestamp?: string;
}

export class ApiError extends Error {
  public code: string;
  public solution: string;
  public statusCode: number;

  constructor(errorDef: ErrorDefinition, statusCode: number = 400) {
    super(errorDef.message);
    this.name = 'ApiError';
    this.code = errorDef.code;
    this.solution = errorDef.solution;
    this.statusCode = statusCode;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = APP_CONFIG.REQUEST_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (err: unknown) {
      clearTimeout(id);
      console.error(`🔥 [Fetch Exception] URL: ${url}`, err);
      if (err instanceof Error && err.name === 'AbortError') {
        const errDef = getErrorDefinition('SYS_002');
        console.error(`⏱️ [Timeout Error] Request exceeded ${timeoutMs}ms`, errDef);
        throw new ApiError(errDef, 504);
      }
      const netErrDef = getErrorDefinition('SYS_001');
      console.error(`🌐 [Network Error] Gagal terhubung ke Google Apps Script:`, err);
      throw new ApiError(netErrDef, 503);
    }
  }

  private isHeavyAction(action: string): boolean {
    const HEAVY_ACTIONS = [
      'UPDATE_SETTINGS',
      'BULK_CREATE_USERS',
      'GENERATE_REPORT',
      'IMPORT_TEACHERS',
      'RESTORE_DATABASE',
      'RUN_MIGRATION',
    ];
    return HEAVY_ACTIONS.includes(action);
  }

  private async request<T>(
    action: string,
    body: Record<string, unknown> = {},
    retries: number = APP_CONFIG.MAX_RETRIES,
    customTimeoutMs?: number
  ): Promise<T> {
    const timeoutMs =
      customTimeoutMs ||
      (this.isHeavyAction(action)
        ? APP_CONFIG.HEAVY_REQUEST_TIMEOUT_MS
        : APP_CONFIG.REQUEST_TIMEOUT_MS);

    const url = `${this.baseUrl}?action=${encodeURIComponent(action)}`;

    const payloadWithMeta = {
      action,
      ...body,
      client_timestamp: new Date().toISOString(),
    };

    console.log(`📡 [API POST Request] Action: ${action} | Timeout: ${timeoutMs}ms`, payloadWithMeta);

    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // GAS Web App CORS friendly
      },
      body: JSON.stringify(payloadWithMeta),
    };

    let attempt = 0;
    while (attempt < retries) {
      try {
        const response = await this.fetchWithTimeout(url, options, timeoutMs);
        const json: ApiResponse<T> = await response.json();

        console.log(`📩 [API Response Received] Action: ${action}`, json);

        // Support both GAS backend format ({ success: boolean }) & standard REST ({ status: 'success' | 'error' })
        const isError = json.success === false || json.status === 'error';
        if (isError) {
          const code = json.code || 'SYS_999';
          const defaultDef = getErrorDefinition(code);
          const customDef: ErrorDefinition = {
            code: code,
            message: json.message || defaultDef.message,
            solution: defaultDef.solution,
          };

          console.error(`❌ [API Error Response] Action: ${action} | Code: ${code} | Message: ${customDef.message}`, {
            responsePayload: json,
            errorDetail: customDef,
          });

          throw new ApiError(customDef, json.statusCode || 400);
        }

        // Return data payload
        if (json.data !== undefined && json.data !== null) {
          return json.data as T;
        }
        if (json.payload !== undefined && json.payload !== null) {
          return json.payload as T;
        }
        return json as unknown as T;
      } catch (err) {
        attempt++;
        console.warn(`⚠️ [API Attempt ${attempt}/${retries} Failed] Action: ${action}`, err);

        if (attempt >= retries || (err instanceof ApiError && err.statusCode < 500)) {
          if (err instanceof ApiError) {
            console.error(`🚨 [Fatal API Error] Throwing ApiError:`, err);
            throw err;
          }
          const sysErr = new ApiError(getErrorDefinition('SYS_001'), 503);
          console.error(`🚨 [Fatal Network Error] Exceeded retries:`, sysErr);
          throw sysErr;
        }
        // Delay before retry
        await new Promise((resolve) => setTimeout(resolve, APP_CONFIG.RETRY_DELAY_MS * attempt));
      }
    }

    throw new ApiError(getErrorDefinition('SYS_002'), 504);
  }

  public async post<T>(
    action: string,
    data: Record<string, unknown> = {},
    customTimeoutMs?: number
  ): Promise<T> {
    return this.request<T>(action, data, APP_CONFIG.MAX_RETRIES, customTimeoutMs);
  }

  public async get<T>(
    action: string,
    params: Record<string, string> = {},
    customTimeoutMs?: number
  ): Promise<T> {
    const timeoutMs =
      customTimeoutMs ||
      (this.isHeavyAction(action)
        ? APP_CONFIG.HEAVY_REQUEST_TIMEOUT_MS
        : APP_CONFIG.REQUEST_TIMEOUT_MS);

    const query = new URLSearchParams({ action, ...params }).toString();
    const url = `${this.baseUrl}?${query}`;

    console.log(`📡 [API GET Request] Action: ${action} | Timeout: ${timeoutMs}ms`, params);

    try {
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
      const json: ApiResponse<T> = await response.json();

      console.log(`📩 [API Response Received] Action: ${action}`, json);

      const isError = json.success === false || json.status === 'error';
      if (isError) {
        const code = json.code || 'SYS_999';
        const defaultDef = getErrorDefinition(code);
        const customDef: ErrorDefinition = {
          code: code,
          message: json.message || defaultDef.message,
          solution: defaultDef.solution,
        };

        console.error(`❌ [API Error Response] Action: ${action} | Code: ${code} | Message: ${customDef.message}`, {
          responsePayload: json,
          errorDetail: customDef,
        });

        throw new ApiError(customDef, json.statusCode || 400);
      }

      if (json.data !== undefined && json.data !== null) {
        return json.data as T;
      }
      if (json.payload !== undefined && json.payload !== null) {
        return json.payload as T;
      }
      return json as unknown as T;
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(`🚨 [Fatal API GET Error]:`, err);
        throw err;
      }
      const sysErr = new ApiError(getErrorDefinition('SYS_001'), 503);
      console.error(`🚨 [Fatal GET Network Error]:`, sysErr);
      throw sysErr;
    }
  }
}

export const apiClient = new ApiClient(APP_CONFIG.API_URL);
