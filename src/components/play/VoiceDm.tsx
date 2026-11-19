'use client';

import { useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function VoiceDm({ narration, busy, onDictate }: {
  narration: { text: string } | null;
  busy: boolean;
  onDictate: (text: string) => void;
}) {
  const [voice, setVoice] = useState('rowan');
  const [passcode, setPasscode] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const mic = useRef<Recognition | null>(null);

  useEffect(() => () => {
    if (mic.current) {
      mic.current.onend = mic.current.onerror = mic.current.onresult = null;
      mic.current.abort();
    }
  }, []);

  useEffect(() => {
    const player = audio.current;
    if (!enabled || !narration?.text.trim() || !player) return;
    const request = new AbortController();
    let url: string | undefined;
    setStatus('Preparing narration…');
    void (async () => {
      try {
        const response = await fetch('https://natter-two.vercel.app/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice, passcode, narration: narration.text.slice(0, 2000) }),
          signal: request.signal,
        });
        if (!response.ok) throw new Error(response.status === 401
          ? 'Check your Natter passcode.' : 'Voice unavailable. The turn is saved in AI DM.');
        const clip = await response.blob();
        if (request.signal.aborted) return;
        url = URL.createObjectURL(clip);
        player.src = url;
        setStatus('Narration ready.');
        await player.play().catch(() => {
          if (!request.signal.aborted) setStatus('Press Play narration to listen.');
        });
      } catch (error) {
        if (!request.signal.aborted) setStatus(error instanceof Error ? error.message : 'Voice unavailable.');
      }
    })();
    return () => {
      request.abort();
      player.pause();
      player.removeAttribute('src');
      if (url) URL.revokeObjectURL(url);
    };
  }, [enabled, narration, passcode, voice]);

  function dictate() {
    if (mic.current) return mic.current.stop();
    const browser = window as RecognitionWindow;
    const Speech = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Speech) {
      setStatus('Dictation is unavailable in this browser. You can still type your action.');
      return;
    }
    const recognition = new Speech();
    recognition.lang = 'en-AU';
    recognition.onresult = (event) => {
      const text = Array.from(event.results, (result) => result[0].transcript).join(' ').trim();
      if (text) {
        onDictate(text);
        setStatus('Check the transcript, then send your action.');
      }
    };
    recognition.onerror = () => setStatus('Could not hear your action. Try again or type it.');
    recognition.onend = () => { mic.current = null; setListening(false); };
    try {
      recognition.start();
      mic.current = recognition;
      setListening(true);
      setStatus('Listening…');
    } catch {
      setStatus('Could not start dictation.');
    }
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold">Voice DM</summary>
      <div className="flex flex-wrap items-center gap-2 py-2">
        <button type="button" disabled={busy && !listening} onClick={dictate} className="rounded border px-2 py-1">
          {listening ? 'Finish speaking' : 'Speak action'}
        </button>
        <label>Voice <select value={voice} onChange={(event) => setVoice(event.target.value)} className="rounded border px-2 py-1">
          <option value="rowan">Rowan</option><option value="ella">Ella</option>
        </select></label>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => {
          event.preventDefault();
          if (enabled) {
            setEnabled(false);
            setPasscode('');
            setStatus('Narration off.');
            return;
          }
          const secret = new FormData(event.currentTarget).get('passcode');
          if (typeof secret !== 'string' || !secret.trim()) return;
          event.currentTarget.reset();
          setPasscode(secret);
          setEnabled(true);
          setStatus('Narration on.');
        }}>
          {!enabled && <input name="passcode" aria-label="Natter passcode" placeholder="Natter passcode" type="password" required className="w-36 rounded border px-2 py-1" />}
          <button className="rounded border px-2 py-1">{enabled ? 'Turn narration off' : 'Enable narration'}</button>
        </form>
        {enabled && narration && <button type="button" onClick={() => {
          const player = audio.current;
          if (!player?.getAttribute('src')) return;
          if (player.paused) void player.play().catch(() => setStatus('Could not play narration.'));
          else player.pause();
        }} className="rounded border px-2 py-1">{playing ? 'Pause narration' : 'Play narration'}</button>}
      </div>
      <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <p role="status">{status}</p>
    </details>
  );
}
