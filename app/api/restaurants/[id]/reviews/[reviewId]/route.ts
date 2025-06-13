import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import jwt from "jsonwebtoken";

// All file storage should use /tmp for Vercel compatibility.
const REVIEWS_FILE = path.join("/tmp", "reviews.json");
const REVIEWS_FILE_ROOT = path.join(process.cwd(), "reviews.json");
const JWKS_FILE = path.join("/tmp", "oidc_jwks.json");

async function readReviews() {
  // Copy reviews.json from root to /tmp if not present
  try {
    await fs.access(REVIEWS_FILE);
  } catch {
    try {
      const data = await fs.readFile(REVIEWS_FILE_ROOT, "utf-8");
      await fs.writeFile(REVIEWS_FILE, data);
    } catch (e) {
      return [];
    }
  }
  try {
    const data = await fs.readFile(REVIEWS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeReviews(reviews: any[]) {
  // Copy reviews.json from root to /tmp if not present
  try {
    await fs.access(REVIEWS_FILE);
  } catch {
    try {
      const data = await fs.readFile(REVIEWS_FILE_ROOT, "utf-8");
      await fs.writeFile(REVIEWS_FILE, data);
    } catch (e) {
      // If root is missing, just continue to write
    }
  }
  await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; reviewId: string } }) {
  const reviews = await readReviews();
  const review = reviews.find((r: any) => r.id === params.reviewId && r.restaurantId === params.id);
  if (!review) {
    return NextResponse.json({ message: "Review not found" }, { status: 404 });
  }
  return NextResponse.json(review);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; reviewId: string } }) {
  // Extract JWT from Authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");
  // Load public key for verification
  let jwks;
  let publicKey;
  try {
    jwks = JSON.parse(await fs.readFile(JWKS_FILE, "utf-8"));
    publicKey = jwks.publicKeyPem;
    if (!publicKey) {
      return NextResponse.json({ message: "Server error: JWKS missing publicKeyPem" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ message: "Server error: JWKS not found" }, { status: 500 });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
  } catch {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }
  const username = decoded.sub;
  if (!username) {
    return NextResponse.json({ message: "Token missing sub (username) claim" }, { status: 401 });
  }
  const reviews = await readReviews();
  const idx = reviews.findIndex((r: any) => r.id === params.reviewId && r.restaurantId === params.id);
  if (idx === -1) {
    return NextResponse.json({ message: "Review not found" }, { status: 404 });
  }
  // Only allow the user who wrote the review to update it
  if (!reviews[idx].writtenBy || reviews[idx].writtenBy.id !== username) {
    return NextResponse.json({ message: "You are not allowed to edit this review" }, { status: 403 });
  }
  const data = await req.json();
  reviews[idx] = { ...reviews[idx], ...data, lastEdited: new Date().toISOString() };
  await writeReviews(reviews);
  return NextResponse.json(reviews[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; reviewId: string } }) {
  let reviews = await readReviews();
  const idx = reviews.findIndex((r: any) => r.id === params.reviewId && r.restaurantId === params.id);
  if (idx === -1) {
    return NextResponse.json({ message: "Review not found" }, { status: 404 });
  }
  const deleted = reviews[idx];
  reviews.splice(idx, 1);
  await writeReviews(reviews);
  return NextResponse.json(deleted);
}
