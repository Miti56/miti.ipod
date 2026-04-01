import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as mm from "music-metadata";
import { PERSONAL_INFO } from "@/data/personal";

// Cache the library listing for the full deployment lifetime.
// A new deployment automatically regenerates this.
export const dynamic = "force-static";

const SUPPORTED_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"];

/**
 * Parses a single audio file into a Song object.
 *
 * @param filePath  - Absolute path to the file on disk.
 * @param filename  - Bare filename (e.g. "track.mp3").
 * @param relativeDir - Folder name relative to public/music/ (omit for root-level files).
 */
async function parseSong(
  filePath: string,
  filename: string,
  relativeDir?: string
): Promise<MediaApi.Song> {
  // The song ID is the URL-encoded relative path from public/music/.
  // Root:  "track.mp3"          → "track.mp3"
  // Sub:   "My Playlist/t.mp3"  → "My%20Playlist%2Ft.mp3"
  const relPath = relativeDir ? `${relativeDir}/${filename}` : filename;
  const songId = encodeURIComponent(relPath);

  // Static file URL — subdirectory segments are encoded individually so
  // Next.js/Netlify can resolve the file from public/.
  const fileUrl = relativeDir
    ? `/music/${encodeURIComponent(relativeDir)}/${encodeURIComponent(filename)}`
    : `/music/${encodeURIComponent(filename)}`;

  try {
    const metadata = await mm.parseFile(filePath, {
      duration: true,
      skipPostHeaders: true,
    });
    const { common, format } = metadata;
    const hasArtwork = !!common.picture?.[0];

    return {
      id: songId,
      name: common.title ?? filename.replace(/\.[^/.]+$/, ""),
      artistName: common.artist ?? common.albumartist ?? "Unknown Artist",
      albumName: common.album ?? "Singles",
      artwork: {
        url: hasArtwork ? `/api/music/artwork?file=${songId}` : "",
      },
      duration: Math.round((format.duration ?? 0) * 1000),
      trackNumber: common.track.no ?? 0,
      url: fileUrl,
    };
  } catch {
    return {
      id: songId,
      name: filename.replace(/\.[^/.]+$/, ""),
      artistName: "Unknown Artist",
      albumName: "Singles",
      artwork: { url: "" },
      duration: 0,
      trackNumber: 0,
      url: fileUrl,
    };
  }
}

export async function GET() {
  const musicDir = path.join(process.cwd(), "public", "music");

  if (!fs.existsSync(musicDir)) {
    return NextResponse.json({ albums: [], artists: [], playlists: [], stats: { songCount: 0, totalSizeBytes: 0, capacityGB: 64 } });
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(musicDir).filter((f) => !f.startsWith("."));
  } catch {
    return NextResponse.json({ albums: [], artists: [], playlists: [] });
  }

  const allSongs: MediaApi.Song[] = [];
  const playlists: MediaApi.Playlist[] = [];
  let totalSizeBytes = 0;

  // ── Root-level audio files ───────────────────────────────────────────────
  const rootFiles = entries.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });

  for (const filename of rootFiles) {
    const filePath = path.join(musicDir, filename);
    allSongs.push(await parseSong(filePath, filename));
    try { totalSizeBytes += fs.statSync(filePath).size; } catch { /* ignore */ }
  }

  // ── Subdirectories → playlists ────────────────────────────────────────────
  // Each folder directly inside public/music/ becomes a playlist.
  // The folder name is used as the playlist name.
  const subdirs = entries
    .filter((f) => {
      try { return fs.statSync(path.join(musicDir, f)).isDirectory(); } catch { return false; }
    })
    .sort();

  for (const dirName of subdirs) {
    const dirPath = path.join(musicDir, dirName);
    let dirEntries: string[];
    try {
      dirEntries = fs.readdirSync(dirPath).filter((f) => !f.startsWith("."));
    } catch { continue; }

    const audioFiles = dirEntries.filter((f) =>
      SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase())
    );

    const playlistSongs: MediaApi.Song[] = [];

    for (const filename of audioFiles) {
      const filePath = path.join(dirPath, filename);
      const song = await parseSong(filePath, filename, dirName);
      allSongs.push(song);
      playlistSongs.push(song);
      try { totalSizeBytes += fs.statSync(filePath).size; } catch { /* ignore */ }
    }

    playlistSongs.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));

    if (playlistSongs.length > 0) {
      playlists.push({
        id: encodeURIComponent(dirName),
        name: dirName,
        curatorName: PERSONAL_INFO.name,
        url: "",
        // Use the first song's artwork as the playlist cover.
        artwork: playlistSongs[0].artwork ?? { url: "" },
        songs: playlistSongs,
      });
    }
  }

  allSongs.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));

  // ── Group songs into albums ───────────────────────────────────────────────
  const albumMap = new Map<string, MediaApi.Album>();
  for (const song of allSongs) {
    const albumName = song.albumName ?? "Singles";
    const albumId = encodeURIComponent(albumName);
    if (!albumMap.has(albumId)) {
      albumMap.set(albumId, {
        id: albumId,
        name: albumName,
        artistName: song.artistName,
        artwork: song.artwork,
        url: "",
        songs: [],
      });
    }
    albumMap.get(albumId)!.songs.push(song);
  }
  const albums = Array.from(albumMap.values());

  // ── Group albums into artists ─────────────────────────────────────────────
  const artistMap = new Map<string, MediaApi.Artist>();
  for (const album of albums) {
    const artistName = album.artistName ?? "Unknown Artist";
    const artistId = encodeURIComponent(artistName);
    if (!artistMap.has(artistId)) {
      artistMap.set(artistId, {
        id: artistId,
        name: artistName,
        url: "",
        artwork: album.artwork,
        albums: [],
      });
    }
    artistMap.get(artistId)!.albums!.push(album);
  }
  const artists = Array.from(artistMap.values());

  // ── Read device capacity from config ──────────────────────────────────────
  let capacityGB = 64;
  try {
    const libraryPath = path.join(process.cwd(), "app", "data", "library.json");
    const libraryJson = JSON.parse(fs.readFileSync(libraryPath, "utf-8"));
    capacityGB = (libraryJson as any).capacity ?? 64;
  } catch { /* use default */ }

  return NextResponse.json({
    albums,
    artists,
    playlists,
    stats: { songCount: allSongs.length, totalSizeBytes, capacityGB },
  });
}
