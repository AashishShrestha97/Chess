import http from "../api/http";

/**
 * Fetches a short-lived WebSocket token from the backend.
 * The backend reads the ch4e_access cookie and issues a fresh JWT.
 * This token is then passed as a query param to the WebSocket URL.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("http://localhost:8080/api/auth/ws-token", {
      method: "GET",
      credentials: "include", // sends cookies
    });

    if (!response.ok) {
      console.error("❌ ws-token request failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data.token ?? null;
  } catch (error) {
    console.error("❌ Failed to get WS access token:", error);
    return null;
  }
}