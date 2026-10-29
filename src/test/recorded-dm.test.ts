import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RECORDED_DM_CLIPS,suggestRecordedDmCues} from '../lib/voice/recorded-dm';

describe('owned prerecorded ElevenLabs lines',()=>{
  it('makes all 20 exact recorded takes available without new synthesis',()=>{
    expect(RECORDED_DM_CLIPS).toHaveLength(20);
    expect(new Set(RECORDED_DM_CLIPS.map(c=>c.id)).size).toBe(20);
    for(let i=81;i<=100;i++){
      const id='VO'+String(i).padStart(3,'0');
      const clip=RECORDED_DM_CLIPS.find(c=>c.id===id);
      expect(clip?.text.length).toBeGreaterThan(20);
      const source=readFileSync(id+'.mp3');
      const deployed=readFileSync('public/voice/'+id+'.mp3');
      expect(deployed.equals(source)).toBe(true);
      expect(source.length).toBe(clip?.bytes);
      expect(createHash('sha256').update(source).digest('hex')).toBe(clip?.sha256);
    }
  });
  it('only suggests outcome cues when an actual engine result supports them',()=>{
    const base={adventureId:'brindlehook-inn',sceneId:'social',turnCount:0,characterClass:'Fighter',combatActive:false,lowHealth:false,pendingRoll:false,engineResults:[]};
    expect(suggestRecordedDmCues(base)).toEqual(['VO081','VO082','VO085']);
    expect(suggestRecordedDmCues({...base,engineResults:[{kind:'skill_check',ok:false}],turnCount:1})).toContain('VO091');
    expect(suggestRecordedDmCues({...base,engineResults:[{kind:'skill_check',ok:true}],turnCount:1})).toContain('VO090');
    for(const id of ['VO095','VO096','VO097','VO098','VO099','VO100'])expect(suggestRecordedDmCues({...base,sceneId:'ending'})).not.toContain(id);
  });
});
