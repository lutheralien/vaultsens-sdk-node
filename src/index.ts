export type ApiSuccess<T> = {
  status: number;
  message: string;
  data: T;
};

export type ApiError = {
  status: number;
  message: string;
  data?: unknown;
};

export type FileRecord = {
  _id?: string;
  fileId?: string;
  cloudId?: string;
  filename: string;
  originalFilename?: string;
  url: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
  folderId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Folder = {
  _id: string;
  name: string;
  parentId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Metrics = {
  totalFiles: number;
  totalStorageBytes: number;
  averageFileSize: number;
  storageLimitBytes: number;
  storageRemainingBytes: number;
  storageUsedPercent: number;
  uploadsLast7Days: number;
  latestUploadAt?: string | null;
  byMimeType: Record<string, number>;
};

export type FetchLike = typeof fetch;

export type RetryOptions = {
  retries: number;
  retryDelayMs?: number;
  retryOn?: number[];
};

export type VaultSensClientOptions = {
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  retry?: RetryOptions;
};

export type CompressionLevel = 'none' | 'low' | 'medium' | 'high';

export type UploadOptions = {
  name?: string;
  compression?: CompressionLevel;
  filename?: string;
  folderId?: string;
};

export type TransformOptions = {
  width?: number;
  height?: number;
  format?: string;
  quality?: number | string;
};

/**
 * Error codes returned by the VaultSens API.
 *
 * Upload / plan-limit errors
 *   FILE_TOO_LARGE        – 413  file exceeds plan's maxFileSizeBytes
 *   STORAGE_LIMIT         – 413  total storage quota exceeded
 *   FILE_COUNT_LIMIT      – 403  plan's maxFilesCount reached
 *   MIME_TYPE_NOT_ALLOWED – 415  file type blocked by plan
 *   COMPRESSION_NOT_ALLOWED – 403  compression level not permitted by plan
 *   SUBSCRIPTION_INACTIVE – 402  user subscription is not active
 *   FOLDER_COUNT_LIMIT    – 403  plan's maxFoldersCount reached
 *
 * Auth errors
 *   EMAIL_ALREADY_REGISTERED – 400  duplicate email on register
 *   EMAIL_NOT_VERIFIED        – 403  login attempted before verifying email
 *   INVALID_CREDENTIALS       – 400  wrong email or password
 *   INVALID_OTP               – 400  bad/expired verification code
 *
 * Generic
 *   UNAUTHORIZED – 401
 *   NOT_FOUND    – 404
 *   TIMEOUT      – 408
 */
export const VaultSensErrorCode = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  STORAGE_LIMIT: 'STORAGE_LIMIT',
  FILE_COUNT_LIMIT: 'FILE_COUNT_LIMIT',
  MIME_TYPE_NOT_ALLOWED: 'MIME_TYPE_NOT_ALLOWED',
  COMPRESSION_NOT_ALLOWED: 'COMPRESSION_NOT_ALLOWED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  FOLDER_COUNT_LIMIT: 'FOLDER_COUNT_LIMIT',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_OTP: 'INVALID_OTP',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type VaultSensErrorCode = typeof VaultSensErrorCode[keyof typeof VaultSensErrorCode];

function resolveErrorCode(status: number, message: string): VaultSensErrorCode {
  const m = message.toLowerCase();
  if (status === 413 && m.includes('storage limit')) return VaultSensErrorCode.STORAGE_LIMIT;
  if (status === 413) return VaultSensErrorCode.FILE_TOO_LARGE;
  if (status === 415) return VaultSensErrorCode.MIME_TYPE_NOT_ALLOWED;
  if (status === 402) return VaultSensErrorCode.SUBSCRIPTION_INACTIVE;
  if (status === 403 && m.includes('compression')) return VaultSensErrorCode.COMPRESSION_NOT_ALLOWED;
  if (status === 403 && m.includes('folder')) return VaultSensErrorCode.FOLDER_COUNT_LIMIT;
  if (status === 403 && (m.includes('file') || m.includes('maximum'))) return VaultSensErrorCode.FILE_COUNT_LIMIT;
  if (status === 403 && m.includes('email')) return VaultSensErrorCode.EMAIL_NOT_VERIFIED;
  if (status === 400 && m.includes('already registered')) return VaultSensErrorCode.EMAIL_ALREADY_REGISTERED;
  if (status === 400 && (m.includes('invalid email or password') || m.includes('invalid credentials'))) return VaultSensErrorCode.INVALID_CREDENTIALS;
  if (status === 400 && m.includes('otp')) return VaultSensErrorCode.INVALID_OTP;
  if (status === 401) return VaultSensErrorCode.UNAUTHORIZED;
  if (status === 404) return VaultSensErrorCode.NOT_FOUND;
  if (status === 408) return VaultSensErrorCode.TIMEOUT;
  return VaultSensErrorCode.UNKNOWN;
}

export class VaultSensError extends Error {
  status: number;
  code: VaultSensErrorCode;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'VaultSensError';
    this.status = status;
    this.code = resolveErrorCode(status, message);
    this.data = data;
  }
}

export class VaultSensClient {
  private baseUrl: string;
  private apiKey?: string;
  private apiSecret?: string;
  private fetchImpl: FetchLike;
  private timeoutMs: number;
  private retry: Required<RetryOptions>;

  constructor(options: VaultSensClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.apiSecret = options.apiSecret;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.retry = {
      retries: options.retry?.retries ?? 2,
      retryDelayMs: options.retry?.retryDelayMs ?? 400,
      retryOn: options.retry?.retryOn ?? [429, 500, 502, 503, 504],
    };
  }

  setAuth(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  setTimeout(timeoutMs: number) {
    this.timeoutMs = timeoutMs;
  }

  setRetry(options: RetryOptions) {
    this.retry = {
      retries: options.retries,
      retryDelayMs: options.retryDelayMs ?? this.retry.retryDelayMs,
      retryOn: options.retryOn ?? this.retry.retryOn,
    };
  }

  async uploadFile(file: Blob, options: UploadOptions = {}): Promise<ApiSuccess<FileRecord>> {
    const form = new FormData();
    form.append('file', file, options.filename || 'file');
    if (options.name) {
      form.append('name', options.name);
    }
    if (options.compression !== undefined) {
      form.append('compression', options.compression);
    }
    if (options.folderId) {
      form.append('folderId', options.folderId);
    }

    return this.request<ApiSuccess<FileRecord>>('/api/v1/files/upload', {
      method: 'POST',
      body: form,
    });
  }

  async uploadFiles(
    files: Array<{ file: Blob; filename?: string }>,
    options: UploadOptions = {}
  ): Promise<ApiSuccess<FileRecord[]>> {
    const form = new FormData();
    files.forEach((item) => {
      form.append('files', item.file, item.filename || 'file');
    });
    if (options.name) {
      form.append('name', options.name);
    }
    if (options.compression !== undefined) {
      form.append('compression', options.compression);
    }
    if (options.folderId) {
      form.append('folderId', options.folderId);
    }

    return this.request<ApiSuccess<FileRecord[]>>('/api/v1/files/upload', {
      method: 'POST',
      body: form,
    });
  }

  async listFiles(folderId?: string): Promise<ApiSuccess<FileRecord[]>> {
    const path = folderId ? `/api/v1/files?folderId=${encodeURIComponent(folderId)}` : '/api/v1/files';
    return this.request<ApiSuccess<FileRecord[]>>(path, { method: 'GET' });
  }

  async listFolders(): Promise<ApiSuccess<Folder[]>> {
    return this.request<ApiSuccess<Folder[]>>('/api/v1/folders', { method: 'GET' });
  }

  async createFolder(name: string, parentId?: string): Promise<ApiSuccess<Folder>> {
    return this.request<ApiSuccess<Folder>>('/api/v1/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    });
  }

  async renameFolder(folderId: string, name: string): Promise<ApiSuccess<Folder>> {
    return this.request<ApiSuccess<Folder>>(`/api/v1/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  async deleteFolder(folderId: string): Promise<ApiSuccess<null>> {
    return this.request<ApiSuccess<null>>(`/api/v1/folders/${folderId}`, { method: 'DELETE' });
  }

  async getFileMetadata(fileId: string): Promise<ApiSuccess<FileRecord>> {
    return this.request<ApiSuccess<FileRecord>>(`/api/v1/files/metadata/${fileId}`, {
      method: 'GET',
    });
  }

  async updateFile(fileId: string, file: Blob, options: UploadOptions = {}): Promise<ApiSuccess<FileRecord>> {
    const form = new FormData();
    form.append('file', file, options.filename || 'file');
    if (options.name) {
      form.append('name', options.name);
    }
    if (options.compression !== undefined) {
      form.append('compression', options.compression);
    }

    return this.request<ApiSuccess<FileRecord>>(`/api/v1/files/${fileId}`, {
      method: 'PUT',
      body: form,
    });
  }

  async deleteFile(fileId: string): Promise<ApiSuccess<null>> {
    return this.request<ApiSuccess<null>>(`/api/v1/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  async getMetrics(): Promise<ApiSuccess<Metrics>> {
    return this.request<ApiSuccess<Metrics>>('/api/v1/metrics', {
      method: 'GET',
    });
  }

  buildFileUrl(fileId: string, options: TransformOptions = {}) {
    const url = new URL(`${this.baseUrl}/api/v1/files/${fileId}`);
    if (options.width) url.searchParams.set('width', String(options.width));
    if (options.height) url.searchParams.set('height', String(options.height));
    if (options.format) url.searchParams.set('format', options.format);
    if (options.quality !== undefined) url.searchParams.set('quality', String(options.quality));
    return url.toString();
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.apiKey || !this.apiSecret) {
      throw new VaultSensError('API key and secret are required', 401);
    }

    const headers = new Headers(init.headers || {});
    headers.set('x-api-key', this.apiKey);
    headers.set('x-api-secret', this.apiSecret);

    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          ...init,
          headers,
          signal: controller.signal,
        });

        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await response.json() : await response.text();

        if (!response.ok) {
          const message = (payload && (payload.message || payload.error)) || response.statusText;
          const error = new VaultSensError(message, response.status, payload);
          if (this.shouldRetry(response.status, attempt)) {
            attempt += 1;
            await this.sleep(this.retry.retryDelayMs);
            continue;
          }
          throw error;
        }

        return payload as T;
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          if (this.shouldRetry(0, attempt)) {
            attempt += 1;
            await this.sleep(this.retry.retryDelayMs);
            continue;
          }
          throw new VaultSensError('Request timed out', 408);
        }

        if (this.shouldRetry(0, attempt)) {
          attempt += 1;
          await this.sleep(this.retry.retryDelayMs);
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  private shouldRetry(status: number, attempt: number) {
    if (attempt >= this.retry.retries) {
      return false;
    }
    if (status === 0) {
      return true;
    }
    return this.retry.retryOn.includes(status);
  }

  private async sleep(delayMs: number) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

const toArrayBuffer = (buffer: ArrayBuffer | Uint8Array) => {
  if (buffer instanceof Uint8Array) {
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    return copy.buffer;
  }
  return buffer;
};

export const fileFromBuffer = (
  buffer: ArrayBuffer | Uint8Array,
  _filename: string,
  type = 'application/octet-stream'
) => {
  const data = toArrayBuffer(buffer);
  return new Blob([data], { type });
};
