/**
 * S3-compatible storage abstraction.
 * Local disk implementation used in development; swap for real S3/R2 later.
 */
export interface StoredObject {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  readonly name: string;
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
