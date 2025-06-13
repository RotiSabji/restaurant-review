import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

// All file storage should use /tmp for Vercel compatibility.

export async function GET(req: NextRequest, { params }: { params: { filename: string[] } }) {
  // Support /api/photos/uploads/[...filename]
  const filename = params.filename.join("/");
  const filePath = path.join("/tmp", "uploads", filename);
  const filePathRoot = path.join(process.cwd(), "public", "uploads", filename);
  console.log("Fetching file:", filePath);
  // If file does not exist in /tmp/uploads, try to copy from public/uploads
  try {
    await fs.access(filePath);
  } catch {
    try {
      const data = await fs.readFile(filePathRoot);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, data);
    } catch {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }
  }
  try {
    const file = await fs.readFile(filePath);
    // Guess content type from extension
    const ext = filename.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    else if (ext === "png") contentType = "image/png";
    else if (ext === "gif") contentType = "image/gif";
    else if (ext === "webp") contentType = "image/webp";
    return new NextResponse(file, {
      status: 200,
      headers: { "content-type": contentType },
    });
  } catch {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }
}
