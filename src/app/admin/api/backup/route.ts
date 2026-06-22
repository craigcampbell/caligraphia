import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stream a plain-SQL pg_dump of the live database as a download. pg_dump (client
// 16, installed in the image) is invoked via spawn with an argv array — the
// connection string is never passed through a shell, so there's no injection
// surface. The dump is generated on the fly and streamed, never written to disk.
export const GET = withAdmin(async (req, { admin }) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "No database configured" }, { status: 500 });
  }

  await writeAudit(admin.id, "backup_download", { ip: getClientIp(req) });

  const child = spawn(
    "pg_dump",
    ["--no-owner", "--no-privileges", "--clean", "--if-exists", "--format=plain", dbUrl],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  let stderr = "";
  child.stderr.on("data", (d: Buffer) => {
    stderr += d.toString();
  });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let settled = false;
      const close = () => {
        if (!settled) {
          settled = true;
          controller.close();
        }
      };
      const fail = (err: unknown) => {
        if (!settled) {
          settled = true;
          controller.error(err);
        }
      };
      child.stdout.on("data", (chunk: Buffer) => {
        try {
          controller.enqueue(new Uint8Array(chunk));
        } catch {
          /* controller already torn down */
        }
      });
      child.on("error", (err) => fail(err));
      // 'close' fires after stdout has fully drained and carries the exit code.
      child.on("close", (code) => {
        if (code === 0) close();
        else fail(new Error(`pg_dump exited ${code}: ${stderr.slice(0, 500)}`));
      });
    },
    cancel() {
      child.kill("SIGTERM");
    },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename="caligraphia-${stamp}.sql"`,
      "Cache-Control": "no-store",
    },
  });
});
