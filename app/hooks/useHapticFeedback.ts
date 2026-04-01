import { useCallback, useMemo } from "react";
import { haptic } from "ios-haptics";
import { useSettings } from "@/hooks";

/**
 * Provides haptic feedback for user interactions.
 *
 * Uses ios-haptics for all events — it targets the iOS 17.4+ Taptic Engine
 * via a hidden checkbox trick, with automatic fallback to navigator.vibrate()
 * on Android and other platforms.
 *
 * The previous forceVibrate=true path used navigator.vibrate() directly for
 * scroll events, but that API is unsupported on iOS Safari so scroll haptics
 * never fired on the primary target platform. Using haptic() for everything
 * is the correct fix.
 */
const useHapticFeedback = () => {
  const { hapticsEnabled } = useSettings();

  const triggerHaptics = useCallback(() => {
    if (!hapticsEnabled) return;
    haptic();
  }, [hapticsEnabled]);

  return useMemo(() => ({ triggerHaptics }), [triggerHaptics]);
};

export default useHapticFeedback;
