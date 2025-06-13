import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// All file storage should use /tmp for Vercel compatibility.
const PHOTOS_FILE = path.join("/tmp", "photos.json");
const UPLOADS_DIR = path.join("/tmp", "uploads");

async function readPhotos() {
  try {
    const data = await fs.readFile(PHOTOS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writePhotos(photos: any[]) {
  await fs.writeFile(PHOTOS_FILE, JSON.stringify(photos, null, 2));
}

export async function POST(req: NextRequest) {
  // Only support multipart/form-data
  if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ message: "Content-Type must be multipart/form-data" }, { status: 400 });
  }
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const caption = formData.get("caption")?.toString() || "";
  if (!file) {
    return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
  }
  // Save file to public/uploads
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = file.name.split(".").pop() || "jpg";
  const id = uuidv4();
  const filename = `${id}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(filePath, buffer);
  // Save photo metadata
  const url = `/uploads/${filename}`;
  const photo = {
    id,
    url,
    caption,
    uploadDate: new Date().toISOString(),
  };
  const photos = await readPhotos();
  photos.push(photo);
  await writePhotos(photos);
  return NextResponse.json(photo, { status: 201 });
}
