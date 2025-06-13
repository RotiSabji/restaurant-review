import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// All file storage should use /tmp for Vercel compatibility.
const JWKS_FILE = path.join("/tmp", "oidc_jwks.json");

export async function GET() {
  // For demo: generate a static keypair and store in oidc_jwks.json if not present or invalid
  let jwks;
  let needsKey = false;
  if (!fs.existsSync(JWKS_FILE)) {
    needsKey = true;
  } else {
    try {
      jwks = JSON.parse(fs.readFileSync(JWKS_FILE, "utf-8"));
      if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0 || !jwks.privateKeyPem) {
        needsKey = true;
      }
    } catch {
      needsKey = true;
    }
  }
  if (needsKey) {
    const { publicKey, privateKey } = require("node:crypto").generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const pubJwk = publicKey.export({ format: "jwk" });
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
    const pubPem = publicKey.export({ type: "spki", format: "pem" });
    jwks = { keys: [{ ...pubJwk, kid: "dev-key", alg: "RS256", use: "sig" }], privateKeyPem: privPem, publicKeyPem: pubPem };
    fs.writeFileSync(JWKS_FILE, JSON.stringify(jwks, null, 2));
  }
  // Only return public keys
  return NextResponse.json({ keys: jwks.keys });
}
