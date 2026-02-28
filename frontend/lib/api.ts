import { API_BASE_URL } from "./config";
import { getToken } from "./token";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
  headers?: Record<string, string>;
  auth?: boolean;
};

function normalizeUrl(base: string, path: string) {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function isWrappedBody(input: any) {
  return (
    input &&
    typeof input === "object" &&
    ("body" in input || "method" in input || "headers" in input || "auth" in input)
  );
}

async function request(path: string, options: ApiOptions = {}) {
  const url = normalizeUrl(API_BASE_URL, path);

  // Attach token by default
  let authHeader: Record<string, string> = {};
  const shouldAuth = options.auth !== false;

  if (shouldAuth) {
    const token = await getToken();
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(options.headers || {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (e: any) {
    throw new Error(
      "Network request failed. Check API_BASE_URL / tunnel, backend running, and connectivity."
    );
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
        ? data.detail?.[0]?.msg
        : null;

    throw new Error(detail || data?.message || `Request failed (${res.status})`);
  }

  return data;
}

export function apiGet(path: string, opts?: ApiOptions) {
  return request(path, { method: "GET", ...(opts || {}) });
}

export function apiPost(path: string, bodyOrOptions?: any) {
  if (isWrappedBody(bodyOrOptions)) {
    const opts = bodyOrOptions as ApiOptions;
    return request(path, {
      method: "POST",
      ...(opts.body !== undefined ? { body: opts.body } : {}),
      headers: opts.headers,
      auth: opts.auth,
    });
  }
  return request(path, { method: "POST", body: bodyOrOptions });
}

export function apiPut(path: string, bodyOrOptions?: any) {
  if (isWrappedBody(bodyOrOptions)) {
    const opts = bodyOrOptions as ApiOptions;
    return request(path, {
      method: "PUT",
      ...(opts.body !== undefined ? { body: opts.body } : {}),
      headers: opts.headers,
      auth: opts.auth,
    });
  }
  return request(path, { method: "PUT", body: bodyOrOptions });
}

export async function apiDelete(path: string) {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.json())?.detail || res.statusText);
  return res.json();
}

// ✅ ADD THIS
export function apiPatch(path: string, bodyOrOptions?: any) {
  if (isWrappedBody(bodyOrOptions)) {
    const opts = bodyOrOptions as ApiOptions;
    return request(path, {
      method: "PATCH",
      ...(opts.body !== undefined ? { body: opts.body } : {}),
      headers: opts.headers,
      auth: opts.auth,
    });
  }
  return request(path, { method: "PATCH", body: bodyOrOptions });
}
