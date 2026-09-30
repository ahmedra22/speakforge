const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizeUnit(source, { levelId, bookId, sourceFile, audio }) {
  const id = `${bookId}:unit:${source.unit_number}`;
  const paragraphAudio = Array.isArray(source.paragraph_audio)
    ? source.paragraph_audio.map((path, index) => ({ paragraphIndex: index, path, mediaType: 'audio/mpeg' }))
    : undefined;
  return {
    kind: 'unit',
    id,
    bookId,
    levelId,
    number: source.unit_number,
    title: source.unit_title,
    topic: source.topic,
    passage: { paragraphs: [...source.passage], ...(paragraphAudio ? { paragraphAudio } : {}) },
    vocabulary: source.vocabulary.map((item, index) => ({
      id: `${id}:vocabulary:${slug(item.word)}:${index + 1}`,
      word: item.word,
      partOfSpeech: item.part_of_speech,
      meaningInContext: item.meaning_in_context,
      example: item.example,
    })),
    speakingPrompts: source.speaking_prompts.map((text, index) => ({ id: `${id}:prompt:${index + 1}`, text })),
    ...(source.grammar_focus == null ? {} : {
      grammar: {
        title: source.grammar_focus.title,
        explanation: source.grammar_focus.explanation,
        examples: [...source.grammar_focus.examples],
        practiceTask: source.grammar_focus.practice_task,
      },
    }),
    ...(audio ? { audio: { path: audio, mediaType: 'audio/mpeg' } } : {}),
    ...(source.audio_timing ? { audioTiming: source.audio_timing } : {}),
    learningMetadata: { sourceLevelLabel: source.level, sourceFile },
  };
}
