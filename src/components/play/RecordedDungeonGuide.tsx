'use client';

import {useEffect,useRef,useState} from 'react';
import {RECORDED_DM_CLIPS,suggestRecordedDmCues,type DmCueContext} from '@/lib/voice/recorded-dm';

export function RecordedDungeonGuide(context: DmCueContext) {
  const [enabled,setEnabled]=useState(false);
  const [volume,setVolume]=useState(0.7);
  const [current,setCurrent]=useState<string|null>(null);
  const [status,setStatus]=useState('');
  const audio=useRef<HTMLAudioElement|null>(null);
  const generation=useRef(0);
  const stop=()=>{
    generation.current++;
    if(audio.current){audio.current.pause();audio.current.onended=null;audio.current.onerror=null;audio.current.removeAttribute('src');audio.current=null;}
    setCurrent(null);
  };
  useEffect(()=>()=>{generation.current++;audio.current?.pause();audio.current=null},[]);
  // Stop whenever the user disables speech; never change game logic.
  useEffect(()=>{if(!enabled){generation.current++;audio.current?.pause();audio.current=null;setCurrent(null)}},[enabled]);
  const play=(id:string)=>{
    const clip=RECORDED_DM_CLIPS.find(entry=>entry.id===id);
    if(!enabled||!clip)return;
    stop();
    const token=++generation.current;
    setStatus('');
    const item=new Audio('/voice/'+clip.id+'.mp3');
    item.preload='none';
    item.volume=volume;
    item.onerror=()=>{if(token===generation.current){stop();setStatus('Recording unavailable. No replacement voice was generated.')}};
    item.onended=()=>{if(token===generation.current){stop();setStatus('Recording finished.')}};
    audio.current=item;
    setCurrent(id);
    void item.play().catch(()=>{if(token===generation.current){stop();setStatus('Audio could not start. Tap Play again.')}});
  };
  useEffect(()=>{if(audio.current)audio.current.volume=volume},[volume]);
  const suggested=new Set(suggestRecordedDmCues(context));
  const recent=RECORDED_DM_CLIPS.filter(clip=>suggested.has(clip.id));
  return <details className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900" data-source="original-elevenlabs-recording">
    <summary className="cursor-pointer font-medium">Recorded Dungeon Master — 20 original voice lines</summary>
    <div className="mt-2 space-y-2">
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);if(!e.target.checked)stop();}}/>Enable recordings (off by default)</label>
      <label className="flex items-center gap-2">Volume <input type="range" aria-label="Recorded voice volume" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
      {recent.length>0&&<section aria-label="Suggested recordings for current game"><p className="font-semibold">Relevant to your current adventure</p>
        <div className="mt-1 flex flex-wrap gap-1">{recent.map(clip=><button key={clip.id} type="button" disabled={!enabled} className="rounded border px-2 py-1 disabled:opacity-40" onClick={()=>play(clip.id)}>{clip.label}</button>)}</div>
      </section>}
      <details><summary className="cursor-pointer">Browse all 20 original recordings</summary>
        <div className="mt-1 grid max-h-36 grid-cols-2 gap-1 overflow-y-auto">{RECORDED_DM_CLIPS.map(clip=><button key={clip.id} type="button" disabled={!enabled} className="rounded border px-2 py-1 text-left disabled:opacity-40" onClick={()=>play(clip.id)}>{clip.id} · {clip.label}</button>)}</div>
      </details>
      {current&&<div role="status" aria-live="polite"><p><strong>{RECORDED_DM_CLIPS.find(c=>c.id===current)?.label}</strong></p><p>{RECORDED_DM_CLIPS.find(c=>c.id===current)?.text}</p>
        <button className="mt-1 rounded border px-2 py-1" type="button" onClick={()=>{stop();setStatus('Stopped.')}}>Stop recorded voice</button></div>}
      {status&&<p role="status" aria-live="polite">{status}</p>}
      <p className="text-zinc-500">Only prerecorded MP3s. No ElevenLabs API calls or credits used during play. Other story narration remains text.</p>
    </div>
  </details>;
}
