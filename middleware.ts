import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Password gate implemented in middleware rather than via Vercel's native
 * Password Protection, which needs Pro plus a $150/month add-on. This runs on
 * the free Hobby plan and is sufficient for keeping a personal digest private.
 */
export function middleware(request: NextRequest) {
  const user = process.env.SITE_USER;
  const password = process.env.SITE_PASSWORD;

  // Fail closed: if no password is configured, lock the site rather than
  // silently publishing holdings and career notes to the open web.
  if (!password) {
    return new NextResponse("Site password not configured.", { status: 503 });
  }

  const header = request.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    const suppliedUser = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);

    if (suppliedUser === (user || "sam") && suppliedPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Daily Brief"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
