import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { getUsers, saveAuthCode } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Parse query params for OIDC
  const { searchParams } = new URL(req.url);
  const client_id = searchParams.get("client_id") || "";
  const redirect_uri = searchParams.get("redirect_uri") || "";
  const code_challenge = searchParams.get("code_challenge") || "";
  const code_challenge_method = searchParams.get("code_challenge_method") || "";
  const state = searchParams.get("state") || "";
  const scope = searchParams.get("scope") || "openid";
  const success = searchParams.get("success");
  const prefillUsername = searchParams.get("username") || "";

  // Render HTML login form for OIDC authorization flow
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
      <div class="bg-white rounded-2xl shadow-md p-6">
        <h1 class="text-2xl font-bold mb-4 text-center">Login</h1>
        ${success ? '<div class="text-green-600 text-sm text-center mb-2">Registration successful! Please log in.</div>' : ''}
        <form method="POST" class="space-y-4">
          <input type="hidden" name="client_id" value="${client_id}" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="code_challenge" value="${code_challenge}" />
          <input type="hidden" name="code_challenge_method" value="${code_challenge_method}" />
          <input type="hidden" name="state" value="${state}" />
          <input type="hidden" name="scope" value="${scope}" />
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              name="username"
              placeholder="Username"
              required
              value="${prefillUsername}"
              class="w-full border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              class="w-full border rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            class="w-full bg-black text-white font-semibold py-2 px-4 rounded-md hover:bg-gray-800 transition"
          >
            Login
          </button>
          <div class="text-center pt-2 text-sm text-gray-600">
            Don't have an account? <a href="/register" class="text-blue-600 hover:underline">Sign up</a>
          </div>
        </form>
      </div>
    </div>
  </body>
</html>
`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
}

export async function POST(req: NextRequest) {
  const users = await getUsers();
  const contentType = req.headers.get("content-type") || "";

  let username = "";
  let password = "";
  let client_id = "";
  let redirect_uri = "";
  let code_challenge = "";
  let code_challenge_method = "";
  let state = "";
  let scope = "openid";

  const isJson = contentType.includes("application/json");

  if (isJson) {
    try {
      const body = await req.json();
      username = body.username || "";
      password = body.password || "";
      client_id = body.client_id || "";
      redirect_uri = body.redirect_uri || "";
      code_challenge = body.code_challenge || "";
      code_challenge_method = body.code_challenge_method || "";
      state = body.state || "";
      scope = body.scope || "openid";
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }
  } else {
    try {
      const form = await req.formData();
      username = form.get("username")?.toString() || "";
      password = form.get("password")?.toString() || "";
      client_id = form.get("client_id")?.toString() || "";
      redirect_uri = form.get("redirect_uri")?.toString() || "";
      code_challenge = form.get("code_challenge")?.toString() || "";
      code_challenge_method = form.get("code_challenge_method")?.toString() || "";
      state = form.get("state")?.toString() || "";
      scope = form.get("scope")?.toString() || "openid";
    } catch {
      return htmlError("Failed to parse form data. Please try again.", "", "", "", "", "", "");
    }
  }

  // Validate user
  const user = users.find((u) => u.username === username);
  if (!user) {
    const errorMsg = "Invalid username or password.";
    return isJson
      ? NextResponse.json({ message: errorMsg }, { status: 401 })
      : htmlError(errorMsg, client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
  }

  let valid = false;
  try {
    valid = await bcrypt.compare(password, user.password || "");
  } catch {
    const errorMsg = "Internal error validating password.";
    return isJson
      ? NextResponse.json({ message: errorMsg }, { status: 500 })
      : htmlError(errorMsg, client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
  }

  if (!valid) {
    const errorMsg = "Invalid username or password.";
    return isJson
      ? NextResponse.json({ message: errorMsg }, { status: 401 })
      : htmlError(errorMsg, client_id, redirect_uri, code_challenge, code_challenge_method, state, scope);
  }

  // Generate auth code & store in Redis
  const code = randomBytes(32).toString("hex");
  await saveAuthCode(
    {
      code,
      username,
      client_id: client_id || "web-client",
      redirect_uri,
      code_challenge,
      code_challenge_method,
      scope,
      created: Date.now(),
    },
    600 // 10 min TTL in Redis
  );

  if (redirect_uri) {
    const url = new URL(redirect_uri, req.url);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);

    if (isJson) {
      return NextResponse.json({
        code,
        state,
        redirect_uri,
        redirectUrl: url.toString(),
      });
    }

    return NextResponse.redirect(url.toString(), 303);
  }

  if (isJson) {
    return NextResponse.json({ code, state });
  }

  return NextResponse.json({ code, state });
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
  const backUrl = redirect_uri
    ? `${redirect_uri}?error=${encodeURIComponent(error)}&client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&code_challenge=${encodeURIComponent(code_challenge)}&code_challenge_method=${encodeURIComponent(code_challenge_method)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scope)}`
    : "/login";

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
      <div class="bg-white rounded-2xl shadow-md p-6 text-center">
        <h1 class="text-2xl font-bold mb-4">Error</h1>
        <p class="text-red-500 text-sm mb-6">${error}</p>
        <a
          href="${backUrl}"
          class="w-full bg-black text-white font-semibold py-2 px-4 rounded-md transition block text-center"
        >
          Try Again
        </a>
      </div>
    </div>
  </body>
</html>
`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
}
