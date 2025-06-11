import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const redirectUrl = `${url.origin}/oidc-callback?${url.searchParams.toString()}`;
  return NextResponse.redirect(redirectUrl, 303); // 303 = See Other (forces GET)
}