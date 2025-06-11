import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { RestaurantSummary } from "@/domain/domain";

const RESTAURANTS_FILE = path.join(process.cwd(), "restaurants.json");

async function readRestaurants() {
  try {
    const data = await fs.readFile(RESTAURANTS_FILE, "utf-8");
    return JSON.parse(data);
  } catch(e) {
    console.error("Error reading restaurants file:", e);
    return [];
  }
}

async function writeRestaurants(restaurants: any[]) {
  await fs.writeFile(RESTAURANTS_FILE, JSON.stringify(restaurants, null, 2));
}

export async function GET(req: NextRequest) {
  // Support search params: q, minRating, latitude, longitude, radius, page, size
  const { searchParams } = new URL(req.url);
  console.log("Search params:", searchParams.toString());
  let restaurants:RestaurantSummary[] = await readRestaurants();

  // Filtering (q, minRating, etc.)
  const q = searchParams.get("q")?.toLowerCase();
  if (q) {
    restaurants = restaurants.filter((r: any) =>
      r.name.toLowerCase().includes(q) || r.cuisineType.toLowerCase().includes(q)
    );
  }
  const minRating = Number(searchParams.get("minRating"));
  if (!isNaN(minRating)) {
    restaurants = restaurants.filter((r: any) => (r.averageRating ?? 0) >= minRating);
  }
  // TODO: Add geo filtering if needed

  // Pagination
  const page = Number(searchParams.get("page")) || 0;
  const size = Number(searchParams.get("size")) || 10;
  
  const totalElements = restaurants.length;
  const totalPages = Math.ceil(totalElements / size);
  const paged = restaurants.slice(page * size, (page + 1) * size);
  

  return NextResponse.json({
    content: paged.map((r: any) => ({
      id: r.id,
      name: r.name,
      cuisineType: r.cuisineType,
      averageRating: r.averageRating,
      totalReviews: r.totalReviews,
      address: r.address,
      photos: r.photos,
    })),
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

export async function POST(req: NextRequest) {
  const data = await req.json();
  const restaurants = await readRestaurants();
  const id = uuidv4();
  const newRestaurant = {
    id,
    ...data,
    reviews: [],
    averageRating: 0,
    totalReviews: 0,
    photos: [],
  };
  restaurants.push(newRestaurant);
  await writeRestaurants(restaurants);
  return NextResponse.json(newRestaurant, { status: 201 });
}
