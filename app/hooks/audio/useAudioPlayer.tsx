"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useEventListener, useHapticFeedback } from "@/hooks";
import {
  useSettings,
  VOLUME_KEY,
  ShuffleMode,
  RepeatMode,
} from "@/hooks/utils/useSettings";
import { IpodEvent } from "@/utils/events";

const defaultPlaybackInfoState = {
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  currentTime: 0,
  timeRemaining: 0,
  percent: 0,
  duration: 0,
};

interface AudioPlayerState {
  playbackInfo: typeof defaultPlaybackInfoState;
  nowPlayingItem?: MediaApi.MediaItem;
  volume: number;
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  play: (queueOptions: MediaApi.QueueOptions) => Promise<void>;
  pause: () => Promise<void>;
  seekToTime: (time: number) => Promise<void>;
  setVolume: (volume: number) => void;
  setShuffleMode: (mode: ShuffleMode) => Promise<void>;
  setRepeatMode: (mode: RepeatMode) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  updateNowPlayingItem: () => Promise<void>;
  updatePlaybackInfo: () => Promise<void>;
  reset: () => void;
  analyserNode: AnalyserNode | null;
}

export const AudioPlayerContext = createContext<AudioPlayerState>(
  {} as AudioPlayerState
);

type AudioPlayerHook = AudioPlayerState;

export const useAudioPlayer = (): AudioPlayerHook => {
  return useContext(AudioPlayerContext);
};

interface Props {
  children: React.ReactNode;
}

/** Fisher-Yates shuffle */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function songToMediaItem(song: MediaApi.Song): MediaApi.MediaItem {
  return {
    id: song.id,
    name: song.name,
    artistName: song.artistName,
    albumName: song.albumName,
    artwork: song.artwork,
    duration: song.duration,
    trackNumber: song.trackNumber,
    url: song.url,
  };
}

