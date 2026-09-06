export const AUTH_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-user",
] as const;

/** Auth screens (sign-in, sign-up, …) including their catch-all subpaths. */
export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Routes reachable without a session: the auth screens plus the public
 * landing/health pages. Authenticated queries must not force a redirect here —
 * the user is legitimately signed-out, and redirecting to /sign-in from a page
 * that itself fires the failing query spins an infinite reload loop.
 */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/health" || isAuthPath(pathname);
}
