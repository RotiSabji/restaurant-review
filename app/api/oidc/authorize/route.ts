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
          <h1 class="text-2xl font-bold mb-4 text-center">Sign In</h1>
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

            <!-- Optional Error/Success Messages -->
            <!-- <div class="text-red-500 text-sm">Invalid credentials</div> -->
            <!-- <div class="text-green-600 text-sm">Login successful!</div> -->

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

export async function POST(req: NextRequest) {
  // Copy users.json from root to /tmp if not present
  let userFileRetries = 0;
  while (userFileRetries < 2) {
    try {
      await fs.access(USERS_FILE);
      break;
    } catch {
      try {
        const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
        await fs.writeFile(USERS_FILE, data);
        break;
      } catch {
        userFileRetries++;
        if (userFileRetries >= 2) {
          return htmlError("No users found after multiple attempts. Please contact support.", "", "", "", "", "", "");
        }
      }
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
  let users: any[] = [];
  let userReadRetries = 0;
  while (userReadRetries < 2) {
    try {
      const data = await fs.readFile(USERS_FILE, "utf-8");
      users = JSON.parse(data);
      break;
    } catch {
      userReadRetries++;
      if (userReadRetries >= 2) {
        return htmlError("No users found after multiple attempts. Please contact support.", client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
      }
    }
  }
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
      try {
        codes = JSON.parse(await fs.readFile(AUTH_CODES_FILE, "utf-8"));
      } catch { codes = []; }
      codes.push({ code, username, client_id, redirect_uri, code_challenge, code_challenge_method, scope, created: Date.now() });
      await fs.writeFile(AUTH_CODES_FILE, JSON.stringify(codes, null, 2));
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
  if
