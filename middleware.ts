import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, verifySessionToken } from "@/scripts/lib/session";

/**
 * Session-cookie gate. Runs in place of the old HTTP Basic Auth: a valid
 * signed cookie lets the request through and slides its expiry forward;
 * anything else gets sent to /login. See session-login-spec.md.
 */
export async function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  // Fail closed: if either isn't configured, lock the site rather than
  // silently publishing holdings and career notes to the open web.
  if (!password || !secret) {
    return new NextResponse("Site password not configured.", { status: 503 });
  }

  // The login page and its API route must stay reachable without a session,
  // or nobody could ever log in.
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await verifySessionToken(token, secret);

  if (!valid) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Sliding window: every valid request refreshes the cookie's Max-Age, so
  // regular use keeps the session alive indefinitely. The signed value
  // itself is unchanged — only the browser-side expiry is extended.
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE_NAME, token!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  // PWA install assets (manifest, icons, service worker) are excluded from the
  // gate: iOS's "Add to Home Screen" and browser install flows fetch these
  // outside the page's authenticated session, so gating them breaks install.
  // None of it is sensitive — just branding and a generic manifest.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.png|apple-icon.png|icons/|sw.js).*)",
  ],
};
