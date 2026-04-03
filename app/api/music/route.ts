import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PERSONAL_INFO } from "@/data/personal";

// music.json is a static file — regenerated only on new deploys.
export const dynamic = "force-static";

interface JsonSong {
  artist: string;
  title: string;
  file: string;
  url: string;
  album?: string;
  year?: number;
  thumbnail?: string;
}

type MusicJson = Record<string, JsonSong[]>;

export async function GET() {
  const jsonPath = path.join(process.cwd(), "public", "music", "music.json");

  let musicData: MusicJson;
  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    musicData = JSON.parse(raw);
  } catch {
    return NextResponse.json({
      albums: [],
      artists: [],
      playlists: [],
      stats: { songCount: 0, totalSizeBytes: 0, capacityGB: 64 },
    });
  }

  const allSongs: MediaApi.Song[] = [];
  const playlists: MediaApi.Playlist[] = [];

  for (const [playlistName, jsonSongs] of Object.entries(musicData)) {
    const playlistId = encodeURIComponent(playlistName);

    const playlistSongs: MediaApi.Song[] = jsonSongs.map((s, index) => ({
      id: `${playlistId}/${encodeURIComponent(s.file)}`,
      name: s.title,
      artistName: s.artist,
      // Use the explicit album field when present, otherwise fall back to artist name.
      albumName: s.album ?? s.artist,
      url: s.url,
      // Use low-res thumbnail when available; empty string falls back to default artwork.
      artwork: { url: s.thumbnail ?? "" },
      // Duration is unknown until the audio element loads the file.
      duration: 0,
      trackNumber: index + 1,
    }));

    allSongs.push(...playlistSongs);

    // Use the first available thumbnail as the playlist cover.
    const coverArtwork =
      playlistSongs.find((s) => s.artwork?.url)?.artwork ?? { url: "" };

    playlists.push({
      id: playlistId,
      name: playlistName,
      curatorName: PERSONAL_INFO.name,
      url: "",
      artwork: coverArtwork,
      songs: playlistSongs,
    });
  }

  // ── Albums: one per unique album name + artist pair.
  // When the JSON has an "album" field, songs are grouped by actual album.
  // Without it, albumName = artist name, so each artist gets one card.
  const albumMap = new Map<string, MediaApi.Album>();
  for (const song of allSongs) {
    const albumName = song.albumName ?? "Unknown Album";
    const artistName = song.artistName ?? "Unknown Artist";
    // Key by album+artist so two different artists with the same album title stay separate.
    const albumKey = `${albumName}__${artistName}`;
    if (!albumMap.has(albumKey)) {
      albumMap.set(albumKey, {
        id: encodeURIComponent(albumKey),
        name: albumName,
        artistName: artistName,
        artwork: song.artwork?.url ? song.artwork : { url: "" },
        url: "",
        songs: [],
      });
    }
    albumMap.get(albumKey)!.songs.push(song);
  }
  const albums = Array.from(albumMap.values());

  // ── Artists: group songs by artist, then by the playlist they appear in ───────
  // Each artist will have one sub-album per playlist they appear in.
  const artistMap = new Map<
    string,
    MediaApi.Artist & { _albumMap: Map<string, MediaApi.Album> }
  >();

  for (const song of allSongs) {
    const artistName = song.artistName ?? "Unknown Artist";
    const artistId = encodeURIComponent(artistName);

    if (!artistMap.has(artistId)) {
      artistMap.set(artistId, {
        id: artistId,
        name: artistName,
        url: "",
        artwork: song.artwork?.url ? song.artwork : { url: "" },
        albums: [],
        _albumMap: new Map(),
      });
    }

    const artist = artistMap.get(artistId)!;
    const albumName = song.albumName ?? "Singles";
    const albumId = encodeURIComponent(albumName);

    if (!artist._albumMap.has(albumId)) {
      const artistAlbum: MediaApi.Album = {
        id: albumId,
        name: albumName,
        artistName: artistName,
        artwork: song.artwork?.url ? song.artwork : { url: "" },
        url: "",
        songs: [],
      };
      artist._albumMap.set(albumId, artistAlbum);
      artist.albums!.push(artistAlbum);
    }

    artist._albumMap.get(albumId)!.songs.push(song);
  }

  // Strip the internal _albumMap before serialising.
  const artists: MediaApi.Artist[] = Array.from(artistMap.values()).map(
    ({ _albumMap: _ignored, ...rest }) => rest
  );

  // ── Device capacity ───────────────────────────────────────────────────────────
  let capacityGB = 64;
  try {
    const libraryPath = path.join(process.cwd(), "app", "data", "library.json");
    const libraryJson = JSON.parse(fs.readFileSync(libraryPath, "utf-8"));
    capacityGB = (libraryJson as any).capacity ?? 64;
  } catch {
    /* use default */
  }

  return NextResponse.json({
    albums,
    artists,
    playlists,
    stats: { songCount: allSongs.length, totalSizeBytes: 0, capacityGB },
  });
}
