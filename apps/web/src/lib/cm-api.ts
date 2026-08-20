/** Client helpers for authenticated CM (My Portal) API calls. */

const CM_TOKEN_KEY = "nysc_cm_token";

export function getCmToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CM_TOKEN_KEY);
}

export function setCmToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CM_TOKEN_KEY, token);
}

export function clearCmToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CM_TOKEN_KEY);
}

export async function cmFetch(path: string, init: RequestInit = {}) {
  const token = getCmToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    clearCmToken();
    if (typeof window !== "undefined") {
      window.location.href = "/camp-portal/login";
    }
  }

  return res;
}
