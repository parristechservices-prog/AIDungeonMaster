'use client';

import { useEffect, useRef, useState } from 'react';

type AmbientType = 'none' | 'tavern' | 'dungeon' | 'combat' | 'exploration' | 'boss_fight';

type Props = {
  type?: AmbientType;
};

type AudioRig = {
  context: AudioContext;
  gain: GainNode;
  nodes: AudioNode[];
  timers: number[];
};

const profiles: Record<Exclude<AmbientType, 'none'>, { label: string; icon: string; base: number; pulse: number; noise: number }> = {
  tavern: { label: 'Tavern', icon: 'Inn', base: 196, pulse: 392, noise: 0.025 },
  dungeon: { label: 'Dungeon', icon: 'Cavern', base: 82, pulse: 123, noise: 0.04 },
  combat: { label: 'Combat', icon: 'Steel', base: 110, pulse: 220, noise: 0.05 },
  exploration: { label: 'Wilderness', icon: 'Trail', base: 147, pulse: 294, noise: 0.03 },
  boss_fight: { label: 'Boss fight', icon: 'Boss', base: 73, pulse: 146, noise: 0.06 },
};

function createNoiseBuffer(context: AudioContext) {
  const bufferSize = context.sampleRate * 2;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function startAmbient(type: Exclude<AmbientType, 'none'>, volume: number): AudioRig {
  const context = new AudioContext();
  const gain = context.createGain();
  const profile = profiles[type];
  const nodes: AudioNode[] = [];
  const timers: number[] = [];

  gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.12;
  gain.connect(context.destination);

  const low = context.createOscillator();
  const lowFilter = context.createBiquadFilter();
  low.type = type === 'combat' || type === 'boss_fight' ? 'sawtooth' : 'sine';
  low.frequency.value = profile.base;
  lowFilter.type = 'lowpass';
  lowFilter.frequency.value = type === 'tavern' ? 420 : 260;
  low.connect(lowFilter);
  lowFilter.connect(gain);
  low.start();
  nodes.push(low, lowFilter);

  const pulse = context.createOscillator();
  const pulseGain = context.createGain();
  pulse.type = 'triangle';
  pulse.frequency.value = profile.pulse;
  pulseGain.gain.value = 0.015;
  pulse.connect(pulseGain);
  pulseGain.connect(gain);
  pulse.start();
  nodes.push(pulse, pulseGain);

  const noise = context.createBufferSource();
  const noiseFilter = context.createBiquadFilter();
  const noiseGain = context.createGain();
  noise.buffer = createNoiseBuffer(context);
  noise.loop = true;
  noiseFilter.type = type === 'exploration' || type === 'tavern' ? 'bandpass' : 'lowpass';
  noiseFilter.frequency.value = type === 'exploration' ? 900 : type === 'tavern' ? 650 : 180;
  noiseGain.gain.value = profile.noise;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(gain);
  noise.start();
  nodes.push(noise, noiseFilter, noiseGain);

  const timer = window.setInterval(() => {
    const now = context.currentTime;
    pulseGain.gain.cancelScheduledValues(now);
    pulseGain.gain.setValueAtTime(pulseGain.gain.value, now);
    pulseGain.gain.linearRampToValueAtTime(type === 'combat' || type === 'boss_fight' ? 0.05 : 0.025, now + 0.15);
    pulseGain.gain.linearRampToValueAtTime(0.01, now + 0.8);
  }, type === 'combat' || type === 'boss_fight' ? 900 : 2200);
  timers.push(timer);

  return { context, gain, nodes, timers };
}

function stopAmbient(rig: AudioRig | null) {
  if (!rig) return;
  rig.timers.forEach((timer) => window.clearInterval(timer));
  const now = rig.context.currentTime;
  rig.gain.gain.cancelScheduledValues(now);
  rig.gain.gain.linearRampToValueAtTime(0, now + 0.12);
  window.setTimeout(() => {
    rig.nodes.forEach((node) => {
      if ('stop' in node && typeof node.stop === 'function') {
        try {
          node.stop();
        } catch {
          // Node may already be stopped.
        }
      }
      node.disconnect();
    });
    void rig.context.close();
  }, 180);
}

export function AmbientAudio({ type = 'none' }: Props) {
  const [active, setActive] = useState<AmbientType>(type);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const rigRef = useRef<AudioRig | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem('partyquest-ambient-volume');
    if (saved) setVolume(Number(saved));
  }, []);

  useEffect(() => {
    if (type && type !== 'none') {
      setActive(type);
    }
  }, [type]);

  useEffect(() => {
    window.localStorage.setItem('partyquest-ambient-volume', String(volume));
    if (rigRef.current) rigRef.current.gain.gain.value = volume * 0.12;
  }, [volume]);

  useEffect(() => {
    stopAmbient(rigRef.current);
    rigRef.current = null;

    if (isPlaying && active !== 'none' && volume > 0) {
      rigRef.current = startAmbient(active, volume);
    }

    return () => {
      stopAmbient(rigRef.current);
      rigRef.current = null;
    };
  }, [active, isPlaying, volume]);

  if (active === 'none') return null;

  const profile = profiles[active];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-full border border-zinc-300 bg-white/95 px-4 py-2 text-xs text-zinc-800 shadow-lg backdrop-blur-sm transition-all hover:scale-105 dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-100">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="rounded border border-zinc-200 px-2 py-1 font-semibold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          aria-label={isPlaying ? 'Pause ambient audio' : 'Play ambient audio'}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span aria-hidden>{profile.icon}</span>
            <span className="font-medium">{profile.label}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(parseFloat(event.target.value))}
            className="mt-1 h-1 w-24 accent-zinc-800 dark:accent-zinc-200"
            aria-label="Ambient volume"
          />
        </div>
      </div>
      {isPlaying && (
        <span className="rounded-full bg-zinc-900/10 px-2 text-[10px] text-zinc-500 dark:bg-zinc-100/10 dark:text-zinc-400">
          Live ambience
        </span>
      )}
    </div>
  );
}
