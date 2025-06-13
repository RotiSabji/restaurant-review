import { NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://restaurant-review-eta.vercel.app";

export async function GET() {
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
    token_endpoint_auth_methods_supported: ["client_secret_post"],
    claims_supported: ["sub", "name", "email"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
  });
}
