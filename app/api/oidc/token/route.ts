import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";

// All file storage should use /tmp for Vercel compatibility.
const USERS_FILE = path.join("/tmp", "users.json");
const USERS_FILE_ROOT = path.join(process.cwd(), "users.json");
const AUTH_CODES_FILE = path.join("/tmp", "oidc_auth_codes.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";
const JWKS_FILE = path.join("/tmp", "oidc_jwks.json");
const JWKS_FILE_ROOT = path.join(process.cwd(), "oidc_jwks.json");

function base64url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  // Copy users.json from root to /tmp if not present
  try {
    await fs.access(USERS_FILE);
  } catch {
    try {
      const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
      await fs.writeFile(USERS_FILE, data);
    } catch {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }

  // Copy oidc_jwks.json from root to /tmp if not present
  try {
    await fs.access(JWKS_FILE);
  } catch {
    try {
      const data = await fs.readFile(JWKS_FILE_ROOT, "utf-8");
      await fs.writeFile(JWKS_FILE, data);
    } catch {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }

  let grant_type, code, redirect_uri, client_id, code_verifier;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    ({ grant_type, code, redirect_uri, client_id, code_verifier } = await req.json());
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    grant_type = form.get("grant_type")?.toString();
    code = form.get("code")?.toString();
    redirect_uri = form.get("redirect_uri")?.toString();
    client_id = form.get("client_id")?.toString();
    code_verifier = form.get("code_verifier")?.toString();
  } else {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 400 });
  }
  if (grant_type !== "authorization_code" || !code || !redirect_uri || !client_id || !code_verifier) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  let codes: any[] = [];
  try {
    codes = JSON.parse(await fs.readFile(AUTH_CODES_FILE, "utf-8"));
  } catch { return NextResponse.json({ error: "invalid_grant" }, { status: 400 }); }
  const codeEntry = codes.find((c) => c.code === code && c.client_id === client_id && c.redirect_uri === redirect_uri);
  if (!codeEntry) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  // PKCE check
  const expectedChallenge = base64url(createHash("sha256").update(code_verifier).digest());
  if (expectedChallenge !== codeEntry.code_challenge) {
    return NextResponse.json({ error: "invalid_grant (PKCE)" }, { status: 400 });
  }
  // Remove used code
  codes = codes.filter((c) => c.code !== code);
  await fs.writeFile(AUTH_CODES_FILE, JSON.stringify(codes, null, 2));
  // Issue tokens
  let users: any[] = [];
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
  } catch { return NextResponse.json({ error: "server_error" }, { status: 500 }); }
  const user = users.find((u) => u.username === codeEntry.username);
  if (!user) {
    return NextResponse.json({ error: "server_error" }, { status: 500 }); }
  // Load private key for RS256
  const jwks = JSON.parse(await fs.readFile(JWKS_FILE, "utf-8"));
  const privateKey = jwks.privateKeyPem; // Store PEM in jwks file for demo
  const now = Math.floor(Date.now() / 1000);
  const id_token = jwt.sign({
    sub: user.username,
    name: user.username,
    email: user.username,
    iss: `${process.env.OIDC_BASE_URL || "http://localhost:3000"}/api/oidc`,
    aud: client_id,
    iat: now,
    exp: now + 3600,
  }, privateKey || JWT_SECRET, { algorithm: "RS256", keyid: "dev-key" });
  const access_token = jwt.sign({
    sub: user.username,
    scope: codeEntry.scope,
    iss: `${process.env.OIDC_BASE_URL || "http://localhost:3000"}/api/oidc`,
    aud: client_id,
    iat: now,
    exp: now + 3600,
  }, privateKey || JWT_SECRET, { algorithm: "RS256", keyid: "dev-key" });
  return NextResponse.json({
    access_token,
    id_token,
    token_type: "Bearer",
    expires_in: 3600,
    scope: codeEntry.scope,
  });
}
