import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/utils/constants/api";

interface LibraryData {
  albums: MediaApi.Album[];
  artists: MediaApi.Artist[];
  playlists: MediaApi.Playlist[];
  stats?: {
    songCount: number;
    totalSizeBytes: number;
    capacityGB: number;
  };
}

interface CommonFetcherProps {
  /** Data will not be fetched until `refetch` is called or lazy becomes false. */
  lazy?: boolean;
}

interface AlbumFetcherProps {
  id: string;
  inLibrary?: boolean;
}

interface AlbumsFetcherProps {
  artworkSize?: number;
  inLibrary?: boolean;
}

interface ArtistFetcherProps {
  id: string;
  artworkSize?: number;
  inLibrary?: boolean;
}

interface PlaylistFetcherProps {
  id: string;
  inLibrary?: boolean;
}

interface SearchFetcherProps {
  query: string;
}

/** Fetches the full music library from the server-side API route. Cached for the session. */
const useLibrary = (enabled = true) => {
  return useQuery<LibraryData>({
    queryKey: ["library"],
    queryFn: async (): Promise<LibraryData> => {
      const res = await fetch(`${API_URL}/music`);
      if (!res.ok) throw new Error("Failed to fetch music library");
      return res.json();
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

export const useMusicStats = () => {
  const { data: library } = useLibrary();
  return library?.stats ?? { songCount: 0, totalSizeBytes: 0, capacityGB: 64 };
};

export const useFetchAlbum = (
  options: CommonFetcherProps & AlbumFetcherProps
) => {
  const { data: library, isLoading } = useLibrary(!options.lazy);
  const album = library?.albums.find((a) => a.id === options.id);
  return { data: album, isLoading };
};

export const useFetchAlbums = (
  options: CommonFetcherProps & AlbumsFetcherProps
) => {
  const { data: library, isLoading } = useLibrary(!options.lazy);

  return {
    data: library
      ? { pages: [{ data: library.albums, nextPageParam: undefined }] }
      : undefined,
    isLoading,
    fetchNextPage: async () => {},
    isFetchingNextPage: false,
    hasNextPage: false,
  };
};

export const useFetchArtists = (options: CommonFetcherProps) => {
  const { data: library, isLoading } = useLibrary(!options.lazy);

  return {
    data: library
      ? { pages: [{ data: library.artists, nextPageParam: undefined }] }
      : undefined,
    isLoading,
    fetchNextPage: async () => {},
    isFetchingNextPage: false,
    hasNextPage: false,
  };
};

export const useFetchArtistAlbums = (
  options: CommonFetcherProps & ArtistFetcherProps
) => {
  const { data: library, isLoading } = useLibrary(!options.lazy);

  const artist = library?.artists.find((a) => a.id === options.id);
  const albums =
    artist?.albums ??
    library?.albums.filter((a) => a.artistName === artist?.name) ??
    [];

  return { data: albums, isLoading };
};

export const useFetchPlaylists = (options: CommonFetcherProps) => {
  const { data: library, isLoading } = useLibrary(!options.lazy);

  return {
    data: library
      ? { pages: [{ data: library.playlists, nextPageParam: undefined }] }
      : undefined,
    isLoading,
    fetchNextPage: async () => {},
    isFetchingNextPage: false,
    hasNextPage: false,
  };
};

export const useFetchPlaylist = (
  options: CommonFetcherProps & PlaylistFetcherProps
) => {
  const { data: library, isLoading } = useLibrary(!options.lazy);
  const playlist = library?.playlists.find((p) => p.id === options.id);
  return { data: playlist, isLoading };
};

export const useFetchSearchResults = (
  options: CommonFetcherProps & SearchFetcherProps
) => {
  const { data: library } = useLibrary();

  return useQuery<MediaApi.SearchResults>({
    queryKey: ["search", { query: options.query }],
    queryFn: async (): Promise<MediaApi.SearchResults> => {
      const q = options.query.toLowerCase().trim();

      if (!q || !library) {
        return { artists: [], songs: [], albums: [], playlists: [] };
      }

      const matchedAlbums = library.albums.filter((a) =>
        a.name.toLowerCase().includes(q)
      );

      const matchedArtists = library.artists.filter((a) =>
        a.name.toLowerCase().includes(q)
      );

      const allSongs = library.albums.flatMap((a) => a.songs);
      const matchedSongs = allSongs.filter((s) =>
        s.name.toLowerCase().includes(q)
      );

      const matchedPlaylists = library.playlists.filter((p) =>
        p.name.toLowerCase().includes(q)
      );

      return {
        albums: matchedAlbums,
        artists: matchedArtists,
        songs: matchedSongs,
        playlists: matchedPlaylists,
      };
    },
    enabled: !options.lazy,
  });
};
