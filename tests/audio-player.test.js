import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createAudioController, formatAudioTime, handleAudioShortcut, isEditableTarget } from '../src/features/audio/audio-player.js';
import { createAudioPreferences } from '../src/features/audio/audio-preferences.js';
import { renderAudioPlayer } from '../src/components/audio-player.js';
import { contentLoader } from '../src/content/repository/content-loader.js';
import { createAppServer } from '../src/app/server.js';

class FakeAudio {
  constructor() { this.duration=20;this.currentTime=0;this.volume=1;this.muted=false;this.playbackRate=1;this.paused=true;this.ended=false;this.playCalls=0;this.listeners=new Map(); }
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type){for(const fn of this.listeners.get(type)??[])fn(new Event(type));}
  async play(){this.playCalls++;this.paused=false;this.ended=false;this.emit('play');}
  pause(){this.paused=true;this.emit('pause');}
  async finish(){this.paused=true;this.ended=true;for(const fn of this.listeners.get('ended')??[])await fn(new Event('ended'));}
}

const memoryStorage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};

test('AudioPlayer markup has accessible playback, timeline, volume, speed, and repeat controls',async()=>{
  const markup=renderAudioPlayer({audio:{path:'resources/audio/a2/A2 Unit 1.mp3'},label:'Unit 01 audio'});
  for(const part of ['<audio preload="metadata" playsinline','data-action="play"','aria-label="Seek in unit audio"','aria-label="Audio volume"','data-speed="0.75"','data-speed="1.5"','data-repeat="5"','Repeat from the beginning','aria-live="polite"'])assert.ok(markup.includes(part),`missing ${part}`);
  assert.match(renderAudioPlayer({audio:null}),/Audio unavailable for this unit/);const css=await readFile('public/styles.css','utf8');assert.ok(css.includes('@media(max-width:700px)'));assert.ok(css.includes('min-height:46px'));assert.ok(css.includes('@media(max-width:380px)'));
});

test('Play and pause update the audio state',async()=>{const audio=new FakeAudio(),controller=createAudioController({audio});assert.equal(controller.getState().status,'loading');await controller.play();assert.equal(controller.getState().status,'playing');controller.pause();assert.equal(controller.getState().status,'paused');});

test('all playback speeds set the native rate and persist by preference scope',async()=>{const audio=new FakeAudio(),storage=memoryStorage(),prefs=createAudioPreferences({storage,scope:'learner-7'}),controller=createAudioController({audio,preferences:prefs});for(const speed of [.75,1,1.25,1.5]){assert.equal(controller.setSpeed(speed),true);assert.equal(audio.playbackRate,speed);assert.equal(prefs.getSpeed(),speed);}await controller.play();audio.currentTime=4;controller.setSpeed(1.25);assert.equal(audio.playCalls,1);assert.equal(audio.currentTime,4);assert.equal(formatAudioTime(89.8),'1:29');});

test('metadata transitions the player to ready and volume/mute controls preserve the chosen volume',()=>{const audio=new FakeAudio(),controller=createAudioController({audio});audio.emit('loadedmetadata');assert.equal(controller.getState().status,'ready');assert.equal(controller.getState().duration,20);controller.setVolume(.35);assert.equal(audio.volume,.35);controller.toggleMute();assert.equal(audio.muted,true);assert.equal(controller.getState().muted,true);controller.toggleMute();assert.equal(audio.muted,false);assert.equal(audio.volume,.35);});
test('repeat 1, 2, 3, and 5 plays exactly the selected number of full times',async()=>{for(const count of [1,2,3,5]){const audio=new FakeAudio(),controller=createAudioController({audio});controller.setRepeat(count);await controller.play();for(let completed=1;completed<=count;completed++){await audio.finish();assert.equal(audio.playCalls,completed+ (completed<count?1:0),`repeat ${count}, completion ${completed}`);if(completed<count){assert.equal(audio.currentTime,0);assert.equal(controller.getState().status,'playing');}}assert.equal(controller.getState().status,'ended');}});

test('repeat from beginning immediately resets and resumes playback',async()=>{const audio=new FakeAudio(),controller=createAudioController({audio});audio.currentTime=14;await controller.repeatFromBeginning();assert.equal(audio.currentTime,0);assert.equal(audio.playCalls,1);assert.equal(controller.getState().status,'playing');});

test('seeking clamps to the actual media duration and updates time',()=>{const audio=new FakeAudio(),controller=createAudioController({audio});controller.seek(7.25);assert.equal(audio.currentTime,7.25);controller.seek(99);assert.equal(audio.currentTime,20);controller.seek(-4);assert.equal(audio.currentTime,0);});

test('keyboard shortcuts toggle and seek while protecting editable and interactive targets',async()=>{const audio=new FakeAudio(),controller=createAudioController({audio});const target={closest:()=>null};let prevented=0;const send=(code,closest=()=>null)=>handleAudioShortcut({code,target:{closest},preventDefault(){prevented++;}},controller);assert.equal(send('Space'),true);await new Promise(resolve=>setImmediate(resolve));assert.equal(controller.getState().status,'playing');audio.currentTime=8;assert.equal(send('ArrowLeft'),true);assert.equal(audio.currentTime,3);assert.equal(send('ArrowRight'),true);assert.equal(audio.currentTime,8);assert.equal(send('Space',()=>({tagName:'BUTTON'})),false);const editable={closest:()=>({tagName:'INPUT'})};assert.equal(isEditableTarget(editable),true);assert.equal(handleAudioShortcut({code:'Space',target:editable,preventDefault(){prevented++;}},controller),false);assert.equal(prevented,3);});

test('missing audio and playback failures become readable error states',async()=>{const missing=createAudioController({audio:null});assert.equal(missing.getState().status,'error');assert.match(missing.getState().error,/unavailable/);const audio=new FakeAudio(),controller=createAudioController({audio});audio.emit('error');assert.equal(controller.getState().status,'error');assert.match(controller.getState().error,/could not be loaded/);const blocked=new FakeAudio();blocked.play=()=>Promise.reject(new Error('blocked'));const rejected=createAudioController({audio:blocked});assert.equal(await rejected.play(),false);assert.equal(rejected.getState().status,'error');assert.match(rejected.getState().error,/blocked/);});

test('real A2, B1, and B1+ unit audio mappings resolve to MP3 files and support byte ranges',async(t)=>{const server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const origin=`http://127.0.0.1:${server.address().port}`;for(const bookId of ['a2-foundation','b1-core','b1-plus-bridge']){const unit=(await contentLoader.listUnits(bookId))[0];assert.equal(unit.audio.mediaType,'audio/mpeg');const info=await stat(unit.audio.path);assert.ok(info.size>10000);const response=await fetch(`${origin}/audio/${unit.audio.path.replace(/^resources\/audio\//,'')}`,{headers:{Range:'bytes=0-3'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal(response.headers.get('accept-ranges'),'bytes');assert.equal((await response.arrayBuffer()).byteLength,4);const page=await fetch(`${origin}/learn/${bookId==='a2-foundation'?'a2':bookId==='b1-core'?'b1-core':'b1plus-bridge'}/unit-01`);assert.equal(page.status,200);assert.ok((await page.text()).includes('/audio/'));}for(const route of ['/audio-player.js','/audio-preferences.js'])assert.equal((await fetch(origin+route)).status,200);const a2=await contentLoader.getUnit('a2-foundation:unit:1');const header=await readFile(a2.audio.path);assert.ok(header.subarray(0,3).toString()==='ID3'||header[0]===0xff,'mapped unit audio is a non-empty MP3 resource');});




