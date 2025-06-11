import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

const REVIEWS_FILE = path.join(process.cwd(), "reviews.json");
const RESTAURANTS_FILE = path.join(process.cwd(), "restaurants.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";
const JWKS_FILE = path.join(process.cwd(), "oidc_jwks.json");

async function readReviews() {
  try {
    const data = await fs.readFile(REVIEWS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeReviews(reviews: any[]) {
  await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}

async function readRestaurants() {
  try {
    const data = await fs.readFile(RESTAURANTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeRestaurants(restaurants: any[]) {
  await fs.writeFile(RESTAURANTS_FILE, JSON.stringify(restaurants, null, 2));
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  let reviews = await readReviews();
  reviews = reviews.filter((r: any) => r.restaurantId === params.id);
  // Sorting
  const sort = searchParams.get("sort");
  if (sort) {
    const [field, order] = sort.split(",");
    reviews.sort((a: any, b: any) => {
      if (order === "desc") return b[field] > a[field] ? 1 : -1;
      return a[field] > b[field] ? 1 : -1;
    });
  }
  // Pagination
  const page = Number(searchParams.get("page")) || 0;
  const size = Number(searchParams.get("size")) || 10;
  const totalElements = reviews.length;
  const totalPages = Math.ceil(totalElements / size);
  const paged = reviews.slice(page * size, (page + 1) * size);
  return NextResponse.json({
    content: paged,
    pageable: {
      pageNumber: page,
      size,
      totalElements,
      totalPages,
    },
    totalPages,
    first: page === 0,
    last: page === totalPages - 1,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    decoded = jwt.verify(token, publicKey || JWT_SECRET, { algorithms: ["RS256"] });
  } catch {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }
  // Username is in sub claim
  const username = decoded.sub;
  if (!username) {
    return NextResponse.json({ message: "Token missing sub (username) claim" }, { status: 401 });
  }
  const data = await req.json();
  const reviews = await readReviews();
  const restaurants = await readRestaurants();
  const restaurant = restaurants.find((r: any) => r.id === params.id);
  if (!restaurant) {
    return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
  }
  const id = uuidv4();
  // Set writtenBy from JWT
  const writtenBy = { id: username, username };
  const review = {
    id,
    restaurantId: params.id,
    ...data,
    writtenBy, // always include UserSummary from JWT
    datePosted: new Date().toISOString(),
    photos:data.photoIds.map((photoId: string) => ({
      id: photoId,
      url: `${photoId}`,
      datecreated: new Date().toISOString()
  })),
  };
  reviews.push(review);
  await writeReviews(reviews);
  // Update restaurant's reviews, averageRating, totalReviews
  restaurant.reviews = (restaurant.reviews || []).concat([review.id]);
  restaurant.totalReviews = (restaurant.totalReviews || 0) + 1;
  // Recalculate averageRating
  const restaurantReviews = reviews.filter((r: any) => r.restaurantId === params.id);
  restaurant.averageRating = restaurantReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / restaurantReviews.length;
  await writeRestaurants(restaurants);
  return NextResponse.json(review, { status: 201 });
}
