// Client-side fetch wrapper for the admin panel. Mirrors the readable CSRF
// cookie into the x-admin-csrf header on mutations (double-submit), keeps cookies
// same-origin, and bounces to the login page when the session has lapsed.

export interface AdminFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

export async function adminFetch<T = unknown>(
  path: string,
  opts: RequestInit = {},
  { redirectOn401 = true }: { redirectOn401?: boolean } = {}
): Promise<AdminFetchResult<T>> {
  const method = (opts.method || "GET").toUpperCase();
  const headers = new Headers(opts.headers);
  if (method !== "GET" && method !== "HEAD") {
    headers.set("x-admin-csrf", readCookie("calig_admin_csrf"));
    if (opts.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  let res: Response;
  try {
    res = await fetch(path, { ...opts, method, headers, credentials: "same-origin" });
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error" };
  }

  if (res.status === 401 && redirectOn401 && typeof window !== "undefined") {
    window.location.href = "/admin/login";
    return { ok: false, status: 401, data: null, error: "Session expired" };
  }

  let data: T | null = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      data = (await res.json()) as T;
    } catch {
      /* non-JSON or empty */
    }
  }
  const error = res.ok
    ? null
    : ((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  return { ok: res.ok, status: res.status, data, error };
}
