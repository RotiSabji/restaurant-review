import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import path from "path";
import { promises as fs } from "fs";

// All file storage should use /tmp for Vercel compatibility.

const USERS_FILE = path.join("/tmp", "users.json");
const USERS_FILE_ROOT = path.join(process.cwd(), "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";
const JWKS_FILE = path.join("/tmp", "oidc_jwks.json");

export async function GET(req: NextRequest) {
  // Copy users.json from root to /tmp if not present
  try {
    await fs.access(USERS_FILE);
  } catch {
    try {
      const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
      await fs.writeFile(USERS_FILE, data);
    } catch {
      return NextResponse.json({ error: "No users found" }, { status: 401 });
    }
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  let payload;
  try {
    // Try to verify with RS256 key if available, else fallback to secret
    let jwks;
    try {
      jwks = JSON.parse(await fs.readFile(JWKS_FILE, "utf-8"));
    } catch {}
    const publicKey = jwks?.keys?.[0] ? jwks.keys[0] : undefined;
    payload = jwt.verify(token, publicKey || JWT_SECRET, { algorithms: ["RS256", "HS256"] });
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  // Find user info
  let users: any[] = [];
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
  } catch {}
  const user = users.find((u) => u.username === payload.sub);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({
    sub: user.username,
    name: user.username,
    email: user.username,
  });
}
