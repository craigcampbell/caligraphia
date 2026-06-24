import { readFile, statfs } from "node:fs/promises";
import os from "node:os";

// Best-effort host/container resource snapshot. Reads cgroup limits when present
// (so numbers reflect the container, not the whole Mac), falling back to os.*.

export interface ServerStats {
  memory: { usedBytes: number; limitBytes: number | null; totalBytes: number; source: string };
  disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number } | null;
  cpu: { cores: number; loadavg: number[] };
  uptime: { processSeconds: number; osSeconds: number };
  node: string;
  platform: string;
}

async function readNum(path: string): Promise<number | null> {
  try {
    const s = (await readFile(path, "utf8")).trim();
    if (s === "max") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function memory(): Promise<ServerStats["memory"]> {
  const total = os.totalmem();
  // cgroup v2
  const v2cur = await readNum("/sys/fs/cgroup/memory.current");
  if (v2cur !== null) {
    const v2max = await readNum("/sys/fs/cgroup/memory.max");
    return { usedBytes: v2cur, limitBytes: v2max, totalBytes: total, source: "cgroup-v2" };
  }
  // cgroup v1
  const v1cur = await readNum("/sys/fs/cgroup/memory/memory.usage_in_bytes");
  if (v1cur !== null) {
    let v1max = await readNum("/sys/fs/cgroup/memory/memory.limit_in_bytes");
    // v1 "unlimited" is a huge sentinel; treat as no limit.
    if (v1max !== null && v1max > total * 4) v1max = null;
    return { usedBytes: v1cur, limitBytes: v1max, totalBytes: total, source: "cgroup-v1" };
  }
  return { usedBytes: total - os.freemem(), limitBytes: null, totalBytes: total, source: "os" };
}

async function disk(path = "/app"): Promise<ServerStats["disk"]> {
  try {
    const s = await statfs(path);
    const bsize = Number(s.bsize);
    const totalBytes = Number(s.blocks) * bsize;
    const freeBytes = Number(s.bavail) * bsize;
    return { path, totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
  } catch {
    return null;
  }
}

export async function getServerStats(): Promise<ServerStats> {
  const [mem, dsk] = await Promise.all([memory(), disk()]);
  return {
    memory: mem,
    disk: dsk,
    cpu: { cores: os.cpus().length, loadavg: os.loadavg() },
    uptime: { processSeconds: Math.round(process.uptime()), osSeconds: Math.round(os.uptime()) },
    node: process.version,
    platform: `${os.type()} ${os.release()}`,
  };
}

// Docker disk usage, written by the host cron (scripts/refresh-docker-stats.sh)
// since the container can't reach the Docker daemon. Null if it hasn't run yet.
export interface DockerDfRow {
  size: string;
  reclaimable: string;
  count: number;
}
export interface DockerStats {
  capturedAt: string;
  images: DockerDfRow | null;
  buildCache: DockerDfRow | null;
  containers: DockerDfRow | null;
  volumes: DockerDfRow | null;
}

export async function getDockerStats(): Promise<DockerStats | null> {
  try {
    const raw = await readFile("/app/.runtime/docker-stats.json", "utf8");
    const parsed = JSON.parse(raw) as {
      capturedAt: string;
      df: Array<{ Type: string; Size: string; Reclaimable: string; TotalCount: string }>;
    };
    const find = (type: string): DockerDfRow | null => {
      const r = parsed.df.find((x) => x.Type === type);
      return r ? { size: r.Size, reclaimable: r.Reclaimable, count: Number(r.TotalCount) || 0 } : null;
    };
    return {
      capturedAt: parsed.capturedAt,
      images: find("Images"),
      buildCache: find("Build Cache"),
      containers: find("Containers"),
      volumes: find("Local Volumes"),
    };
  } catch {
    return null;
  }
}
