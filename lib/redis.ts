import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  "";
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

export const redis = new Redis({
  url: UPSTASH_URL,
  token: UPSTASH_TOKEN,
});

export interface User {
  username: string;
  password?: string;
  name?: string;
  email?: string;
  [key: string]: any;
}

export interface AuthCodeData {
  code: string;
  username: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  created: number;
}

export interface JwksData {
  keys: Array<{
    kty: string;
    n: string;
    e: string;
    kid: string;
    alg: string;
    use: string;
    [key: string]: any;
  }>;
  privateKeyPem: string;
  publicKeyPem: string;
}

const REDIS_KEYS = {
  USERS: "oidc:users",
  AUTH_CODE_PREFIX: "oidc:code:",
  JWKS: "oidc:jwks",
};

/**
 * Get all users from Redis (seeds from root users.json if Redis is empty)
 */
export async function getUsers(): Promise<User[]> {
  try {
    const cached = await redis.get<User[]>(REDIS_KEYS.USERS);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  } catch (err) {
    console.error("Redis getUsers error:", err);
  }

  // Fallback / seed from root users.json
  try {
    const rootPath = path.join(process.cwd(), "users.json");
    const content = await fs.readFile(rootPath, "utf-8");
    const users: User[] = JSON.parse(content);
    try {
      await redis.set(REDIS_KEYS.USERS, users);
    } catch { }
    return users;
  } catch (fileErr) {
    console.error("Failed to read users.json fallback:", fileErr);
    return [];
  }
}

/**
 * Save user to Redis & sync to local fallback if possible
 */
export async function saveUser(user: User): Promise<User[]> {
  const users = await getUsers();
  const existingIdx = users.findIndex((u) => u.username === user.username);
  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...user };
  } else {
    users.push(user);
  }

  try {
    await redis.set(REDIS_KEYS.USERS, users);
  } catch (err) {
    console.error("Redis saveUser error:", err);
  }

  // Try updating root /tmp fallback
  try {
    const rootPath = path.join(process.cwd(), "users.json");
    await fs.writeFile(rootPath, JSON.stringify(users, null, 2));
  } catch { }

  return users;
}

/**
 * Save an authorization code in Redis with TTL (default 10 minutes)
 */
export async function saveAuthCode(
  data: AuthCodeData,
  ttlSeconds = 600
): Promise<void> {
  try {
    await redis.set(`${REDIS_KEYS.AUTH_CODE_PREFIX}${data.code}`, data, {
      ex: ttlSeconds,
    });
  } catch (err) {
    console.error("Redis saveAuthCode error:", err);
  }
}

/**
 * Retrieve an authorization code data from Redis
 */
export async function getAuthCode(code: string): Promise<AuthCodeData | null> {
  try {
    const data = await redis.get<AuthCodeData>(
      `${REDIS_KEYS.AUTH_CODE_PREFIX}${code}`
    );
    if (data) return data;
  } catch (err) {
    console.error("Redis getAuthCode error:", err);
  }
  return null;
}

/**
 * Delete an authorization code after single use
 */
export async function deleteAuthCode(code: string): Promise<void> {
  try {
    await redis.del(`${REDIS_KEYS.AUTH_CODE_PREFIX}${code}`);
  } catch (err) {
    console.error("Redis deleteAuthCode error:", err);
  }
}

/**
 * Get JWKS keypair from Redis (seeds from root oidc_jwks.json or generates if missing)
 */
export async function getJwks(): Promise<JwksData> {
  try {
    const cached = await redis.get<JwksData>(REDIS_KEYS.JWKS);
    if (
      cached &&
      cached.keys &&
      cached.keys.length > 0 &&
      cached.privateKeyPem
    ) {
      return cached;
    }
  } catch (err) {
    console.error("Redis getJwks error:", err);
  }

  // Try seed from oidc_jwks.json root
  try {
    const rootPath = path.join(process.cwd(), "oidc_jwks.json");
    const content = await fs.readFile(rootPath, "utf-8");
    const jwks: JwksData = JSON.parse(content);
    if (jwks.keys && jwks.keys.length > 0 && jwks.privateKeyPem) {
      try {
        await redis.set(REDIS_KEYS.JWKS, jwks);
      } catch { }
      return jwks;
    }
  } catch { }

  // Generate new keypair if missing
  const crypto = require("node:crypto");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const pubJwk = publicKey.export({ format: "jwk" });
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const pubPem = publicKey.export({ type: "spki", format: "pem" });

  const jwksData: JwksData = {
    keys: [{ ...pubJwk, kid: "dev-key", alg: "RS256", use: "sig" }],
    privateKeyPem: privPem,
    publicKeyPem: pubPem,
  };

  try {
    await redis.set(REDIS_KEYS.JWKS, jwksData);
  } catch (err) {
    console.error("Redis save JWKS error:", err);
  }

  return jwksData;
}
