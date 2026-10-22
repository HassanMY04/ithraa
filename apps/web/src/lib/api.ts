const TOKEN_KEY = 'ithraa.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session only lasts this page */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`/api${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body });
  if (!res.ok) {
    let msg = res.statusText || 'Something went wrong';
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') msg = data.detail;
      else if (Array.isArray(data.detail)) msg = data.detail.map((d: { msg: string }) => d.msg).join(', ');
    } catch {
      /* not JSON */
    }
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Fetch an authenticated file and hand it to the browser as a download. */
export async function download(path: string, fallbackName = 'download'): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let msg = 'Could not download the file';
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
