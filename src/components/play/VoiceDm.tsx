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

export function VoiceDm({ narration, busy, onDictate, onSend }: {
  narration: { text: string } | null;
  busy: boolean;
  onDictate: (text: string) => void;
  onSend: (text: string) => void;
}) {
  const [voice, setVoice] = useState('rowan');
  const [passcode, setPasscode] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const browserSpeech = useRef<SpeechSynthesisUtterance | null>(null);
  const [browserSpeaking, setBrowserSpeaking] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const mic = useRef<Recognition | null>(null);

  useEffect(() => () => {
    if (browserSpeech.current) window.speechSynthesis.cancel();
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
    setLoading(true);
    setStatus('Preparing narration…');
    void (async () => {
      try {
        const response = await fetch('/api/voice-narration', {
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
        if (!request.signal.aborted) setStatus(error instanceof TypeError
          ? 'Could not connect to Natter. Press Play narration to retry.'
          : error instanceof Error ? error.message : 'Voice unavailable.');
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      request.abort();
      player.pause();
      player.removeAttribute('src');
      if (url) URL.revokeObjectURL(url);
    };
  }, [enabled, narration, passcode, voice, retry]);

  function readWithBrowser() {
    if (!narration?.text.trim()) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setStatus('This browser does not support local narration.');
      return;
    }
    if (browserSpeech.current) {
      browserSpeech.current = null;
      window.speechSynthesis.cancel();
      setBrowserSpeaking(false);
      setStatus('Browser narration stopped.');
      return;
    }
    audio.current?.pause();
    const line = new SpeechSynthesisUtterance(narration.text);
    line.lang = 'en-AU';
    browserSpeech.current = line;
    const finish = (message: string) => {
      if (browserSpeech.current !== line) return;
      browserSpeech.current = null;
      setBrowserSpeaking(false);
      setStatus(message);
    };
    line.onend = () => finish('Browser narration finished.');
    line.onerror = () => finish('Your browser could not play its narration voice.');
    setBrowserSpeaking(true);
    setStatus('Reading with your browser voice.');
    window.speechSynthesis.speak(line);
  }

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
    let transcript = '';
    let failed = false;
    recognition.onresult = (event) => {
      transcript = Array.from(event.results, (result) => result[0].transcript).join(' ').trim();
    };
    recognition.onerror = () => {
      failed = true;
      setStatus('Could not hear your action. Try again or type it.');
    };
    recognition.onend = () => {
      mic.current = null;
      setListening(false);
      if (failed) return;
      if (!transcript) {
        setStatus('No speech detected.');
      } else if (autoSend) {
        onSend(transcript);
        setStatus('Spoken action sent.');
      } else {
        onDictate(transcript);
        setStatus('Check the transcript, then send your action.');
      }
    };
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
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={autoSend} disabled={listening} onChange={(event) => setAutoSend(event.target.checked)} /> Auto-send
        </label>
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
        {narration && <button type="button" disabled={loading} onClick={readWithBrowser} className="rounded border px-2 py-1">
          {browserSpeaking ? 'Stop browser narration' : 'Read with browser voice'}
        </button>}
        {enabled && narration && <button type="button" disabled={loading} onClick={() => {
          const player = audio.current;
          if (!player?.getAttribute('src')) {
            setRetry((count) => count + 1);
            return;
          }
          if (browserSpeech.current) readWithBrowser();
          if (player.paused) void player.play().catch(() => setStatus('Could not play narration.'));
          else player.pause();
        }} className="rounded border px-2 py-1">{playing ? 'Pause narration' : 'Play narration'}</button>}
      </div>
      <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <p role="status">{status}</p>
    </details>
  );
}
