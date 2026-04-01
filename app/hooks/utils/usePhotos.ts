import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/utils/constants/api";

export interface Photo {
  id: string;
  url: string;
  name: string;
}

export const useFetchPhotos = () => {
  return useQuery<Photo[]>({
    queryKey: ["photos"],
    queryFn: async (): Promise<Photo[]> => {
      const res = await fetch(`${API_URL}/photos`);
      if (!res.ok) throw new Error("Failed to fetch photos");
      return res.json();
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
};
