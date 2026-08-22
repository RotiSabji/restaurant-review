import { NextResponse } from "next/server";
import { getJwks } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const jwks = await getJwks();
  // Return public key set
  return NextResponse.json({ keys: jwks.keys });
}
