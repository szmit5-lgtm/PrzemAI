import { NextResponse } from "next/server";
import { cookieOptions, isSameOrigin, sessionCookie } from "@/lib/webSession.mjs";

export function POST(request) {
  const headers = { "Cache-Control": "no-store" };
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Niedozwolone źródło żądania." }, { status: 403, headers });
  }
  const response = NextResponse.json({ success: true }, { headers });
  response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
