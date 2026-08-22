import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { getAuthCode, deleteAuthCode, getUsers, getJwks } from "@/lib/redis";

export const dynamic = "force-dynamic";

function base64url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  let grant_type, code, redirect_uri, client_id, code_verifier;
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    ({ grant_type, code, redirect_uri, client_id, code_verifier } =
      await req.json());
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    grant_type = form.get("grant_type")?.toString();
    code = form.get("code")?.toString();
    redirect_uri = form.get("redirect_uri")?.toString();
    client_id = form.get("client_id")?.toString();
    code_verifier = form.get("code_verifier")?.toString();
  } else {
    return NextResponse.json(
      { error: "unsupported_content_type" },
      { status: 400 }
    );
  }

  if (grant_type !== "authorization_code" || !code) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Retrieve auth code from Redis
  const codeEntry = await getAuthCode(code);
  if (!codeEntry) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  // PKCE check if code_challenge was provided
  if (codeEntry.code_challenge) {
    if (code_verifier) {
      const expectedChallenge = base64url(
        createHash("sha256").update(code_verifier).digest()
      );
      if (expectedChallenge !== codeEntry.code_challenge) {
        return NextResponse.json(
          { error: "invalid_grant (PKCE verification failed)" },
          { status: 400 }
        );
      }
    }
  }

  // Delete used code from Redis (single-use enforcement)
  await deleteAuthCode(code);

  // Get user details
  const users = await getUsers();
  const user = users.find((u) => u.username === codeEntry.username);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 400 });
  }

  // Get JWKS RSA keys from Redis
  const jwks = await getJwks();
  const privateKey = jwks.privateKeyPem;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const now = Math.floor(Date.now() / 1000);
  const targetClientId = client_id || codeEntry.client_id || "web-client";

  const id_token = jwt.sign(
    {
      sub: user.username,
      name: user.name || user.username,
      email: user.email || user.username,
      iss: `${baseUrl}/api/oidc`,
      aud: targetClientId,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    { algorithm: "RS256", keyid: "dev-key" }
  );

  const access_token = jwt.sign(
    {
      sub: user.username,
      scope: codeEntry.scope || "openid",
      iss: `${baseUrl}/api/oidc`,
      aud: targetClientId,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    { algorithm: "RS256", keyid: "dev-key" }
  );

  return NextResponse.json({
    access_token,
    id_token,
    token_type: "Bearer",
    expires_in: 3600,
    scope: codeEntry.scope || "openid",
  });
}
