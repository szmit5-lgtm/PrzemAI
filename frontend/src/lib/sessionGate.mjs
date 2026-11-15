// This helper intentionally does not decode or validate a JWT locally.
// The backend is the only authority for authenticated sessions.
export function hasUsableSessionToken(storage) {
  try {
    const token = storage?.getItem("token");
    return typeof token === "string" && token.trim().length > 0;
  } catch {
    return false;
  }
}
