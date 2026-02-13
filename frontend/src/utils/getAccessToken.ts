import http from "../api/http";

/**
 * Extracts the JWT access token from the browser's cookies.
 *
 * The backend sets an HttpOnly cookie named "ch4e_access" after login.
 * Because it's HttpOnly we cannot read it with document.cookie — instead
 * we call a lightweight API endpoint that echoes the authenticated user's
 * token back as JSON, OR we use the refresh flow to get a fresh token.
 *
 * Simpler approach: hit /api/auth/me to verify we're logged in, then
 * call /api/auth/refresh (which re-issues the cookie) and extract from
 * the response. But the cleanest path is to have the backend provide
 * a dedicated /api/auth/token endpoint.
 *
 * For now we use a direct cookie read trick: Spring sets the cookie as
 * HttpOnly=true, so document.cookie won't expose it. Instead we ask the
 * backend for a short-lived token we can pass in the WebSocket URL.
 *
 * Implementation: POST /api/auth/ws-token → { token: "..." }
 * Falls back to empty string (unauthenticated) if unavailable.
 */

/**
 * Returns the raw JWT string suitable for passing as a WebSocket query param.
 * Uses the dedicated /api/auth/ws-token endpoint.
 */
export async function getAccessToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/ws-token", {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) {
      console.warn("⚠️ Could not get WS token:", res.status);
      return "";
    }

    const data = await res.json();
    return data.token ?? "";
  } catch (e) {
    console.error("❌ getAccessToken error:", e);
    return "";
  }
}