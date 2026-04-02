import { useCallback, useEffect, useRef } from "react";
import { useEventListener, useSettings } from "@/hooks";
import { IpodEvent } from "@/utils/events";

/**
 * Synthesizes iPod clickwheel sounds via the Web Audio API.
 *
 * Three distinct sounds are produced:
 *   - Scroll tick   – a short, high-pitched mechanical click (each menu movement)
 *   - Button press  – a slightly lower click (menu/skip/play peripheral buttons)
 *   - Center press  – a deeper, more prominent mechanical thud (center button)
 *                     The center button is larger with different acoustics, so it
 *                     gets a louder, lower-pitched sound with a noise transient.
 *
 * To swap in real audio files, replace the synthesis functions below with
 * an <audio> element or AudioBufferSourceNode that loads from a file path.
 * Recommended paths:
 *   /sounds/scroll-tick.mp3    – wheel rotation tick
 *   /sounds/button-click.mp3   – peripheral button press
 *   /sounds/center-click.mp3   – center button press
 *
 * Using the Web Audio API keeps sounds on an independent channel, so they
 * play simultaneously with music without interruption.
 */

type SoundType = "scroll" | "button" | "center";

const useClickWheelSound = () => {
  const { clickSoundEnabled } = useSettings();
  const audioCtxRef = useRef<AudioContext | null>(null);

  /**
   * Create the AudioContext once on mount with the lowest possible latency hint.
   * It starts in "suspended" state (browser requirement) and gets resumed on the
   * first user gesture — we call resume() inside playSound so the first actual
   * interaction unblocks it with zero extra delay.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    audioCtxRef.current = new (window.AudioContext ||
      (window as any).webkitAudioContext)({ latencyHint: "interactive" });
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  const getAudioCtx = useCallback((): AudioContext | null => {
    return audioCtxRef.current;
  }, []);

  const playSound = useCallback(
    (type: SoundType) => {
      if (!clickSoundEnabled) return;
      const ctx = getAudioCtx();
      if (!ctx) return;

      // Resume instantly if the browser suspended the context between gestures.
      // This is synchronous enough that scheduling at currentTime still fires
      // without perceptible delay.
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (type === "scroll") {
        // Short mechanical tick — brief noise burst with a high-pass filter
        const bufferSize = Math.floor(ctx.sampleRate * 0.012); // 12 ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 3200;
        filter.Q.value = 0.8;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start(now);
      } else if (type === "button") {
        // Peripheral button press — compact click, mid-frequency, short decay
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else {
        // Center button — deeper, more prominent mechanical thud.
        // Layered: a low oscillator pitch-drop for body + a noise transient for
        // the physical snap of the larger button mechanism.

        // Layer 1: low-frequency body thud
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.07);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.35, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);

        // Layer 2: short noise transient for the mechanical snap
        const snapSize = Math.floor(ctx.sampleRate * 0.008); // 8 ms
        const snapBuffer = ctx.createBuffer(1, snapSize, ctx.sampleRate);
        const snapData = snapBuffer.getChannelData(0);
        for (let i = 0; i < snapSize; i++) {
          snapData[i] = (Math.random() * 2 - 1) * (1 - i / snapSize);
        }

        const snapSource = ctx.createBufferSource();
        snapSource.buffer = snapBuffer;

        const snapFilter = ctx.createBiquadFilter();
        snapFilter.type = "lowpass";
        snapFilter.frequency.value = 2000;

        const snapGain = ctx.createGain();
        snapGain.gain.setValueAtTime(0.25, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

        snapSource.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapSource.start(now);
      }
    },
    [clickSoundEnabled, getAudioCtx]
  );

  const handleScroll = useCallback(() => playSound("scroll"), [playSound]);
  const handleButton = useCallback(() => playSound("button"), [playSound]);
  const handleCenter = useCallback(() => playSound("center"), [playSound]);

  useEventListener<IpodEvent>("forwardscroll", handleScroll);
  useEventListener<IpodEvent>("backwardscroll", handleScroll);
  useEventListener<IpodEvent>("centerclick", handleCenter);
  useEventListener<IpodEvent>("menuclick", handleButton);
  useEventListener<IpodEvent>("backwardclick", handleButton);
  useEventListener<IpodEvent>("forwardclick", handleButton);
  useEventListener<IpodEvent>("playpauseclick", handleButton);


};

export default useClickWheelSound;