export const AudioPlayerProvider = ({ children }: Props) => {
  const {
    shuffleMode,
    repeatMode,
    setShuffleMode: updateShuffleModeSetting,
    setRepeatMode: updateRepeatModeSetting,
  } = useSettings();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<MediaApi.Song[]>([]);
  const currentIndexRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // New ref to hold our GainNode (volume control)
  const gainNodeRef = useRef<GainNode | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const [volume, setVolumeState] = useState(0.5);
  const [nowPlayingItem, setNowPlayingItem] = useState<MediaApi.MediaItem>();
  const [playbackInfo, setPlaybackInfo] = useState(defaultPlaybackInfoState);

  // Stable refs for shuffle/repeat modes to avoid stale closures in event listeners
  const shuffleModeRef = useRef<ShuffleMode>(shuffleMode);
  const repeatModeRef = useRef<RepeatMode>(repeatMode);

  useEffect(() => {
    shuffleModeRef.current = shuffleMode;
  }, [shuffleMode]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const getOrCreateAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      if (typeof window !== "undefined") {
        try {
          const AudioCtx =
            window.AudioContext || (window as any).webkitAudioContext;
          const actx = new AudioCtx({ latencyHint: "interactive" });

          const source = actx.createMediaElementSource(audioRef.current);
          const analyser = actx.createAnalyser();
          const gainNode = actx.createGain(); // Create Web Audio volume control

          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.82;

          // Initial volume setup to avoid blasting at 100% on start
          const savedVolume = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "0.5");
          gainNode.gain.value = savedVolume;

          // PROPER ROUTING:
          // Source -> Analyser (Visualizer) -> GainNode (Volume) -> Destination (Speakers)
          source.connect(analyser);
          analyser.connect(gainNode);
          gainNode.connect(actx.destination);

          audioCtxRef.current = actx;
          gainNodeRef.current = gainNode;
          setAnalyserNode(analyser);

          // Force the HTMLAudioElement to 100%. Web Audio GainNode handles the volume now!
          audioRef.current.volume = 1;
        } catch {
          // Web Audio not supported
        }
      }
    }
    return audioRef.current;
  }, []);

  const loadAndPlayIndex = useCallback(
    (index: number) => {
      const song = queueRef.current[index];
      if (!song) return;

      currentIndexRef.current = index;

      const audio = getOrCreateAudio();
      audio.src = song.url;
      audio.load();
      audio.play().catch(() => {
        // Autoplay may be blocked; ignore
      });

      setNowPlayingItem(songToMediaItem(song));
    },
    [getOrCreateAudio]
  );

  const play = useCallback(
    async (queueOptions: MediaApi.QueueOptions) => {
      let songs: MediaApi.Song[] = [];

      if (queueOptions.album?.songs?.length) {
        songs = queueOptions.album.songs;
      } else if (queueOptions.playlist?.songs?.length) {
        songs = queueOptions.playlist.songs;
      } else if (queueOptions.songs?.length) {
        songs = queueOptions.songs;
      } else if (queueOptions.song) {
        songs = [queueOptions.song];
      }

      if (!songs.length) return;

      let startPosition = queueOptions.startPosition ?? 0;

      if (shuffleModeRef.current !== "off") {
        // Shuffle the queue but keep the selected song first
        const selected = songs[startPosition];
        const rest = shuffleArray(
          songs.filter((_, i) => i !== startPosition)
        );
        songs = [selected, ...rest];
        startPosition = 0;
      }

      queueRef.current = songs;
      loadAndPlayIndex(startPosition);
    },
    [loadAndPlayIndex]
  );

  const pause = useCallback(async () => {
    audioRef.current?.pause();
  }, []);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !nowPlayingItem) return;

    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [nowPlayingItem]);

  const skipNext = useCallback(async () => {
    if (!nowPlayingItem) return;

    setPlaybackInfo((prev) => ({ ...prev, isLoading: true }));

    const queue = queueRef.current;
    const current = currentIndexRef.current;

    if (current < queue.length - 1) {
      loadAndPlayIndex(current + 1);
    } else if (repeatModeRef.current === "all") {
      loadAndPlayIndex(0);
    }

    setPlaybackInfo((prev) => ({ ...prev, isLoading: false }));
  }, [nowPlayingItem, loadAndPlayIndex]);

  const skipPrevious = useCallback(async () => {
    if (!nowPlayingItem) return;

    setPlaybackInfo((prev) => ({ ...prev, isLoading: true }));

    const audio = audioRef.current;
    // If more than 3 seconds into the track, restart it instead
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      const current = currentIndexRef.current;
      if (current > 0) {
        loadAndPlayIndex(current - 1);
      } else {
        loadAndPlayIndex(0);
      }
    }

    setPlaybackInfo((prev) => ({ ...prev, isLoading: false }));
  }, [nowPlayingItem, loadAndPlayIndex]);

  const seekToTime = useCallback(async (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const handleChangeVolume = useCallback((newVolume: number) => {
    if (gainNodeRef.current && audioCtxRef.current) {
      // Smoothly ramp volume to prevent audio popping/clicks
      gainNodeRef.current.gain.setTargetAtTime(newVolume, audioCtxRef.current.currentTime, 0.05);
    } else if (audioRef.current) {
      // Fallback for browsers where Web Audio API failed
      audioRef.current.volume = newVolume;
    }
    localStorage.setItem(VOLUME_KEY, `${newVolume}`);
    setVolumeState(newVolume);
  }, []);

  const reset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    queueRef.current = [];
    currentIndexRef.current = 0;
    setNowPlayingItem(undefined);
    setPlaybackInfo(defaultPlaybackInfoState);
  }, []);

  const handleSetShuffleMode = useCallback(
    async (mode: ShuffleMode) => {
      updateShuffleModeSetting(mode);
    },
    [updateShuffleModeSetting]
  );

  const handleSetRepeatMode = useCallback(
    async (mode: RepeatMode) => {
      updateRepeatModeSetting(mode);
    },
    [updateRepeatModeSetting]
  );

  const updateNowPlayingItem = useCallback(async () => {
    const song = queueRef.current[currentIndexRef.current];
    if (song) {
      setNowPlayingItem(songToMediaItem(song));
    }
  }, []);

  const updatePlaybackInfo = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = audio.currentTime;
    const duration = audio.duration || 0;
    const timeRemaining = duration - currentTime;
    const percent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;

    setPlaybackInfo((prev) => ({
      ...prev,
      currentTime,
      timeRemaining,
      percent,
      duration,
    }));
  }, []);

  // Set up audio element event listeners
  useEffect(() => {
    const audio = getOrCreateAudio();

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      const duration = audio.duration || 0;
      const timeRemaining = duration - currentTime;
      const percent =
        duration > 0 ? Math.round((currentTime / duration) * 100) : 0;

      setPlaybackInfo((prev) => ({
        ...prev,
        currentTime,
        timeRemaining,
        percent,
        duration,
      }));
    };

    const handleLoadedMetadata = () => {
      setPlaybackInfo((prev) => ({ ...prev, duration: audio.duration || 0 }));
    };

    const handlePlay = () => {
      audioCtxRef.current?.resume();
      setPlaybackInfo((prev) => ({
        ...prev,
        isPlaying: true,
        isPaused: false,
        isLoading: false,
      }));
    };

    const handlePause = () => {
      setPlaybackInfo((prev) => ({
        ...prev,
        isPlaying: false,
        isPaused: true,
      }));
    };

    const handleEnded = () => {
      const mode = repeatModeRef.current;
      const current = currentIndexRef.current;
      const queue = queueRef.current;

      if (mode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (current < queue.length - 1) {
        loadAndPlayIndex(current + 1);
      } else if (mode === "all") {
        loadAndPlayIndex(0);
      } else {
        setPlaybackInfo(defaultPlaybackInfoState);
      }
    };

    const handleWaiting = () => {
      setPlaybackInfo((prev) => ({ ...prev, isLoading: true }));
    };

    const handleCanPlay = () => {
      setPlaybackInfo((prev) => ({ ...prev, isLoading: false }));
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [getOrCreateAudio, loadAndPlayIndex]);

  // Initialize volume from localStorage on mount
  useEffect(() => {
    const savedVolume = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "0.5");
    handleChangeVolume(savedVolume);
  }, [handleChangeVolume]);

  const { triggerHaptics } = useHapticFeedback();

  const handlePlayPauseClick = useCallback(() => {
    triggerHaptics();
    togglePlayPause();
  }, [togglePlayPause, triggerHaptics]);

  const handleSkipNext = useCallback(() => {
    triggerHaptics();
    skipNext();
  }, [skipNext, triggerHaptics]);

  const handleSkipPrevious = useCallback(() => {
    triggerHaptics();
    skipPrevious();
  }, [skipPrevious, triggerHaptics]);

  useEventListener<IpodEvent>("playpauseclick", handlePlayPauseClick);
  useEventListener<IpodEvent>("forwardclick", handleSkipNext);
  useEventListener<IpodEvent>("backwardclick", handleSkipPrevious);

  return (
    <AudioPlayerContext.Provider
      value={{
        playbackInfo,
        nowPlayingItem,
        volume,
        shuffleMode,
        repeatMode,
        play,
        pause,
        seekToTime,
        setVolume: handleChangeVolume,
        setShuffleMode: handleSetShuffleMode,
        setRepeatMode: handleSetRepeatMode,
        togglePlayPause,
        updateNowPlayingItem,
        updatePlaybackInfo,
        skipNext,
        skipPrevious,
        reset,
        analyserNode,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export default useAudioPlayer;