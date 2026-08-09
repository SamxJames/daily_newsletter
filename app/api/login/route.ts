import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/scripts/lib/session";

/**
 * Validates the submitted password and issues a signed session cookie.
 * Standard POST-redirect-GET: both outcomes redirect (303, so the browser
 * follows with GET rather than re-POSTing) so a page refresh afterwards
 * never re-submits the password.
 */
export async function POST(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  // Fail closed: middleware already blocks the whole site when these are
  // unset, but guard here too in case this route is ever reached directly.
  if (!password || !secret) {
    return new NextResponse("Site password not configured.", { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const supplied = form?.get("password");

  if (typeof supplied !== "string" || supplied !== password) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const token = await createSessionToken(secret);
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
