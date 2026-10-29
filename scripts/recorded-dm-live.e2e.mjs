/** Real production player acceptance for the 20 existing original MP3s.
 * This uses only the deterministic /api/session/start bootstrap. It never
 * calls /api/turn or an LLM provider, and never purchases/generates voice.
 */
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const origin=process.env.DM_AUDIO_TEST_ORIGIN||'https://ai-dungeon-master-azure.vercel.app';
const ids=Array.from({length:20},(_,i)=>'VO'+String(i+81).padStart(3,'0'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[];
try {
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',err=>failures.push(err.message));
  await page.addInitScript(()=>{
   window.__originalDmAudio=[];
   window.__nativeSpeech=0;
   const Original=window.Audio;
   window.Audio=function(...args){const a=new Original(...args);window.__originalDmAudio.push(a);return a;};
   if(window.speechSynthesis)window.speechSynthesis.speak=()=>{window.__nativeSpeech++;};
  });
  try {
   await page.goto(origin+'/start',{waitUntil:'domcontentloaded',timeout:60000});
   const begin=page.getByRole('button',{name:/begin quest/i});
   await begin.waitFor({state:'visible',timeout:40000});
   await begin.click();
   await page.waitForURL(/\/play/, {timeout:45000});
   await page.getByLabel('Player action').waitFor({state:'visible',timeout:35000});
   // This is an opt-in player; it must not autoplay anything.
   const details=page.locator('details[data-source="original-elevenlabs-recording"]');
   await details.waitFor({state:'attached',timeout:20000});
   assert.equal(await page.evaluate(()=>window.__originalDmAudio.some(a=>a.src.includes('/voice/'))),false,'Do not speak before opt-in');
   await details.locator('summary').first().click();
   const enable=details.getByRole('checkbox',{name:/enable recordings/i});
   assert.equal(await enable.isChecked(),false,'New game recordings default off');
   await enable.check();
   await details.getByText('Browse all 20 original recordings',{exact:true}).click();
   for(const id of ids){
    const button=details.getByRole('button',{name:new RegExp('^'+id+' \\u00b7')});
    await button.waitFor({state:'visible',timeout:12000});
    await button.click();
    await page.waitForFunction(id=>{
      const found=window.__originalDmAudio.find(a=>a.currentSrc.endsWith('/voice/'+id+'.mp3'));
      return !!found && found.currentTime>0.10 && found.readyState>=2 && !found.error && !found.paused && found.volume>0 && found.duration>0;
    },id,{timeout:22000,polling:250});
    const captions=await details.locator('[role="status"]').allInnerTexts();
    assert.ok(captions.some(t=>t.includes(id.slice(2))||t.length>40),'A visible caption must accompany '+id);
    assert.equal(await page.evaluate(()=>window.__nativeSpeech),0,'No substituted device voice');
    await details.getByRole('button',{name:'Stop recorded voice'}).click();
    const paused=await page.evaluate(()=>window.__originalDmAudio.at(-1)?.paused);
    assert.equal(paused,true,'Stop must pause actual '+id);
    console.log('PASS Original Dungeon Master',viewport.width,id);
   }
   await enable.uncheck();
   assert.equal(await page.evaluate(()=>window.__originalDmAudio.some(a=>!a.paused && a.src.includes('/voice/'))),false,'Muted player must remain stopped');
   console.log('PASS DM viewport',viewport.width+'x'+viewport.height,'20 original clips and no paid TTS');
  } finally {await context.close();}
 }
 assert.deepEqual(failures,[],'No browser page exceptions');
 console.log('PASS 40 original DM MP3 play/stop/caption tests at the real public production origin');
} finally {await browser.close();}
