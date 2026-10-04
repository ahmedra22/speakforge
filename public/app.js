import { createListeningProgressStore } from '/listening-progress.js';
import { deriveSequenceProgress, deriveLevelProgress, deriveUnitCompletion, completeUnit } from '/progression.js';
import { createSupabaseAuth, createProgressSync } from '/progress-sync.js';
const toggle=document.querySelector('.nav-toggle'),nav=document.querySelector('#primary-navigation');toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));nav?.classList.toggle('is-open',!open);});nav?.addEventListener('click',event=>{if(event.target.closest('a')){nav.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false');}});
const progressStore=createListeningProgressStore(),contextCache=new Map();
const authButton=document.querySelector("[data-auth-button]"),authStatus=document.querySelector("[data-auth-status]");
function renderAuthState({status,message,user}){if(!authButton||!authStatus)return;authButton.textContent=user?"Sign out":"Continue with Google";authButton.hidden=status==="unconfigured";authButton.disabled=status==="loading"||status==="syncing";authStatus.textContent=message||(status==="loading"?"Checking sign-in…":status==="syncing"?"Syncing your progress…":user?`Signed in as ${user.email||"Google account"}`:status==="unconfigured"?"Progress saved on this device":"Progress saved on this device");}
let progressSync;
let resolveAuthReady;
const authReady=new Promise(resolve=>{resolveAuthReady=resolve;});
function syncLearningAuthGate(){
  const page=document.querySelector("[data-learning-auth-page]");
  if(!page)return;
  const gate=page.querySelector("[data-learning-auth-gate]");
  const content=page.querySelector("[data-learning-auth-content]");
  const signedIn=Boolean(progressSync?.getUserId());
  if(gate)gate.hidden=signedIn;
  if(content)content.hidden=!signedIn;
}
renderAuthState({status:"loading"});
document.querySelector("[data-auth-control]")?.addEventListener("submit",async event=>{
  if(!progressSync?.getUserId())return;
  event.preventDefault();
  authButton.disabled=true;
  try{await progressSync.signOut();syncLearningAuthGate();}
  catch(error){renderAuthState({status:"error",message:error.message});authButton.disabled=false;}
});
document.addEventListener("click",event=>{
  const link=event.target.closest("[data-learning-entry]");
  if(!link||event.defaultPrevented)return;
  event.preventDefault();
  void authReady.then(()=>{
    const href=new URL(link.getAttribute("href"),location.origin);
    const destination=`${href.pathname}${href.search}`;
    if(progressSync?.getUserId()){location.assign(destination);return;}
    location.assign(`/api/auth/google?next=${encodeURIComponent(destination)}`);
  }).catch(()=>{location.assign(link.href);});
});
async function initializeCloudProgress(){
  const cloudAuthConfig=await fetch("/api/config").then(r=>r.ok?r.json():{}).catch(()=>({}));
  const auth=createSupabaseAuth({url:cloudAuthConfig.supabaseUrl,anonKey:cloudAuthConfig.supabaseAnonKey});
  progressSync=createProgressSync({store:progressStore,auth,onState:state=>{renderAuthState(state);syncLearningAuthGate();}});
  try{await progressSync.start();}finally{syncLearningAuthGate();resolveAuthReady();}
}
const runWhenIdle=fn=>{if(typeof window.requestIdleCallback==="function")window.requestIdleCallback(fn,{timeout:800});else window.setTimeout(fn,50);};
runWhenIdle(()=>void initializeCloudProgress().catch(()=>renderAuthState({status:"error",message:"Cloud progress is unavailable. Local progress remains saved."})));
const getBookContext=id=>{if(!contextCache.has(id))contextCache.set(id,fetch(`/api/books/${encodeURIComponent(id)}/learning-sequence`).then(response=>response.ok?response.json():null));return contextCache.get(id);};
function updateResume(){const saved=progressStore.getLastVisited();for(const slot of document.querySelectorAll('[data-resume-learning]')){slot.replaceChildren();if(!saved?.href||!saved.href.startsWith('/learn/')){slot.hidden=true;continue;}const p=document.createElement('p');p.className='eyebrow';p.textContent='Pick up where you left off';const title=document.createElement('strong');title.textContent=saved.title||'Your last learning item';const link=document.createElement('a');link.className='button button-primary';link.href=saved.href;link.dataset.learningEntry='true';link.textContent='Resume Learning';slot.append(p,title,link);slot.hidden=false;}}
function rememberVisits(){for(const node of document.querySelectorAll('[data-visit-location]'))progressStore.setLastVisited({levelId:node.dataset.levelId,bookId:node.dataset.bookId,itemId:node.dataset.itemId,itemType:node.dataset.itemType,href:node.dataset.visitHref,title:node.dataset.visitTitle});updateResume();}
function setItemState(node,status){node.dataset.status=status;const badge=node.querySelector('[data-item-status]');if(badge){badge.textContent=status.replace('-',' ').toUpperCase();badge.className=`status status-${status}`;}const link=node.querySelector('a');if(link){const locked=status==='locked' && node.dataset.itemKind==='review';link.setAttribute('aria-disabled',String(locked));link.tabIndex=locked?-1:0;if(!link.dataset.lockGuard){link.dataset.lockGuard='true';link.addEventListener('click',event=>{if(link.getAttribute('aria-disabled')==='true'){event.preventDefault();}});}}}
async function syncBook(root){const id=root.dataset.bookId,context=await getBookContext(id);if(!context)return null;const result=deriveSequenceProgress(context.sequence,context.units,progressStore,{lastVisitedId:progressStore.getLastVisited()?.itemId});for(const item of result.sequence){const node=[...root.querySelectorAll('[data-progress-item]')].find(entry=>entry.dataset.itemId===item.id);if(node)setItemState(node,item.status);}const count=root.querySelector('[data-book-progress-count]'),percent=root.querySelector('[data-book-progress-percent]'),bar=root.querySelector('[data-book-progress-bar]'),track=bar?.parentElement,next=root.querySelector('[data-book-next-item]');if(count)count.textContent=`${result.completedUnits}/${result.totalUnits}`;if(percent)percent.textContent=`${result.percent}%`;if(bar)bar.style.width=`${result.percent}%`;if(track){track.setAttribute('aria-valuemax',String(result.totalUnits));track.setAttribute('aria-valuenow',String(result.completedUnits));}if(next)next.textContent=result.nextItem?`Next: ${result.nextItem.title}`:'All units complete';return{context,result};}
async function syncLevel(root){const response=await fetch(`/api/levels/${encodeURIComponent(root.dataset.levelId)}/progress-context`);if(!response.ok)return;const data=await response.json(),booksProgress=[];for(const item of data.books){const result=deriveSequenceProgress(item.sequence,item.units,progressStore,{lastVisitedId:progressStore.getLastVisited()?.itemId});booksProgress.push(result);const group=[...document.querySelectorAll('[data-book-learning]')].find(node=>node.dataset.bookId===item.book.id);if(group){for(const sequenceItem of result.sequence){const node=[...group.querySelectorAll('[data-progress-item]')].find(entry=>entry.dataset.itemId===sequenceItem.id);if(node)setItemState(node,sequenceItem.status);}const count=group.querySelector('[data-book-progress-count]'),percent=group.querySelector('[data-book-progress-percent]'),bar=group.querySelector('[data-book-progress-bar]'),track=bar?.parentElement;if(count)count.textContent=`${result.completedUnits}/${result.totalUnits}`;if(percent)percent.textContent=`${result.percent}%`;if(bar)bar.style.width=`${result.percent}%`;if(track){track.setAttribute('aria-valuemax',String(result.totalUnits));track.setAttribute('aria-valuenow',String(result.completedUnits));}const next=group.querySelector('[data-book-next-item]');if(next)next.textContent=result.nextItem?`Next: ${result.nextItem.title}`:'All units complete';}}const aggregate=deriveLevelProgress(booksProgress),count=root.querySelector('[data-level-progress-count]'),percent=root.querySelector('[data-level-progress-percent]'),bar=root.querySelector('[data-level-progress-bar]'),track=bar?.parentElement;if(count)count.textContent=`${aggregate.completedUnits}/${aggregate.totalUnits}`;if(percent)percent.textContent=`${aggregate.percent}%`;if(bar)bar.style.width=`${aggregate.percent}%`;if(track){track.setAttribute('aria-valuemax',String(aggregate.totalUnits));track.setAttribute('aria-valuenow',String(aggregate.completedUnits));}}
async function syncUnit(page){const id=page.dataset.unitId,bookId=page.dataset.bookId,context=await getBookContext(bookId);if(!context)return;const item=context.units.find(unit=>unit.id===id);if(!item)return;const aiRequired=page.dataset.aiPracticeRequired==='true';const result=deriveSequenceProgress(context.sequence,context.units,progressStore,{lastVisitedId:progressStore.getLastVisited()?.itemId}),sequenceItem=result.sequence.find(entry=>entry.id===id),completion=deriveUnitCompletion(item,progressStore,{requireAiPractice:aiRequired}),button=page.querySelector('[data-complete-unit]'),stateNode=page.querySelector('[data-unit-completion-state]'),list=page.querySelector('[data-completion-conditions]');const conditions=[['passageUnlocked','Passage unlocked after listening'],['vocabularyMastered',`Vocabulary mastered (${completion.masteredVocabulary}/${completion.totalVocabulary})`],['speakingCompleted',`Speaking prompts completed (${completion.completedSpeaking}/${completion.totalSpeaking})`],['grammarCompleted','Grammar practice completed']];if(aiRequired)conditions.push(['aiPracticeCompleted','AI Practice completed']);list.replaceChildren(...conditions.map(([key,label])=>{const li=document.createElement('li');li.textContent=`${completion.conditions[key]?'✓':'○'} ${label}`;li.setAttribute('aria-label',`${label}: ${completion.conditions[key]?'complete':'not complete'}`);return li;}));const completed=Boolean(progressStore.get(id).completed);button.disabled=!completion.completed||completed||sequenceItem?.status==='locked';button.textContent=completed?'Unit completed':'Complete Unit';stateNode.textContent=sequenceItem?.status==='locked'?'This unit is locked until the previous learning item is completed.':completed?'Unit completed.':completion.completed?'All learning requirements are complete. You can complete this unit.':'Complete the listed learning activities to finish this unit.';if(!button.dataset.bound){button.dataset.bound='true';button.addEventListener('click',()=>{const current=deriveUnitCompletion(item,progressStore,{requireAiPractice:page.dataset.aiPracticeRequired==='true'});const latest=deriveSequenceProgress(context.sequence,context.units,progressStore).sequence.find(entry=>entry.id===id);if(current.completed&&latest?.status!=='locked')completeUnit(item,progressStore,result.sequence,{lastVisitedId:progressStore.getLastVisited()?.itemId,requireAiPractice:page.dataset.aiPracticeRequired==='true'});});}}
async function syncReview(root){const bookId=root.dataset.bookId,reviewId=root.dataset.reviewId,context=await getBookContext(bookId);if(!context)return;const result=deriveSequenceProgress(context.sequence,context.units,progressStore),entry=result.sequence.find(item=>item.id===reviewId),lock=root.querySelector('[data-review-lock]'),host=root.querySelector('[data-review-host]');if(!entry||entry.status==='locked'){lock.hidden=false;return;}lock.hidden=true;if(root.dataset.loaded)return;root.dataset.loaded='true';const response=await fetch(`/api/reviews/${encodeURIComponent(bookId)}/${root.dataset.reviewStart}/${root.dataset.reviewEnd}`);if(!response.ok){root.dataset.loaded='';lock.hidden=false;return;}const review=await response.json();host.hidden=false;const {mountReviewExperience}=await import('/review-experience.js?v=20261005');mountReviewExperience(root,{review,progressStore});}
function syncAll(){updateResume();for(const root of document.querySelectorAll('[data-book-learning]'))void syncBook(root);for(const root of document.querySelectorAll('[data-level-progress]'))void syncLevel(root);for(const page of document.querySelectorAll('.unit-player-page[data-unit-id]'))void syncUnit(page);for(const review of document.querySelectorAll('[data-review-page]'))void syncReview(review);}
rememberVisits();
async function mountUnitFeatures(){
const [{createAudioPreferences},{mountAudioPlayer},{createListenCompletionTracker},{mountPassageReader},{createSpeechService},{mountVocabularySection},{mountSpeakingSection},{mountGrammarSection},{mountAiPracticePanel}]=await Promise.all([import('/audio-preferences.js?v=20261005'),import('/audio-player.js?v=20261005'),import('/listen-completion.js?v=20261005'),import('/passage-reader.js?v=20261005'),import('/speech-service.js?v=20261005'),import('/vocabulary-section.js?v=20261005'),import('/speaking-section.js?v=20261005'),import('/grammar-section.js?v=20261005'),import('/ai-practice-panel.js?v=20261005')]);
const preferences=createAudioPreferences(),speech=createSpeechService();
for(const root of document.querySelectorAll('[data-audio-player]')){const page=root.closest('.unit-player-page'),store=page?progressStore:null,unitId=page?.dataset.unitId,status=page?.querySelector('[data-listening-status]'),lock=page?.querySelector('[data-passage-lock]'),host=page?.querySelector('[data-passage-host]');let player,loaded=false;const renderProgress=()=>{if(!store||!unitId)return;const p=store.get(unitId);status.textContent=p.passageUnlocked?`Reading passage unlocked · ${p.listensCompleted} listens completed`:`${p.listensCompleted} of ${p.requiredListens} listens completed. ${Math.max(0,p.requiredListens-p.listensCompleted)} more ${p.requiredListens-p.listensCompleted===1?'listen':'listens'} to unlock the reading passage.`;lock.hidden=p.passageUnlocked;};const showPassage=async()=>{if(loaded||!store.get(unitId).passageUnlocked)return;loaded=true;try{const response=await fetch(`/api/units/${encodeURIComponent(unitId)}/passage`);if(!response.ok)throw new Error('Passage unavailable');const unit=await response.json();mountPassageReader(host,{unit,audio:root.querySelector('audio'),controller:player?.controller});}catch{loaded=false;host.textContent='The passage could not be loaded. Refresh to try again.';}};const existing=store?.get(unitId);if(existing){renderProgress();if(existing.passageUnlocked)void showPassage();}const tracker=store?createListenCompletionTracker({onComplete:()=>{store.recordCompletedListen(unitId);renderProgress();syncAll();void showPassage();}}):null;player=mountAudioPlayer(root,{preferences,onPlaybackEvent:event=>tracker?.handle(event)});}
for(const page of document.querySelectorAll(".unit-player-page[data-unit-id]"))mountAiPracticePanel(page,{progressStore,speechService:speech});for(const root of document.querySelectorAll('[data-vocabulary-section]')){const page=root.closest('.unit-player-page');mountVocabularySection(root,{speechService:speech,progressStore,unitId:page?.dataset.unitId});}for(const root of document.querySelectorAll('[data-speaking-section]')){const page=root.closest('.unit-player-page');mountSpeakingSection(root,{unitId:page?.dataset.unitId,progressStore});}for(const root of document.querySelectorAll('[data-grammar-section]'))mountGrammarSection(root,{unitId:root.dataset.grammarUnit,progressStore});
}

const unitFeaturesNeeded=document.querySelector('.unit-player-page[data-unit-id], [data-audio-player], [data-vocabulary-section], [data-speaking-section], [data-grammar-section], [data-ai-practice-dialog]');
if(unitFeaturesNeeded)void mountUnitFeatures().catch(error=>console.error('SpeakForge unit features failed:',error));

progressStore.subscribe(()=>syncAll());
syncAll();

void authReady.then(async()=>{
  const dashboard=document.querySelector('[data-my-learning-dashboard]');
  if(!dashboard)return;
  const {mountDashboard}=await import('/dashboard.js?v=20261005');
  mountDashboard(dashboard,{progressStore});
});

for (const button of document.querySelectorAll('[data-print-unit]')) button.addEventListener('click', () => window.print());
for (const section of document.querySelectorAll('[data-method-section]')) {
  const buttons = [...section.querySelectorAll('[data-method-language]')];
  const panels = [...section.querySelectorAll('[data-method-content]')];
  for (const button of buttons) button.addEventListener('click', () => {
    const language = button.dataset.methodLanguage;
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    for (const panel of panels) panel.hidden = panel.dataset.methodContent !== language;
  });
}
