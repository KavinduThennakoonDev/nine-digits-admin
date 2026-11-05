import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "nd_session";
const PUBLIC_PATHS = ["/login"];

/**
 * Optimistic gate only: redirects visitors without a session cookie to /login.
 * Real validation (DB session lookup + permissions) happens in the Data Access Layer.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && !hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|icon.png|brand/|favicon.ico|robots.txt).*)"],
};
