export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

let token = process.env.EXPO_PUBLIC_JWT_TOKEN ?? "";

export const setToken = (t: string) => {
  token = t;
};

export const hasToken = () => token.length > 0;

export async function apiFetch<T = any>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hasToken()) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Request failed.");
  }
  return res.json();
}
