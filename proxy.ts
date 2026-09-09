import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
