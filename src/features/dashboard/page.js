import {layout} from '../../components/layout.js';

export function myLearningPage(){
  const gate = `<section class="learning-auth-gate" data-learning-auth-gate><p class="eyebrow">Your learning dashboard</p><h1>Sign in to see your progress.</h1><p>Your units, reviews, and progress are linked to your Google account so you can continue across devices.</p><form method="get" action="/api/auth/google?next=%2Fmy-learning"><button class="auth-button" type="submit">Continue with Google</button></form></section>`;
  const learning = `<div data-learning-auth-content hidden><div class="page-container my-learning-page" data-my-learning-dashboard><header class="my-learning-header"><p class="eyebrow">My Learning</p><h1>Your progress, in one place.</h1><p>Continue where you left off, review your progress, and see what comes next.</p></header><section class="dashboard-loading" data-dashboard-loading aria-live="polite"><p class="eyebrow">Loading your progress</p><p>Getting your learning data…</p></section><div data-dashboard-content hidden></div></div></div>`;
  return layout({title:'My Learning',description:'Track your SpeakForge progress, continue learning, and see what comes next.',active:'my-learning',content:`<div data-learning-auth-page>${gate}${learning}</div>`});
}
