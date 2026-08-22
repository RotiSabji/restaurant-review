import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const dynamicallyDeterminedBase = host ? `${proto}://${host}` : "";
  const BASE_URL =
    process.env.NEXT_PUBLIC_BASE_URL ||
    dynamicallyDeterminedBase ||
    "http://localhost:3000";

  return NextResponse.json({
    issuer: `${BASE_URL}/api/oidc`,
    authorization_endpoint: `${BASE_URL}/api/oidc/authorize`,
    token_endpoint: `${BASE_URL}/api/oidc/token`,
    userinfo_endpoint: `${BASE_URL}/api/oidc/userinfo`,
    jwks_uri: `${BASE_URL}/api/oidc/jwks`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    claims_supported: ["sub", "name", "email"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
  });
}
