import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// All file storage should use /tmp for Vercel compatibility.
const USERS_FILE = path.join("/tmp", "users.json");
const USERS_FILE_ROOT = path.join(process.cwd(), "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

export async function POST(req: NextRequest) {
  // Copy users.json from root to /tmp if not present
  try {
    await fs.access(USERS_FILE);
  } catch {
    try {
      const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
      await fs.writeFile(USERS_FILE, data);
    } catch {
      return NextResponse.json({ message: "No users found" }, { status: 401 });
    }
  }
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ message: "Username and password required" }, { status: 400 });
  }
  let users: any[] = [];
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    users = JSON.parse(data);
  } catch {
    return NextResponse.json({ message: "No users found" }, { status: 401 });
  }
  const user = users.find((u) => u.username === username);
  if (!user) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1d" });
  return NextResponse.json({ token });
}

// (No write logic for users.json in login route, so nothing else needed here)
