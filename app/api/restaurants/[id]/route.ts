import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// All file storage should use /tmp for Vercel compatibility.

const RESTAURANTS_FILE = path.join("/tmp", "restaurants.json");
const RESTAURANTS_FILE_ROOT = path.join(process.cwd(), "restaurants.json");

// Enhanced readRestaurants: always try /tmp, if not present, copy from root, and as fallback, read from root directly
async function readRestaurants() {
  // Try /tmp first, copy from root if missing
  try {
    await fs.access(RESTAURANTS_FILE);
  } catch {
    try {
      const data = await fs.readFile(RESTAURANTS_FILE_ROOT, "utf-8");
      await fs.writeFile(RESTAURANTS_FILE, data);
    } catch {
      // If copy fails, fallback to reading from root directly
      try {
        const data = await fs.readFile(RESTAURANTS_FILE_ROOT, "utf-8");
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
    // As a last fallback, try root again
    try {
      const data = await fs.readFile(RESTAURANTS_FILE_ROOT, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}

// writeRestaurants: always use /tmp for both read and write
async function writeRestaurants(restaurants: any[]) {
  await fs.writeFile(RESTAURANTS_FILE, JSON.stringify(restaurants, null, 2));
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const restaurants = await readRestaurants();
  const restaurant = restaurants.find((r: any) => r.id === params.id);
  if (!restaurant) {
    return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
  }
  return NextResponse.json(restaurant);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const restaurants = await readRestaurants();
  const idx = restaurants.findIndex((r: any) => r.id === params.id);
  if (idx === -1) {
    return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
  }
  const data = await req.json();
  restaurants[idx] = { ...restaurants[idx], ...data };
  await writeRestaurants(restaurants);
  return NextResponse.json(restaurants[idx]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let restaurants = await readRestaurants();
  const idx = restaurants.findIndex((r: any) => r.id === params.id);
  if (idx === -1) {
    return NextResponse.json({ message: "Restaurant not found" }, { status: 404 });
  }
  const deleted = restaurants[idx];
  restaurants.splice(idx, 1);
  await writeRestaurants(restaurants);
  return NextResponse.json(deleted);
}
