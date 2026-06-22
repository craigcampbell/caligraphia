import { prisma } from "@/lib/prisma";

// Postgres health snapshot. All queries are parameterless literals (no user
// input) — safe to run as raw SQL. bigints are narrowed to Number for JSON.

export interface DbStats {
  databaseSizeBytes: number;
  connections: number;
  tables: { name: string; rows: number; totalBytes: number }[];
}

export async function getDbStats(): Promise<DbStats> {
  const sizeRows = await prisma.$queryRaw<{ size: bigint }[]>`
    SELECT pg_database_size(current_database()) AS size`;
  const connRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM pg_stat_activity
    WHERE datname = current_database()`;
  const tableRows = await prisma.$queryRaw<{ name: string; rows: bigint; total: bigint }[]>`
    SELECT relname AS name,
           n_live_tup AS rows,
           pg_total_relation_size(relid) AS total
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 50`;

  return {
    databaseSizeBytes: Number(sizeRows[0]?.size ?? 0),
    connections: Number(connRows[0]?.count ?? 0),
    tables: tableRows.map((t) => ({
      name: t.name,
      rows: Number(t.rows),
      totalBytes: Number(t.total),
    })),
  };
}
