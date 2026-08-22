import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getJwks, getUsers } from "@/lib/redis";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return NextResponse.json({ error: "Invalid token format" }, { status: 401 });
  }

  let payload: any;
  try {
    const jwks = await getJwks();
    const publicKeyPem = jwks?.publicKeyPem;

    payload = jwt.verify(token, publicKeyPem || JWT_SECRET, {
      algorithms: ["RS256", "HS256"],
    });
  } catch (err) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const users = await getUsers();
  const user = users.find((u) => u.username === payload.sub);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    sub: user.username,
    name: user.name || user.username,
    email: user.email || user.username,
  });
}
