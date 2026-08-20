/** Client helpers for authenticated CM (My Portal) API calls. */

const CM_TOKEN_KEY = "nysc_cm_token";
const CM_ACTIVITY_KEY = "nysc_cm_last_activity";

/** Idle timeout (ms) — matches ~JWT length; inactivity signs the CM out. */
export const CM_IDLE_MS = 30 * 60 * 1000;

export function getCmToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CM_TOKEN_KEY);
}

export function setCmToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CM_TOKEN_KEY, token);
  touchCmActivity();
}

export function clearCmToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CM_TOKEN_KEY);
  localStorage.removeItem(CM_ACTIVITY_KEY);
}

export function touchCmActivity() {
  if (typeof window === "undefined") return;
  localStorage.setItem(CM_ACTIVITY_KEY, String(Date.now()));
}

export function isCmSessionExpired(): boolean {
  if (typeof window === "undefined") return true;
  if (!getCmToken()) return true;
  const raw = localStorage.getItem(CM_ACTIVITY_KEY);
  if (!raw) return true;
  const last = Number(raw);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last > CM_IDLE_MS;
}

/** Call on protected CM pages: expire idle sessions and refresh activity. */
export function ensureCmSessionActive(): boolean {
  if (!getCmToken()) return false;
  if (isCmSessionExpired()) {
    clearCmToken();
    return false;
  }
  touchCmActivity();
  return true;
}

export async function cmFetch(path: string, init: RequestInit = {}) {
  if (!ensureCmSessionActive()) {
    if (typeof window !== "undefined") {
      window.location.href = "/camp-portal/login";
    }
    return new Response(JSON.stringify({ error: "Session expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

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
