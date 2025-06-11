import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const RESTAURANTS_FILE = path.join(process.cwd(), "restaurants.json");

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
