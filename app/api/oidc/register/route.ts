import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";

// All file storage should use /tmp for Vercel compatibility.

const USERS_FILE = path.join("/tmp", "users.json");
const USERS_FILE_ROOT = path.join(process.cwd(), "users.json");

export async function POST(req: NextRequest) {
  // Copy users.json from root to /tmp if not present
  try {
    await fs.access(USERS_FILE);
  } catch {
    try {
      const data = await fs.readFile(USERS_FILE_ROOT, "utf-8");
      await fs.writeFile(USERS_FILE, data);
    } catch {
      // If root is missing, just continue to create a new file
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
    users = [];
  }
  if (users.find((u) => u.username === username)) {
    return NextResponse.json({ message: "User already exists" }, { status: 409 });
  }
  const hashed = await bcrypt.hash(password, 10);
  users.push({ username, password: hashed });
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  return NextResponse.json({ message: "User registered" }, { status: 201 });
}
