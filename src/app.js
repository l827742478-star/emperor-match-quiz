import { emperorProfiles, questions } from './data.js';
import {
  STATE_KEY,
  buildShareText,
  createInitialState,
  parseStoredState,
  setCurrentQuestion,
  scoreAnswers,
} from './engine.js';

const app = document.querySelector('#app');
const storage = {
  read() {
    try {
      return window.localStorage.getItem(STATE_KEY);
    } catch {
      return null;
    }
  },
  write(value) {
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(value));
    } catch {
      // A private browser context may disable storage; the in-memory state still works.
    }
  },
};

let state = parseStoredState(storage.read());

const icon = (name) => {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5m6 6-6-6 6-6"/>',
    copy: '<rect x="9" y="9" width="10" height="10" rx="1"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    seal: '<circle cx="12" cy="12" r="8.5"/><path d="m8 15 8-6M8 9l8 6"/>',
  };
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function setState(next) {
  state = next;
  storage.write(state);
}

function navigate(hash) {
  window.location.hash = hash;
}

function currentRoute() {
  const hash = window.location.hash || '#/home';
  const quizMatch = hash.match(/^#\/quiz\/(\d+)$/);
  if (quizMatch) return { name: 'quiz', index: Math.min(Math.max(Number(quizMatch[1]) - 1, 0), questions.length - 1) };
  if (hash === '#/result') return { name: 'result' };
  return { name: 'home' };
}

function topBar(label = '趣味自测 · 约 5 分钟') {
  return `<header class="topbar">
    <a class="brand" href="#/home" aria-label="返回御案首页"><span class="brand-mark">御案</span><span class="brand-en">YUAN TEST</span></a>
    <span class="topbar-note">${label}</span>
  </header>`;
}

function sealGraphic(text, size = 'large') {
  return `<div class="seal seal-${size}" aria-hidden="true"><span>${escapeHtml(text)}</span>${icon('seal')}</div>`;
}

function renderHome() {
  const hasProgress = Object.keys(state.answers).length > 0 && !state.completed;
  const hasResult = Boolean(state.completed && state.result?.winner);
  app.innerHTML = `${topBar()}
    <main class="screen cover-screen">
      <div class="cover-rail" aria-hidden="true"><span>第壹卷</span><span>原型档案</span><span>YUAN / 01</span></div>
      <section class="cover-copy">
        <p class="eyebrow">A SMALL TEST ABOUT YOUR WAY OF RULING</p>
        <h1>你适合哪位<br /><em>帝王？</em></h1>
        <p class="lede">从你面对变化、安排时间，以及处理分歧的方式里，看看哪一种帝王气质，最适合成为你的参考系。</p>
        <div class="cover-meta"><span>18 道情境题</span><i></i><span>8 种帝王原型</span><i></i><span>约 5 分钟</span></div>
        <div class="cover-actions">
          <button class="button button-primary" data-testid="start-test" type="button">${hasProgress ? '重新开卷' : '开始开卷'} ${icon('arrow')}</button>
          ${hasProgress ? '<button class="button button-quiet" data-testid="continue-test" type="button">继续上次进度</button>' : ''}
          ${hasResult ? '<button class="button button-quiet" data-testid="view-saved-result" type="button">查看上次判词</button>' : ''}
        </div>
      </section>
      <section class="cover-seal" aria-label="帝王原型测试印章">
        ${sealGraphic('帝王', 'hero')}
        <div class="seal-caption"><span>ORIGINAL</span><strong>性格不分朝代<br />选择会留下痕迹</strong></div>
      </section>
      <p class="cover-footnote">本测试仅供趣味自我观察，不代表历史评价或科学诊断。</p>
    </main>`;

  app.querySelector('[data-testid="start-test"]')?.addEventListener('click', () => {
    setState({ ...createInitialState() });
    navigate('#/quiz/1');
  });
  app.querySelector('[data-testid="continue-test"]')?.addEventListener('click', () => navigate(`#/quiz/${state.currentQuestion || 1}`));
  app.querySelector('[data-testid="view-saved-result"]')?.addEventListener('click', () => navigate('#/result'));
}

function renderQuiz(index) {
  const question = questions[index];
  const selectedId = state.answers[question.id];
  const isLast = index === questions.length - 1;
  const progress = ((index + 1) / questions.length) * 100;
  app.innerHTML = `${topBar(`第 ${String(index + 1).padStart(2, '0')} / ${questions.length}`)}
    <main class="screen quiz-screen">
      <div class="quiz-notation" aria-hidden="true"><span>御案记录</span><span>${String(index + 1).padStart(2, '0')} / ${String(questions.length).padStart(2, '0')}</span></div>
      <section class="quiz-sheet" aria-labelledby="question-title">
        <div class="progress-row"><span>你的测试进度</span><strong>${String(index + 1).padStart(2, '0')} / ${String(questions.length).padStart(2, '0')}</strong></div>
        <div class="progress-line"><span style="width: ${progress}%"></span></div>
        <p class="eyebrow">QUESTION ${String(index + 1).padStart(2, '0')} · 朱批选择</p>
        <h1 id="question-title">${escapeHtml(question.prompt)}</h1>
        <p class="question-lead">${escapeHtml(question.lead)}</p>
        <div class="answer-list" role="group" aria-label="选择一个答案">
          ${question.options.map((option) => `<button class="answer-slip ${selectedId === option.id ? 'is-selected' : ''}" data-testid="quiz-option" data-option-id="${option.id}" type="button" aria-pressed="${selectedId === option.id}"><span class="option-seal">${option.id}</span><span class="answer-copy">${escapeHtml(option.text)}</span><span class="option-mark">${selectedId === option.id ? '已批' : '批语'}</span></button>`).join('')}
        </div>
        <div class="quiz-nav">
          <button class="button button-quiet" data-testid="prev-question" type="button" ${index === 0 ? 'disabled' : ''}>${icon('back')} 上一题</button>
          <span class="nav-note">${isLast ? '这条批语会生成判词' : '选择后自动开卷'}</span>
        </div>
      </section>
      <aside class="quiz-aside" aria-hidden="true"><span>不求正确</span><strong>只看<br />倾向</strong><span>每一题都是一枚小小的印</span></aside>
    </main>`;

  app.querySelectorAll('[data-testid="quiz-option"]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextState = { ...state, answers: { ...state.answers, [question.id]: button.dataset.optionId }, currentQuestion: isLast ? questions.length : index + 2, completed: false, result: null };
      if (isLast) {
        setState({ ...nextState, completed: true, result: scoreAnswers(nextState.answers) });
        navigate('#/result');
      } else {
        setState(nextState);
        navigate(`#/quiz/${index + 2}`);
      }
    });
  });
  app.querySelector('[data-testid="prev-question"]')?.addEventListener('click', () => {
    setState(setCurrentQuestion(state, index));
    navigate(`#/quiz/${index}`);
  });
}

