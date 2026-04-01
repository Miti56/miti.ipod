import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as mm from "music-metadata";

export const dynamic = "force-dynamic";

const SUPPORTED_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"];

interface PlaylistDefinition {
  id: string;
  name: string;
  curatorName?: string;
  artwork?: MediaApi.Artwork;
  songFiles?: string[];
}

export async function GET() {
  const musicDir = path.join(process.cwd(), "public", "music");

  if (!fs.existsSync(musicDir)) {
    return NextResponse.json({ albums: [], artists: [], playlists: [] });
  }

  let files: string[] = [];
  try {
    files = fs.readdirSync(musicDir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) && !f.startsWith(".");
    });
  } catch {
    return NextResponse.json({ albums: [], artists: [], playlists: [] });
  }

  // Parse ID3 metadata for each audio file
  const songs: MediaApi.Song[] = [];

  for (const filename of files) {
    const filePath = path.join(musicDir, filename);
    const encodedFilename = encodeURIComponent(filename);

    try {
      const metadata = await mm.parseFile(filePath, {
        duration: true,
        skipPostHeaders: true,
      });
      const { common, format } = metadata;

      const hasArtwork = !!common.picture?.[0];

      songs.push({
        id: encodedFilename,
        name: common.title ?? filename.replace(/\.[^/.]+$/, ""),
        artistName: common.artist ?? common.albumartist ?? "Unknown Artist",
        albumName: common.album ?? "Singles",
        artwork: {
          url: hasArtwork
            ? `/api/music/artwork?file=${encodedFilename}`
            : "",
        },
        duration: Math.round((format.duration ?? 0) * 1000),
        trackNumber: common.track.no ?? 0,
        url: `/music/${filename}`,
      });
    } catch {
      // Fallback: derive info from filename if metadata parsing fails
      songs.push({
        id: encodedFilename,
        name: filename.replace(/\.[^/.]+$/, ""),
        artistName: "Unknown Artist",
        albumName: "Singles",
        artwork: { url: "" },
        duration: 0,
        trackNumber: 0,
        url: `/music/${filename}`,
      });
    }
  }

  // Sort by track number within each album
  songs.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));

  // Group songs into albums
  const albumMap = new Map<string, MediaApi.Album>();
  for (const song of songs) {
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

  // Group albums into artists
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

  // Load playlist definitions from library.json
  let playlists: MediaApi.Playlist[] = [];
  try {
    const libraryPath = path.join(process.cwd(), "app", "data", "library.json");
    const libraryJson = JSON.parse(fs.readFileSync(libraryPath, "utf-8"));

    playlists = (libraryJson.playlists ?? []).map(
      (p: PlaylistDefinition): MediaApi.Playlist => ({
        id: p.id,
        name: p.name,
        curatorName: p.curatorName ?? "",
        url: "",
        artwork: p.artwork ?? { url: "" },
        songs: (p.songFiles ?? [])
          .map((filename) => songs.find((s) => s.url === `/music/${filename}`))
          .filter((s): s is MediaApi.Song => !!s),
      })
    );
  } catch {
    // library.json missing or invalid — no playlists
  }

  return NextResponse.json({ albums, artists, playlists });
}
