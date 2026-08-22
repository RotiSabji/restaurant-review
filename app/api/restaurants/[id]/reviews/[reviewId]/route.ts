import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { getJwks } from "@/lib/redis";

const REVIEWS_FILE = path.join("/tmp", "reviews.json");
const REVIEWS_FILE_ROOT = path.join(process.cwd(), "reviews.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

async function readReviews() {
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
  try {
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
  } catch {
    try {
      await fs.writeFile(REVIEWS_FILE_ROOT, JSON.stringify(reviews, null, 2));
    } catch {}
  }
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
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");

  const jwks = await getJwks();
  const publicKey = jwks.publicKeyPem;

  let decoded: any;
  try {
    decoded = jwt.verify(token, publicKey || JWT_SECRET, { algorithms: ["RS256", "HS256"] });
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
