import { Client } from "minio";

let _client: Client | null = null;
let privatePolicyChecked = false;

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

const BUCKET = process.env.MINIO_BUCKET || "croquis";

export async function ensureBucket(): Promise<void> {
  const client = getClient();
  const exists = await client.bucketExists(BUCKET);
  if (!exists) {
    await client.makeBucket(BUCKET);
  }
  await ensurePrivateBucketPolicy(client);
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
  const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || "localhost";
  const publicPort = process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT || "9000";
  return `http://${publicEndpoint}:${publicPort}/${BUCKET}/${key}`;
}

export async function getObjectBuffer(
  urlOrKey: string
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const client = getClient();
  const key = objectKeyFromUrl(urlOrKey);
  const stream = (await client.getObject(BUCKET, key)) as AsyncIterable<
    Buffer | Uint8Array | string
  > & {
    headers?: Record<string, string | string[] | undefined>;
  };

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawContentType = stream.headers?.["content-type"];
  const contentType = Array.isArray(rawContentType)
    ? rawContentType[0] ?? null
    : rawContentType ?? null;

  return { buffer: Buffer.concat(chunks), contentType };
}

function objectKeyFromUrl(urlOrKey: string): string {
  try {
    const url = new URL(urlOrKey);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const bucketIndex = pathSegments.indexOf(BUCKET);
    if (bucketIndex >= 0) {
      return decodeURIComponent(pathSegments.slice(bucketIndex + 1).join("/"));
    }
  } catch {
    // Already a storage key.
  }

  return urlOrKey;
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  await client.removeObject(BUCKET, key);
}

// Total bytes + object count actually stored (letters, photos, postcards, etc.).
// This is the real "app storage" figure that grows with usage.
export async function getStorageStats(): Promise<{ objectCount: number; totalBytes: number }> {
  const client = getClient();
  return new Promise((resolve, reject) => {
    let objectCount = 0;
    let totalBytes = 0;
    const stream = client.listObjectsV2(BUCKET, "", true);
    stream.on("data", (obj) => {
      objectCount += 1;
      totalBytes += obj.size || 0;
    });
    stream.on("end", () => resolve({ objectCount, totalBytes }));
    stream.on("error", reject);
  });
}

async function ensurePrivateBucketPolicy(client: Client): Promise<void> {
  if (privatePolicyChecked || process.env.MINIO_ENFORCE_PRIVATE_POLICY === "false") {
    return;
  }

  privatePolicyChecked = true;
  try {
    await client.setBucketPolicy(BUCKET, "");
  } catch (err) {
    console.warn("Could not clear MinIO bucket policy; media proxies still enforce app access", err);
  }
}
