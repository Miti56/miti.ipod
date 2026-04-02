---
name: Haptics implementation
description: Scroll haptics were broken on iOS because navigator.vibrate is unsupported in Safari
type: feedback
---

The original code had `triggerHaptics(forceVibrate = false)` with two paths:
- `forceVibrate = true` → `navigator.vibrate(10)` (for scroll, but unsupported on iOS Safari)
- `forceVibrate = false` → `haptic()` from ios-haptics (for button presses)

This meant scroll haptics silently failed on iOS. Fixed by removing the distinction — always use `haptic()` which already has a navigator.vibrate fallback for non-iOS.

**Why:** `navigator.vibrate` is not available in Safari. `haptic()` from ios-haptics uses the iOS Taptic Engine on iOS 17.4+ and falls back to navigator.vibrate elsewhere.

**How to apply:** Never split haptics into two code paths based on gesture type. Use `haptic()` for all interactions.
