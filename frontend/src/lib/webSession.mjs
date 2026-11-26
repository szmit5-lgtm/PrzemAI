export const production = process.env.NODE_ENV === "production";
export const sessionCookie = production ? "__Host-przemai-session" : "przemai-session";
export const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "strict",
  path: "/"
};

export function isSameOrigin(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
