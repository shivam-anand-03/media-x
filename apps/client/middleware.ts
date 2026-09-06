import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hasSessionToken(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;
  return !!(accessToken && refreshToken);
}

export function middleware(request: NextRequest) {
  const isAuthenticated = hasSessionToken(request);
  const { pathname } = request.nextUrl;

  const publicRoutes = [
    "/",
    "/health",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-user",
  ];

  // Authenticated user visiting home page
  if (isAuthenticated && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated user trying to access protected route
  if (!isAuthenticated && !publicRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Authenticated user trying to access auth pages
  if (
    isAuthenticated &&
    [
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/reset-password",
      "/verify-user",
    ].includes(pathname)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:html?|css|js|json|jpg|jpeg|webp|png|gif|svg|ico|woff2?|ttf|eot)).*)",
    "/(api|trpc)(.*)",
  ],
};
