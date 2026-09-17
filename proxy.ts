import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MANAGER_ONLY = ["/crm/contacts", "/activity"];

export async function proxy(req: NextRequest) {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Optimistic check from the session token only (no DB call here). The real
  // enforcement is in lib/dal.ts, which every manager-only page and action uses.
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isManager = role === "ADMIN" || role === "FOUNDER";
  if (isLoggedIn && !isManager && MANAGER_ONLY.some((p) => req.nextUrl.pathname === p || req.nextUrl.pathname.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
