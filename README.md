# @vaultsens/sdk

JavaScript/TypeScript SDK for VaultSens. Supports API key + secret auth, file uploads, folder management, and image transforms.

## Install

```bash
npm install @vaultsens/sdk
```

## Quick start

```ts
import { VaultSensClient, fileFromBuffer } from '@vaultsens/sdk';

const client = new VaultSensClient({
  baseUrl: 'https://api.vaultsens.com',
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
});

// Upload a file (browser)
const file = new File([blobData], 'photo.png', { type: 'image/png' });
const result = await client.uploadFile(file, { name: 'hero', compression: 'low' });
console.log(result.data._id, result.data.url);

// Upload from a Buffer (Node.js)
import { readFile } from 'node:fs/promises';
const buffer = await readFile('./photo.png');
const blob = fileFromBuffer(buffer, 'photo.png', 'image/png');
const result = await client.uploadFile(blob, { filename: 'photo.png' });
```

## Auth

Credentials are sent as request headers:

```
x-api-key:    <apiKey>
x-api-secret: <apiSecret>
```

---

## API reference

### `new VaultSensClient(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | — | Your VaultSens API base URL |
| `apiKey` | `string` | — | API key |
| `apiSecret` | `string` | — | API secret |
| `timeoutMs` | `number` | `30000` | Request timeout in ms |
| `retry.retries` | `number` | `2` | Number of retry attempts |
| `retry.retryDelayMs` | `number` | `400` | Delay between retries in ms |
| `retry.retryOn` | `number[]` | `[429,500,502,503,504]` | Status codes to retry on |

---

### Files

#### `uploadFile(file, options?)`

Upload a single file.

```ts
const result = await client.uploadFile(blob, {
  name: 'my-image',          // optional display name
  filename: 'photo.png',     // optional filename hint
  compression: 'medium',     // 'none' | 'low' | 'medium' | 'high'
  folderId: 'folder-id',     // optional folder to place the file in
});
// result.data._id  — file ID
// result.data.url  — public URL
```

#### `uploadFiles(files, options?)`

Upload multiple files in one request.

```ts
const result = await client.uploadFiles(
  [
    { file: blob1, filename: 'a.png' },
    { file: blob2, filename: 'b.jpg' },
  ],
  { compression: 'low', folderId: 'folder-id' }
);
```

#### `listFiles(folderId?)`

List all files. Pass `folderId` to filter by folder, or `"root"` for files not in any folder.

```ts
const all    = await client.listFiles();
const inDir  = await client.listFiles('folder-id');
const atRoot = await client.listFiles('root');
```

#### `getFileMetadata(fileId)`

```ts
const meta = await client.getFileMetadata('file-id');
```

#### `updateFile(fileId, file, options?)`

Replace a file's content. Accepts the same options as `uploadFile` except `folderId`.

```ts
await client.updateFile('file-id', newBlob, { compression: 'high' });
```

#### `deleteFile(fileId)`

```ts
await client.deleteFile('file-id');
```

#### `buildFileUrl(fileId, options?)`

Build a URL for dynamic image transforms (served by the API).

```ts
const url = client.buildFileUrl('file-id', {
  width: 800,
  height: 600,
  format: 'webp',
  quality: 80,
});
```

---

### Folders

#### `listFolders()`

```ts
const { data: folders } = await client.listFolders();
```

#### `createFolder(name, parentId?)`

```ts
const { data: folder } = await client.createFolder('Marketing');
// nested folder:
await client.createFolder('2024', folder._id);
```

#### `renameFolder(folderId, name)`

```ts
await client.renameFolder('folder-id', 'New Name');
```

#### `deleteFolder(folderId)`

Deletes the folder and moves all its files back to root.

```ts
await client.deleteFolder('folder-id');
```

---

### Metrics

```ts
const { data } = await client.getMetrics();
// data.totalFiles, data.totalStorageBytes, data.storageUsedPercent, ...
```

---

### Utilities

#### `fileFromBuffer(buffer, filename, type?)`

Convert a `Buffer` or `ArrayBuffer` to a `Blob` for upload in Node.js environments.

```ts
import { fileFromBuffer } from '@vaultsens/sdk';

const blob = fileFromBuffer(buffer, 'photo.png', 'image/png');
await client.uploadFile(blob, { filename: 'photo.png' });
```

#### `setAuth(apiKey, apiSecret)`
#### `setTimeout(timeoutMs)`
#### `setRetry(options)`

---

## Error handling

All API errors throw a `VaultSensError` with a `code`, `status`, and `message`.

```ts
import { VaultSensError, VaultSensErrorCode } from '@vaultsens/sdk';

try {
  await client.uploadFile(blob);
} catch (err) {
  if (err instanceof VaultSensError) {
    switch (err.code) {
      case VaultSensErrorCode.FILE_TOO_LARGE:
        console.error('File exceeds your plan limit');
        break;
      case VaultSensErrorCode.STORAGE_LIMIT:
        console.error('Storage quota exceeded');
        break;
      case VaultSensErrorCode.MIME_TYPE_NOT_ALLOWED:
        console.error('File type not allowed on your plan');
        break;
      case VaultSensErrorCode.COMPRESSION_NOT_ALLOWED:
        console.error('Compression level not permitted on your plan');
        break;
      case VaultSensErrorCode.FILE_COUNT_LIMIT:
        console.error('File count limit reached');
        break;
      case VaultSensErrorCode.FOLDER_COUNT_LIMIT:
        console.error('Folder count limit reached');
        break;
      case VaultSensErrorCode.SUBSCRIPTION_INACTIVE:
        console.error('Subscription is not active');
        break;
    }
  }
}
```

### Error codes

| Code | Status | Description |
|---|---|---|
| `FILE_TOO_LARGE` | 413 | File exceeds plan's `maxFileSizeBytes` |
| `STORAGE_LIMIT` | 413 | Total storage quota exceeded |
| `FILE_COUNT_LIMIT` | 403 | Plan's `maxFilesCount` reached |
| `MIME_TYPE_NOT_ALLOWED` | 415 | File type blocked by plan |
| `COMPRESSION_NOT_ALLOWED` | 403 | Compression level not permitted by plan |
| `SUBSCRIPTION_INACTIVE` | 402 | User subscription is not active |
| `FOLDER_COUNT_LIMIT` | 403 | Plan's `maxFoldersCount` reached |
| `EMAIL_ALREADY_REGISTERED` | 400 | Duplicate email on register |
| `EMAIL_NOT_VERIFIED` | 403 | Login attempted before verifying email |
| `INVALID_CREDENTIALS` | 400 | Wrong email or password |
| `INVALID_OTP` | 400 | Bad or expired verification code |
| `UNAUTHORIZED` | 401 | Missing or invalid credentials |
| `NOT_FOUND` | 404 | Resource not found |
| `TIMEOUT` | 408 | Request timed out |
| `UNKNOWN` | — | Any other error |

---

## License

MIT
