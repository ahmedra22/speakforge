import { createAudioPreferences } from '/audio-preferences.js';
import { mountAudioPlayer } from '/audio-player.js';
const toggle=document.querySelector('.nav-toggle');const nav=document.querySelector('#primary-navigation');toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));nav?.classList.toggle('is-open',!open);});nav?.addEventListener('click',(event)=>{if(event.target.closest('a')){nav.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false');}});
const preferences=createAudioPreferences();for(const root of document.querySelectorAll('[data-audio-player]'))mountAudioPlayer(root,{preferences});
