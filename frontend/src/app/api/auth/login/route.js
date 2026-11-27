import { NextResponse } from "next/server";
import { parseLoginResponse } from "@/lib/loginPayload";
import { cookieOptions, isSameOrigin, sessionCookie } from "@/lib/webSession.mjs";

const options = status => ({ status, headers: { "Cache-Control": "no-store" } });

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, options(403));
  }
  const credentials = await request.json().catch(() => null);
  if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string") {
    return NextResponse.json({ error: "Podaj e-mail i hasło." }, options(400));
  }

  try {
    const backend = new URL("/api/auth/login", process.env.API_PROXY_TARGET || "http://localhost:3000");
    const upstream = await fetch(backend, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000)
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return NextResponse.json({ error: payload?.error || "Nie udało się zalogować." }, options(upstream.status));
    }
    const token = parseLoginResponse(payload);
    const response = NextResponse.json({ success: true }, options(200));
    response.cookies.set(sessionCookie, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 });
    return response;
  } catch {
    return NextResponse.json({ error: "Logowanie jest chwilowo niedostępne." }, options(502));
  }
}
