import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export async function GET(req: NextRequest, { params }: { params: { filename: string[] } }) {
  // Support /api/photos/uploads/[...filename]
  
  const filename = params.filename.join("/");
  const filePath = path.join(process.cwd(), "public","uploads", filename);
  console.log("Fetching file:", filePath);
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
