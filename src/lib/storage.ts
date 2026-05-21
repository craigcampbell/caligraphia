import { Client } from "minio";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    _client = new Client({
      endPoint: process.env.MINIO_ENDPOINT || "storage",
      port: parseInt(process.env.MINIO_PORT || "9000", 10),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    });
  }
  return _client;
}

const BUCKET = process.env.MINIO_BUCKET || "caligraphia";

export async function ensureBucket(): Promise<void> {
  const client = getClient();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET);
  }
}

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getClient();
  await ensureBucket();
  await client.putObject(BUCKET, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
  return getPublicUrl(key);
}

export async function uploadFile(
  key: string,
  filePath: string,
  contentType: string
): Promise<string> {
  const client = getClient();
  await ensureBucket();
  await client.fPutObject(BUCKET, key, filePath, { "Content-Type": contentType });
  return getPublicUrl(key);
}

export function getPublicUrl(key: string): string {
  const endpoint = process.env.MINIO_ENDPOINT || "storage";
  const port = process.env.MINIO_PORT || "9000";
  return `http://${endpoint}:${port}/${BUCKET}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  await client.removeObject(BUCKET, key);
}
