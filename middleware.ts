import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isEmailAllowedForBeta } from "@/lib/betaAccess";

export default async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const userEmail = typeof token?.email === "string" ? token.email : null;

  if (!userEmail) {
    const signInUrl = new URL("/private-beta", nextUrl);
    signInUrl.searchParams.set("next", nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (!isEmailAllowedForBeta(userEmail)) {
    return NextResponse.redirect(new URL("/private-beta?access=denied", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/briefing/:path*",
    "/concierge/:path*",
    "/outputs/:path*",
    "/settings/:path*",
    "/emails/:path*",
  ],
};
