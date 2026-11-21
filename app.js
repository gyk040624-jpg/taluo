// app.js — 前端交互状态机与流式 AI 解析
import { FULL_DECK, drawSpread } from './deck.js';

let currentIntent = '工作';
let drawnCards = [];
let flippedCount = 0;
let modalCard = null;
let modalUpright = true;

const hintText = document.getElementById('hint-text');
const startBtn = document.getElementById('start-btn');
const interpretBtn = document.getElementById('interpret-btn');
const insightPanel = document.getElementById('insight-panel');
const insightText = document.getElementById('insight-text');
const questionWrap = document.getElementById('question-wrap');
const questionInput = document.getElementById('question-input');

// 1. 意图切换：仅点击「综合」时展示输入框
document.getElementById('intent-pills').addEventListener('click', (e) => {
  const pill = e.target.closest('.pill');
  if (!pill || drawnCards.length > 0) return;

  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  currentIntent = pill.dataset.intent;

  if (currentIntent === '综合') {
    questionWrap.classList.remove('hidden');
  } else {
    questionWrap.classList.add('hidden');
  }
});

// 2. 抽牌发牌
startBtn.addEventListener('click', async () => {
  drawnCards = drawSpread(3);
  flippedCount = 0;
  startBtn.classList.add('hidden');
  hintText.textContent = '星门已启，依次翻开三张命运牌';

  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 240));
    const card = drawnCards[i];
    const cardEl = document.getElementById(`card-${i}`);
    const emojiEl = document.getElementById(`emoji-${i}`);
    const posEl = document.getElementById(`pos-${i}`);

    emojiEl.textContent = card.e;
    emojiEl.classList.toggle('reversed', !card.isUpright);
    document.getElementById(`name-${i}`).textContent = card.n;

    posEl.textContent = card.isUpright ? '正位' : '逆位';
    posEl.classList.toggle('rev', !card.isUpright);

    cardEl.classList.add('is-ready');
  }
});

// 3. 点击翻牌或查看单牌释义
document.querySelectorAll('.slot').forEach(slot => {
  slot.addEventListener('click', () => {
    const idx = Number(slot.dataset.index);
    const cardEl = document.getElementById(`card-${idx}`);
    if (!cardEl.classList.contains('is-ready')) return;

    if (!cardEl.classList.contains('is-flipped')) {
      cardEl.classList.add('is-flipped');
      flippedCount++;
      if (flippedCount === 3) {
        hintText.textContent = '点牌面可看单牌意象，或召唤星象解读';
        interpretBtn.classList.remove('hidden');
      }
    } else {
      openDetailModal(drawnCards[idx], drawnCards[idx].isUpright);
    }
  });
});

// 4. 调用后端代理并流式渲染
interpretBtn.addEventListener('click', async () => {
  const question = currentIntent === '综合' ? questionInput.value.trim() : '';
  const cardsSummary = drawnCards
    .map((c, idx) => `${['前因', '当下', '后果'][idx]}：${c.n}（${c.isUpright ? '正位' : '逆位'}）`)
    .join('；');

  interpretBtn.disabled = true;
  interpretBtn.textContent = '🔮 正在连接星轨...';
  insightPanel.classList.remove('hidden');
  insightText.textContent = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: currentIntent, question, cards: cardsSummary })
    });

    if (!res.ok) {
      const errDetail = await res.text();
      throw new Error(`HTTP ${res.status} | ${errDetail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') break;

        try {
          const json = JSON.parse(dataStr);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) insightText.textContent += delta;
        } catch {
          // 忽略心跳包
        }
      }
    }

    interpretBtn.classList.add('hidden');
  } catch (err) {
    insightText.textContent = `星象连接中断（${err.message}），请稍后重试。`;
    interpretBtn.disabled = false;
    interpretBtn.textContent = '✦ 重新召唤解读';
  }
});

// 5. 重置牌局
document.getElementById('reset-btn').addEventListener('click', () => {
  drawnCards = [];
  flippedCount = 0;
  document.querySelectorAll('.card-3d').forEach(el => {
    el.classList.remove('is-ready', 'is-flipped');
  });
  insightPanel.classList.add('hidden');
  interpretBtn.classList.add('hidden');
  interpretBtn.disabled = false;
  interpretBtn.textContent = '✦ 召唤星象解读';
  startBtn.classList.remove('hidden');
  hintText.textContent = '静心凝神，点击下方开启星门';
});

// 6. 单牌弹窗与正逆位切换
function openDetailModal(card, isUpright) {
  modalCard = card;
  modalUpright = isUpright;
  renderModal();
  document.getElementById('detail-modal').classList.remove('hidden');
}

function renderModal() {
  const data = modalUpright ? modalCard.up : modalCard.rev;
  document.getElementById('modal-emoji').textContent = modalCard.e;
  document.getElementById('modal-title').textContent = `${modalCard.n} · ${modalUpright ? '正位' : '逆位'}`;
  document.getElementById('modal-desc').textContent = data.d;
  document.getElementById('modal-advice').textContent = data.a;
  document.getElementById('toggle-pos-btn').textContent = `切换至${modalUpright ? '逆位' : '正位'} ↺`;
}

document.getElementById('toggle-pos-btn').addEventListener('click', () => {
  modalUpright = !modalUpright;
  renderModal();
});
document.getElementById('close-modal-btn').addEventListener('click', () => {
  document.getElementById('detail-modal').classList.add('hidden');
});
document.getElementById('detail-modal').addEventListener('click', (e) => {
  if (e.target.id === 'detail-modal') e.target.classList.add('hidden');
});

// 7. 78张牌库与搜索
const libOverlay = document.getElementById('lib-overlay');
const libGrid = document.getElementById('lib-grid');

function renderLibrary(keyword = '') {
  const list = FULL_DECK.filter(c =>
    c.n.includes(keyword) || c.up.d.includes(keyword) || c.rev.d.includes(keyword)
  );
  libGrid.innerHTML = list.map(c => `
    <div class="lib-item" data-id="${c.id}">
      <div style="font-size:1.7rem;margin-bottom:4px;">${c.e}</div>
      <div style="color:var(--gold);font-size:0.82rem;font-weight:600;">${c.n}</div>
    </div>
  `).join('');
}

document.getElementById('open-lib-btn').addEventListener('click', () => {
  renderLibrary();
  libOverlay.classList.remove('hidden');
});
document.getElementById('close-lib-btn').addEventListener('click', () => {
  libOverlay.classList.add('hidden');
});
document.getElementById('lib-search').addEventListener('input', (e) => {
  renderLibrary(e.target.value.trim());
});
libGrid.addEventListener('click', (e) => {
  const item = e.target.closest('.lib-item');
  if (!item) return;
  const card = FULL_DECK.find(c => c.id === Number(item.dataset.id));
  if (card) openDetailModal(card, true);
});
