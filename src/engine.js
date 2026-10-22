import { profileById, profileOrder, questions } from './data.js';

export const STATE_KEY = 'emperor-match-state-v1';

export const createInitialState = () => ({
  version: 1,
  answers: {},
  currentQuestion: 1,
  completed: false,
  result: null,
});

export function setCurrentQuestion(state, questionNumber) {
  return {
    ...state,
    currentQuestion: Math.min(Math.max(Number(questionNumber) || 1, 1), questions.length),
  };
}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function parseStoredState(raw) {
  if (!raw) return createInitialState();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isPlainObject(parsed) || !isPlainObject(parsed.answers)) return createInitialState();
    const answers = Object.fromEntries(Object.entries(parsed.answers).filter(([questionId, optionId]) => (
      questions.some((question) => question.id === questionId)
      && questions.find((question) => question.id === questionId)?.options.some((option) => option.id === optionId)
    )));
    return {
      ...createInitialState(),
      answers,
      currentQuestion: Number.isInteger(parsed.currentQuestion) && parsed.currentQuestion >= 1 && parsed.currentQuestion <= questions.length ? parsed.currentQuestion : 1,
      completed: Boolean(parsed.completed),
      result: isPlainObject(parsed.result) ? parsed.result : null,
    };
  } catch {
    return createInitialState();
  }
}

export function getQuestionAnswer(questionList, questionId, optionId) {
  const question = questionList.find((item) => item.id === questionId);
  return question?.options.find((item) => item.id === optionId) ?? null;
}

export function scoreAnswers(answers = {}) {
  const scores = Object.fromEntries(profileOrder.map((id) => [id, { id, score: 0, matchCount: 0 }]));
  const evidence = [];

  for (const question of questions) {
    const optionId = answers?.[question.id];
    const selected = getQuestionAnswer(questions, question.id, optionId);
    if (!selected) continue;
    scores[selected.primary].score += Number.isFinite(selected.points) ? selected.points : 0;
    scores[selected.primary].matchCount += 1;
    if (selected.secondary && scores[selected.secondary]) {
      scores[selected.secondary].score += 1;
    }
    evidence.push({
      questionId: question.id,
      question: question.prompt,
      optionId: selected.id,
      answer: selected.text,
      primary: selected.primary,
      points: selected.points,
      secondary: selected.secondary ?? null,
    });
  }

  const ranked = profileOrder
    .map((id) => ({ ...profileById[id], ...scores[id] }))
    .sort((a, b) => b.score - a.score || b.matchCount - a.matchCount || profileOrder.indexOf(a.id) - profileOrder.indexOf(b.id));
  const winner = ranked[0];
  const runnerUp = ranked[1];

  return {
    winner,
    runnerUp,
    scores: ranked,
    evidence,
    answerCount: evidence.length,
  };
}

export function buildShareText(result) {
  if (!result?.winner) return '我刚完成了《你适合哪位帝王？》趣味测试。';
  return `我在《你适合哪位帝王？》趣味测试中，更接近「${result.winner.name}」：${result.winner.title}。18 道题完成了 ${result.answerCount} 题，${result.winner.shareLine}`;
}
