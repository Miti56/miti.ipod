import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ColorScheme } from "@/utils/colorScheme";
import { DeviceThemeName } from "@/utils/themes";

export type ShuffleMode = "off" | "songs" | "albums";
export type RepeatMode = "off" | "one" | "all";

export const VOLUME_KEY = "ipodVolume";
export const COLOR_SCHEME_KEY = "ipodColorScheme";
export const DEVICE_COLOR_KEY = "ipodSelectedDeviceTheme";
export const SHUFFLE_MODE_KEY = "ipodShuffleMode";
export const REPEAT_MODE_KEY = "ipodRepeatMode";
export const HAPTICS_ENABLED_KEY = "ipodHapticsEnabled";
export const CLICK_SOUND_ENABLED_KEY = "ipodClickSoundEnabled";

export interface SettingsState {
  colorScheme: ColorScheme;
  deviceTheme: DeviceThemeName;
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  hapticsEnabled: boolean;
  clickSoundEnabled: boolean;
}

type SettingsContextType = [
  SettingsState,
  React.Dispatch<React.SetStateAction<SettingsState>>,
];

export const SettingsContext = createContext<SettingsContextType>([
  {} as any,
  () => {},
]);

export type SettingsHook = SettingsState & {
  isAuthorized: boolean;
  setColorScheme: (colorScheme?: ColorScheme) => void;
  setDeviceTheme: (deviceTheme: DeviceThemeName) => void;
  setShuffleMode: (mode: ShuffleMode) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setClickSoundEnabled: (enabled: boolean) => void;
};

export const useSettings = (): SettingsHook => {
  const [state, setState] = useContext(SettingsContext);

  const setDeviceTheme = useCallback(
    (deviceTheme: DeviceThemeName) => {
      setState((prevState) => ({ ...prevState, deviceTheme }));
      localStorage.setItem(DEVICE_COLOR_KEY, deviceTheme);
    },
    [setState]
  );

  const setColorScheme = useCallback(
    (colorScheme?: ColorScheme) => {
      setState((prevState) => {
        const updatedColorScheme =
          (colorScheme ?? prevState.colorScheme === "dark")
            ? "default"
            : "dark";

        localStorage.setItem(COLOR_SCHEME_KEY, `${updatedColorScheme}`);

        return {
          ...prevState,
          colorScheme: updatedColorScheme,
        };
      });
    },
    [setState]
  );

  const setShuffleMode = useCallback(
    (mode: ShuffleMode) => {
      setState((prevState) => ({ ...prevState, shuffleMode: mode }));
      localStorage.setItem(SHUFFLE_MODE_KEY, mode);
    },
    [setState]
  );

  const setRepeatMode = useCallback(
    (mode: RepeatMode) => {
      setState((prevState) => ({ ...prevState, repeatMode: mode }));
      localStorage.setItem(REPEAT_MODE_KEY, mode);
    },
    [setState]
  );

  const setHapticsEnabled = useCallback(
    (enabled: boolean) => {
      setState((prevState) => ({ ...prevState, hapticsEnabled: enabled }));
      localStorage.setItem(HAPTICS_ENABLED_KEY, enabled ? "true" : "false");
    },
    [setState]
  );

  const setClickSoundEnabled = useCallback(
    (enabled: boolean) => {
      setState((prevState) => ({ ...prevState, clickSoundEnabled: enabled }));
      localStorage.setItem(CLICK_SOUND_ENABLED_KEY, enabled ? "true" : "false");
    },
    [setState]
  );

  return {
    ...state,
    isAuthorized: true,
    setColorScheme,
    setDeviceTheme,
    setShuffleMode,
    setRepeatMode,
    setHapticsEnabled,
    setClickSoundEnabled,
  };
};

interface Props {
  children: React.ReactNode;
}

export const SettingsProvider = ({ children }: Props) => {
  const [settingsState, setSettingsState] = useState<SettingsState>({
    colorScheme: "default",
    deviceTheme: "silver",
    shuffleMode: "off",
    repeatMode: "off",
    hapticsEnabled: true,
    clickSoundEnabled: true,
  });

  const handleMount = useCallback(() => {
    setSettingsState((prevState) => ({
      ...prevState,
      colorScheme:
        (localStorage.getItem(COLOR_SCHEME_KEY) as ColorScheme) ?? "default",
      deviceTheme:
        (localStorage.getItem(DEVICE_COLOR_KEY) as DeviceThemeName) ?? "silver",
      shuffleMode:
        (localStorage.getItem(SHUFFLE_MODE_KEY) as ShuffleMode) ?? "off",
      repeatMode:
        (localStorage.getItem(REPEAT_MODE_KEY) as RepeatMode) ?? "off",
      hapticsEnabled: localStorage.getItem(HAPTICS_ENABLED_KEY) !== "false",
      clickSoundEnabled: localStorage.getItem(CLICK_SOUND_ENABLED_KEY) !== "false",
    }));
  }, []);

  useEffect(() => {
    handleMount();
  }, [handleMount]);

  return (
    <SettingsContext.Provider value={[settingsState, setSettingsState]}>
      {children}
    </SettingsContext.Provider>
  );
};

export default useSettings;
