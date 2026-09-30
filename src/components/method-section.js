import { escapeHtml } from '../app/html.js';

const method = {
  en: {
    language: 'English', label: 'How SpeakForge works',
    title: 'A simple path from listening to confident use',
    steps: ['Listen', 'Shadow', 'Read', 'Build Active Vocabulary', 'Speak', 'Review'],
    description: 'Move through each step at your own pace. Repeat listening, then use the passage, vocabulary, speaking prompts, and reviews to practice what you learned.'
  },
  ar: {
    language: 'العربية', label: 'طريقة SpeakForge',
    title: 'خطوات بسيطة من الاستماع إلى الاستخدام بثقة',
    steps: ['استمع', 'ردّد مع المتحدث', 'اقرأ', 'ابنِ مفردات نشطة', 'تحدّث', 'راجع'],
    description: 'تقدّم في كل خطوة حسب وتيرتك. كرّر الاستماع، ثم استخدم النص والمفردات وأسئلة التحدث والمراجعات للتدرّب على ما تعلمته.'
  }
};

export function renderMethodSection() {
  return `<section class="method-section" data-method-section aria-labelledby="method-title">
    <header class="method-heading"><p class="eyebrow">${escapeHtml(method.en.label)}</p><h2 id="method-title">${escapeHtml(method.en.title)}</h2>
      <div class="method-language" role="group" aria-label="Method language">
        <button type="button" data-method-language="en" aria-pressed="true">${escapeHtml(method.en.language)}</button>
        <button type="button" data-method-language="ar" aria-pressed="false">${escapeHtml(method.ar.language)}</button>
      </div>
    </header>
    <div data-method-content="en" lang="en"><ol class="method-steps" aria-label="Listen, Shadow, Read, Build Active Vocabulary, Speak, Review">${method.en.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol><p>${escapeHtml(method.en.description)}</p></div>
    <div data-method-content="ar" lang="ar" dir="rtl" hidden><h2>${escapeHtml(method.ar.title)}</h2><ol class="method-steps" aria-label="${escapeHtml(method.ar.steps.join('، '))}">${method.ar.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol><p>${escapeHtml(method.ar.description)}</p></div>
  </section>`;
}