function scoreBar(entry, highest) {
  const width = highest ? Math.max(7, Math.round((entry.score / highest) * 100)) : 7;
  return `<div class="score-row"><div class="score-name"><span>${escapeHtml(entry.name)}</span><small>${entry.matchCount} 次直接匹配</small></div><div class="score-track"><span style="width: ${width}%"></span></div><strong>${entry.score}</strong></div>`;
}

function renderResult() {
  const result = state.result?.winner ? state.result : scoreAnswers(state.answers);
  const winner = result.winner;
  const runnerUp = result.runnerUp;
  const highest = result.scores[0]?.score || 1;
  const winnerEvidence = result.evidence.filter((item) => item.primary === winner.id);
  const shortEvidence = winnerEvidence.slice(0, 3);
  app.innerHTML = `${topBar('判词已成 · 可随时回来查看')}
    <main class="screen result-screen">
      <section class="result-hero">
        <div class="result-stamp">${sealGraphic(winner.seal, 'result')}</div>
        <div class="result-intro">
          <p class="eyebrow">YUAN TEST / PERSONA ARCHIVE</p>
          <p class="result-kicker">你的答案已经拼成了一张帝王侧写</p>
          <h1 id="result-title">${escapeHtml(winner.name)}</h1>
          <p class="result-era">${escapeHtml(winner.era)} · ${escapeHtml(winner.title)}</p>
          <div class="keyword-row">${winner.keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join('')}</div>
          <p class="result-summary">${escapeHtml(winner.summary)}</p>
        </div>
        <div class="result-index" aria-hidden="true"><span>ARCHIVE</span><strong>0${emperorProfiles.findIndex((profile) => profile.id === winner.id) + 1}</strong><span>判词</span></div>
      </section>

      <section class="result-proof result-section" aria-labelledby="proof-title">
        <div class="section-marker"><span>壹</span><small>答案证据</small></div>
        <div class="proof-content">
          <p class="eyebrow">MATCHING EVIDENCE</p>
          <h2 id="proof-title">18 道题里，有 ${winner.matchCount} 次选择和「${escapeHtml(winner.name)}」的做事方式重合。</h2>
          <div class="score-board">${result.scores.map((entry) => scoreBar(entry, highest)).join('')}</div>
          <div class="evidence-list">${shortEvidence.map((item) => `<article class="evidence-item"><span>${item.questionId.replace('q', '')}</span><p><strong>${escapeHtml(item.question)}</strong>${escapeHtml(item.answer)}</p><b>+${item.points}</b></article>`).join('')}</div>
          <details class="full-details">
            <summary data-testid="details-toggle"><span>展开 18 道题的完整解释</span>${icon('arrow')}</summary>
            <div class="details-body">${result.evidence.map((item) => `<div class="detail-row"><span>${item.questionId.replace('q', '').padStart(2, '0')}</span><p><em>${item.primary === winner.id ? `匹配 +${item.points}` : '关联线索'}</em><strong>${escapeHtml(item.question)}</strong>${escapeHtml(item.answer)}</p></div>`).join('')}</div>
          </details>
        </div>
      </section>

      <section class="interpretation result-section" aria-labelledby="interpretation-title">
        <div class="section-marker"><span>贰</span><small>帝王档案</small></div>
        <div class="interpretation-grid" id="interpretation-title">
          <article class="interpretation-lead"><p class="eyebrow">THE ARCHIVE SAYS</p><h2>${escapeHtml(winner.name)}式的你，最适合这样做事。</h2><p>${escapeHtml(winner.description)}</p></article>
          <article><span class="module-label">核心驱动</span><h3>${escapeHtml(winner.core)}</h3><p>${escapeHtml(winner.coreText)}</p></article>
          <article><span class="module-label">推进方式</span><h3>${escapeHtml(winner.action)}</h3><p>${escapeHtml(winner.actionText)}</p></article>
          <article><span class="module-label">关系模式</span><h3>${escapeHtml(winner.relationship)}</h3><p>${escapeHtml(winner.relationshipText)}</p></article>
          <article><span class="module-label">复杂时刻</span><h3>${escapeHtml(winner.pressure)}</h3><p>${escapeHtml(winner.pressureText)}</p></article>
          <article class="warning-module"><span class="module-label">留意这里</span><h3>${escapeHtml(winner.blindspot)}</h3><p>${escapeHtml(winner.blindspotText)}</p></article>
          <article class="takeaway-module"><span class="module-label">带走这一句</span><h3>${escapeHtml(winner.takeaway)}</h3><p>${escapeHtml(winner.takeawayText)}</p></article>
        </div>
      </section>

      <section class="strengths-panel result-section"><div class="section-marker"><span>叁</span><small>身上优势</small></div><div><p class="eyebrow">YOUR ADVANTAGES</p><div class="strength-list">${winner.strengths.map((strength, index) => `<span><b>0${index + 1}</b>${escapeHtml(strength)}</span>`).join('')}</div></div></section>

      <section class="runner-panel"><div><span class="module-label">第二候选 · 也有一点像</span><h2>${escapeHtml(runnerUp.name)}</h2><p>${escapeHtml(runnerUp.title)} · ${runnerUp.score} 分</p></div><div class="runner-note">你不是单一的帝王原型，真正有趣的地方，正是这些倾向如何一起工作。</div></section>

      <footer class="result-footer"><p>18 QUESTIONS · 8 ARCHETYPES · YUAN TEST</p><div class="result-actions"><button class="button button-primary" data-testid="copy-result" type="button">复制我的判词 ${icon('copy')}</button><button class="button button-quiet" data-testid="restart-test" type="button">再测一次</button></div><p class="copy-status" data-copy-status role="status"></p><textarea class="copy-fallback" data-copy-fallback aria-label="可手动复制的判词" readonly>${escapeHtml(buildShareText(result))}</textarea></footer>
    </main>`;

  app.querySelector('[data-testid="copy-result"]')?.addEventListener('click', () => copyResult(result));
  app.querySelector('[data-testid="restart-test"]')?.addEventListener('click', () => {
    setState(createInitialState());
    navigate('#/home');
  });
}

async function copyResult(result) {
  const text = buildShareText(result);
  const status = app.querySelector('[data-copy-status]');
  const fallback = app.querySelector('[data-copy-fallback]');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    status.textContent = '判词已复制，可以发给朋友看看。';
    fallback.classList.remove('is-visible');
  } catch {
    fallback.classList.add('is-visible');
    fallback.focus();
    fallback.select();
    status.textContent = '浏览器未开放自动复制，已选中下方判词，请按 ⌘C / Ctrl+C 复制。';
  }
}

function render() {
  const route = currentRoute();
  if (route.name === 'quiz') renderQuiz(route.index);
  else if (route.name === 'result') renderResult();
  else renderHome();
}

window.addEventListener('hashchange', render);
window.__emperorMatchDebug = {
  getState: () => structuredClone(state),
  getResult: () => state.result ? structuredClone(state.result) : null,
};

if (!window.location.hash) window.location.hash = '#/home';
render();
