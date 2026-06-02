"use client";

import { useRef, useCallback, useEffect } from "react";

// Procedural pen scratch sounds using Web Audio API
// Creates subtle ASMR-like scratching based on stroke speed and paper type

const PAPER_PROFILES: Record<string, {
  roughness: number;  // scratch intensity
  pitchBase: number;  // frequency base
  noiseGain: number;  // noise level
}> = {
  blank:       { roughness: 0.3,  pitchBase: 2000, noiseGain: 0.015 },
  ruled:       { roughness: 0.35, pitchBase: 2200, noiseGain: 0.018 },
  graph:       { roughness: 0.4,  pitchBase: 2400, noiseGain: 0.02 },
  watercolor:  { roughness: 0.5,  pitchBase: 1800, noiseGain: 0.025 },
  vellum:      { roughness: 0.45, pitchBase: 1900, noiseGain: 0.022 },
  midnight:    { roughness: 0.2,  pitchBase: 1600, noiseGain: 0.01 },
};

const INK_PROFILES: Record<string, {
  scratchGain: number;  // how much scratch per movement
  squeakFreq: number;   // nib squeak frequency
}> = {
  standard:     { scratchGain: 1.0, squeakFreq: 0 },
  runny:        { scratchGain: 0.6, squeakFreq: 0.3 },
  quill:        { scratchGain: 1.4, squeakFreq: 0.8 },
  calligraphy:  { scratchGain: 1.2, squeakFreq: 0.4 },
};

export function usePenSounds(paper: string = "ruled", inkStyle: string = "standard") {
  const ctxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const squeakOscRef = useRef<OscillatorNode | null>(null);
  const squeakGainRef = useRef<GainNode | null>(null);
  const activeRef = useRef(false);
  const speedRef = useRef(0);
  const enabledRef = useRef(false);

  const paperProfile = PAPER_PROFILES[paper] || PAPER_PROFILES.blank;
  const inkProfile = INK_PROFILES[inkStyle] || INK_PROFILES.standard;

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (ctxRef.current) {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      ctxRef.current = new AudioCtx();

      // Main noise source
      const bufferSize = ctxRef.current.sampleRate * 0.1;
      const buffer = ctxRef.current.createBuffer(1, bufferSize, ctxRef.current.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctxRef.current.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctxRef.current.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = paperProfile.pitchBase;
      filter.Q.value = 0.5;

      const gain = ctxRef.current.createGain();
      gain.gain.value = 0;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctxRef.current.destination);
      source.start();

      noiseNodeRef.current = source;
      filterRef.current = filter;
      gainRef.current = gain;

      // Squeak oscillator
      const squeakGain = ctxRef.current.createGain();
      squeakGain.gain.value = 0;
      const squeakOsc = ctxRef.current.createOscillator();
      squeakOsc.type = "sine";
      squeakOsc.frequency.value = inkProfile.squeakFreq * 3000 || 2500;
      squeakOsc.connect(squeakGain);
      squeakGain.connect(ctxRef.current.destination);
      squeakOsc.start();

      squeakOscRef.current = squeakOsc;
      squeakGainRef.current = squeakGain;
    }
    return ctxRef.current;
  }, [paper, inkStyle, paperProfile.pitchBase, inkProfile.squeakFreq]);

  const startScratch = useCallback(() => {
    if (!enabledRef.current) return;
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    activeRef.current = true;

    if (gainRef.current) {
      gainRef.current.gain.setValueAtTime(0, ctx.currentTime);
      gainRef.current.gain.linearRampToValueAtTime(
        paperProfile.noiseGain * inkProfile.scratchGain,
        ctx.currentTime + 0.05
      );
    }
    if (filterRef.current) {
      filterRef.current.frequency.setValueAtTime(paperProfile.pitchBase, ctx.currentTime);
    }

    if (inkProfile.squeakFreq > 0 && squeakGainRef.current) {
      squeakGainRef.current.gain.setValueAtTime(0, ctx.currentTime);
      squeakGainRef.current.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.1);
    }
  }, [ensureContext, paperProfile, inkProfile]);

  const updateScratch = useCallback((speed: number) => {
    if (!activeRef.current || !gainRef.current || !filterRef.current || !ctxRef.current) return;
    speedRef.current = speed;

    const ctx = ctxRef.current;
    const clampedSpeed = Math.min(1, speed / 5000);
    gainRef.current.gain.setValueAtTime(
      paperProfile.noiseGain * inkProfile.scratchGain * Math.max(0.1, clampedSpeed),
      ctx.currentTime
    );
    filterRef.current.frequency.setValueAtTime(
      paperProfile.pitchBase + clampedSpeed * 2000,
      ctx.currentTime
    );

    if (inkProfile.squeakFreq > 0 && squeakGainRef.current) {
      squeakGainRef.current.gain.setValueAtTime(
        0.03 * clampedSpeed,
        ctx.currentTime
      );
    }
  }, [paperProfile, inkProfile]);

  const stopScratch = useCallback(() => {
    activeRef.current = false;
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.linearRampToValueAtTime(0, ctxRef.current.currentTime + 0.08);
    }
    if (squeakGainRef.current && ctxRef.current) {
      squeakGainRef.current.gain.linearRampToValueAtTime(0, ctxRef.current.currentTime + 0.05);
    }
  }, []);

  const enable = useCallback(() => {
    enabledRef.current = true;
  }, []);

  const disable = useCallback(() => {
    enabledRef.current = false;
    stopScratch();
  }, [stopScratch]);

  return {
    startScratch,
    updateScratch,
    stopScratch,
    enable,
    disable,
  };
}
