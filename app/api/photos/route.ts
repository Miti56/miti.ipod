import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Cache the photo listing in Netlify's CDN for the full deployment lifetime.
// A new deployment automatically regenerates and invalidates this.
export const dynamic = "force-static";

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];

export async function GET() {
  const photosDir = path.join(process.cwd(), "public", "photos");

  if (!fs.existsSync(photosDir)) {
    return NextResponse.json([]);
  }

  try {
    const files = fs
      .readdirSync(photosDir)
      .filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return SUPPORTED_EXTENSIONS.includes(ext) && !f.startsWith(".");
      })
      .sort();

    const photos = files.map((filename, index) => ({
      id: encodeURIComponent(filename),
      url: `/photos/${encodeURIComponent(filename)}`,
      name: filename.replace(/\.[^/.]+$/, "") || `Photo ${index + 1}`,
    }));

    return NextResponse.json(photos);
  } catch {
    return NextResponse.json([]);
  }
}
