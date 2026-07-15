import fs from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from '../../config/env';
import type { PutObjectInput, StorageProvider, StoredObject } from './StorageProvider';

export class LocalDiskStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(
    private readonly rootDir: string = appConfig.storage.localPath,
    private readonly publicBaseUrl: string = appConfig.storage.publicBaseUrl,
  ) {}

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const absolutePath = path.join(this.rootDir, input.key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.body);
    return {
      key: input.key,
      url: this.getPublicUrl(input.key),
      contentType: input.contentType,
      size: input.body.byteLength,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const absolutePath = path.join(this.rootDir, key);
    try {
      await fs.unlink(absolutePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
  }
}

let storage: StorageProvider = new LocalDiskStorageProvider();

export function getStorageProvider(): StorageProvider {
  return storage;
}

export function setStorageProvider(next: StorageProvider): void {
  storage = next;
}
