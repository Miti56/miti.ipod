import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as mm from "music-metadata";

export async function GET(request: NextRequest) {
  const fileParam = request.nextUrl.searchParams.get("file");

  if (!fileParam) {
    return new NextResponse(null, { status: 400 });
  }

  // `searchParams.get` already decodes percent-encoding, so
  // "My%20Playlist%2Ftrack.mp3" becomes "My Playlist/track.mp3".
  const requestedPath = decodeURIComponent(fileParam);
  const musicDir = path.join(process.cwd(), "public", "music");
  const resolvedPath = path.normalize(path.join(musicDir, requestedPath));

  // Security: reject any path that escapes public/music/.
  const relative = path.relative(musicDir, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new NextResponse(null, { status: 403 });
  }

  if (!fs.existsSync(resolvedPath)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const metadata = await mm.parseFile(resolvedPath, { skipPostHeaders: true });
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
