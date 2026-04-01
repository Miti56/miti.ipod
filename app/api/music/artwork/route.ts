import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as mm from "music-metadata";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("file");

  if (!filename) {
    return new NextResponse(null, { status: 400 });
  }

  // Prevent path traversal attacks
  const safeName = path.basename(decodeURIComponent(filename));
  const filePath = path.join(process.cwd(), "public", "music", safeName);

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const metadata = await mm.parseFile(filePath, { skipPostHeaders: true });
    const picture = metadata.common.picture?.[0];

    if (!picture) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(Buffer.from(picture.data), {
      headers: {
        "Content-Type": picture.format || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
