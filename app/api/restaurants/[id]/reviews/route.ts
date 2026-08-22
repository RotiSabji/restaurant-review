import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { getJwks } from "@/lib/redis";

const REVIEWS_FILE = path.join("/tmp", "reviews.json");
const REVIEWS_FILE_ROOT = path.join(process.cwd(), "reviews.json");
const RESTAURANTS_FILE = path.join("/tmp", "restaurants.json");
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

async function readReviews() {
  try {
    await fs.access(REVIEWS_FILE);
  } catch {
    try {
      const data = await fs.readFile(REVIEWS_FILE_ROOT, "utf-8");
      await fs.writeFile(REVIEWS_FILE, data);
    } catch {
      try {
        const data = await fs.readFile(REVIEWS_FILE_ROOT, "utf-8");
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
  }
  try {
    const data = await fs.readFile(REVIEWS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    try {
      const data = await fs.readFile(REVIEWS_FILE_ROOT, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
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

async function readRestaurants() {
  try {
    await fs.access(RESTAURANTS_FILE);
  } catch {
    try {
      const data = await fs.readFile(path.join(process.cwd(), "restaurants.json"), "utf-8");
      await fs.writeFile(RESTAURANTS_FILE, data);
    } catch {
      try {
        const data = await fs.readFile(path.join(process.cwd(), "restaurants.json"), "utf-8");
        return JSON.parse(data);
      } catch {
        return [];
      }
    }
  }
  try {
    const data = await fs.readFile(RESTAURANTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    try {
      const data = await fs.readFile(path.join(process.cwd(), "restaurants.json"), "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}

async function writeRestaurants(restaurants: any[]) {
  try {
    await fs.writeFile(RESTAURANTS_FILE, JSON.stringify(restaurants, null, 2));
  } catch {
    try {
      await fs.writeFile(path.join(process.cwd(), "restaurants.json"), JSON.stringify(restaurants, null, 2));
    } catch {}
  }
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
  const totalPages = Math.ceil(totalElements / size) || 1;
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
  const data = await req.json();
  const reviews = await readReviews();
  const restaurants = await readRestaurants();
  const restaurant = restaurants.find((r: any) => r.id === params.id);
  if (!restaurant) {
    return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
  }
  const id = uuidv4();
  const writtenBy = { id: username, username };
  const review = {
    id,
    restaurantId: params.id,
    ...data,
    writtenBy,
    datePosted: new Date().toISOString(),
    photos: (data.photoIds || []).map((photoId: string) => ({
      id: photoId,
      url: `${photoId}`,
      datecreated: new Date().toISOString()
    })),
  };
  reviews.push(review);
  await writeReviews(reviews);

  restaurant.reviews = (restaurant.reviews || []).concat([review.id]);
  restaurant.totalReviews = (restaurant.totalReviews || 0) + 1;
  const restaurantReviews = reviews.filter((r: any) => r.restaurantId === params.id);
  restaurant.averageRating = restaurantReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / restaurantReviews.length;
  await writeRestaurants(restaurants);
  return NextResponse.json(review, { status: 201 });
}
