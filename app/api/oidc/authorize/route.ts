import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

// All file storage should use /tmp for Vercel compatibility.
const USERS_FILE = path.join("/tmp", "users.json");
const USERS_FILE_ROOT = path.join(process.cwd(), "users.json");
const AUTH_CODES_FILE = path.join("/tmp", "oidc_auth_codes.json");

export async function GET(req: NextRequest) {
  // Parse query params for OIDC
  const { searchParams } = new URL(req.url);
  const client_id = searchParams.get("client_id") || "";
  const redirect_uri = searchParams.get("redirect_uri") || "";
  const code_challenge = searchParams.get("code_challenge") || "";
  const code_challenge_method = searchParams.get("code_challenge_method") || "";
  const state = searchParams.get("state") || "";
  const scope = searchParams.get("scope") || "openid";
  // Show success message and prefill username if redirected from registration
  const success = searchParams.get("success");
  const prefillUsername = searchParams.get("username") || "";
  // Render a simple HTML login form
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Login</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  </head>
  <body class="bg-gray-50 flex items-center justify-center min-h-screen">
    <div class="max-w-md w-full px-4 py-12">
      <div class="bg-white rounded-2xl shadow-md">
        <div class="px-6 pt-6">
          <h1 class="text-2xl font-bold mb-4 text-center">Login</h1>
          ${success ? '<div class="text-green-600 text-sm text-center mb-2">Registration successful! Please log in.</div>' : ''}
          <form method="POST" class="space-y-4">
            <!-- Hidden OAuth fields -->
            <input type="hidden" name="client_id" value="${client_id}" />
            <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
            <input type="hidden" name="code_challenge" value="${code_challenge}" />
            <input type="hidden" name="code_challenge_method" value="${code_challenge_method}" />
            <input type="hidden" name="state" value="${state}" />
            <input type="hidden" name="scope" value="${scope}" />
            <!-- Username -->
            <input
              type="text"
              name="username"
              placeholder="Username"
              required
              value="${prefillUsername}"
              class="w-full border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <!-- Password -->
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              class="w-full border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <!-- Submit Button -->
            <button
              type="submit"
              class="w-full bg-black hover:bg-black text-white font-semibold py-2 px-4 rounded-md transition"
            >
              Login
            </button>
            <div class="text-center pt-1 pb-4">
              Don't have a account? <a href="/register" class="text-sm text-blue-600 hover:underline">Sign up</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  </body>
</html>
`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
}

// Enhanced readUsers: always try /tmp, copy from root if missing, fallback to root directly
async function readUsers() {
  try {
    await fs.access(USERS_FILE);
  } catch {
    try {
      const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
      await fs.writeFile(USERS_FILE, data);
    } catch {
      // If copy fails, fallback to reading from root directly
      try {
        const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
  }
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // As a last fallback, try root again
    try {
      const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}

// Enhanced readAuthCodes: always try /tmp, copy from root if missing, fallback to root directly
async function readAuthCodes() {
  try {
    await fs.access(AUTH_CODES_FILE);
  } catch {
    try {
      const data = await fs.readFile(path.join(process.cwd(), "oidc_auth_codes.json"), "utf-8");
      await fs.writeFile(AUTH_CODES_FILE, data);
    } catch {
      // If copy fails, fallback to reading from root directly
      try {
        const data = await fs.readFile(path.join(process.cwd(), "oidc_auth_codes.json"), "utf-8");
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
  }
  try {
    const data = await fs.readFile(AUTH_CODES_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    // As a last fallback, try root again
    try {
      const data = await fs.readFile(path.join(process.cwd(), "oidc_auth_codes.json"), "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}

// Enhanced writeAuthCodes: try /tmp, fallback to root if needed
async function writeAuthCodes(codes: any[]) {
  try {
    await fs.writeFile(AUTH_CODES_FILE, JSON.stringify(codes, null, 2));
  } catch {
    // As a last fallback, write to root
    await fs.writeFile(path.join(process.cwd(), "oidc_auth_codes.json"), JSON.stringify(codes, null, 2));
  }
}

export async function POST(req: NextRequest) {
  // Use enhanced readUsers for robust fallback
  let users: any[] = [];
  let userFileRetries = 0;
  while (userFileRetries < 2) {
    users = await readUsers();
    if (users.length > 0) break;
    userFileRetries++;
    if (userFileRetries >= 2) {
      return htmlError("No users found after multiple attempts. Please contact support.", "", "", "", "", "", "");
    }
  }

  // Parse form data
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return htmlError("Failed to parse form data. Please try again.", "", "", "", "", "", "");
  }
  const username = form.get("username")?.toString() || "";
  const password = form.get("password")?.toString() || "";
  const client_id = form.get("client_id")?.toString() || "";
  const redirect_uri = form.get("redirect_uri")?.toString() || "";
  const code_challenge = form.get("code_challenge")?.toString() || "";
  const code_challenge_method = form.get("code_challenge_method")?.toString() || "";
  const state = form.get("state")?.toString() || "";
  const scope = form.get("scope")?.toString() || "openid";

  // Validate user
  const user = users.find((u) => u.username === username);
  if (!user) {
    return htmlError("Invalid username or password. Please check your credentials and try again.", client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
  }
  let valid = false;
  try {
    valid = await bcrypt.compare(password, user.password);
  } catch {
    return htmlError("Internal error validating password. Please try again later.", client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
  }
  if (!valid) {
    return htmlError("Invalid username or password. Please check your credentials and try again.", client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
  }
  // Generate auth code
  let code = "";
  let codes: any[] = [];
  let codeWriteRetries = 0;
  while (codeWriteRetries < 2) {
    try {
      code = randomBytes(32).toString("hex");
      codes = await readAuthCodes();
      codes.push({ code, username, client_id, redirect_uri, code_challenge, code_challenge_method, scope, created: Date.now() });
      await writeAuthCodes(codes);
      break;
    } catch {
      codeWriteRetries++;
      if (codeWriteRetries >= 2) {
        return htmlError("Internal error generating authorization code. Please try again later.", client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
      }
    }
  }
  // Always use response_mode=query for OIDC redirect
  // Redirect with code and state as query params (GET)
  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  // Always use 303 See Other to force GET
  return NextResponse.redirect(url.toString(), 303);
}

function htmlError(
  error: string,
  client_id: string,
  redirect_uri: string,
  code_challenge: string,
  code_challenge_method: string,
  state: string,
  scope: string
) {
  // Render a simple HTML error page
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Error</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  </head>
  <body class="bg-gray-50 flex items-center justify-center min-h-screen">
    <div class="max-w-md w-full px-4 py-12">
      <div class="bg-white rounded-2xl shadow-md">
        <div class="px-6 pt-6">
          <h1 class="text-2xl font-bold mb-4 text-center">Error</h1>
          <p class="text-red-500 text-sm mb-4 text-center">${error}</p>
          <a
            href="${redirect_uri}?error=${encodeURIComponent(error)}&client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&code_challenge=${encodeURIComponent(code_challenge)}&code_challenge_method=${encodeURIComponent(code_challenge_method)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}"
            class="w-full bg-black hover:bg-black text-white font-semibold py-2 px-4 rounded-md transition block text-center"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
  </body>
</html>
`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
}
