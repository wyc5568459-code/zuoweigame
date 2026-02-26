const UNIT_POOL = [
  { id: 'zw', name: '佐为', faction: '棋魂', role: '法师', cost: 3, hp: 120, atk: 26 },
  { id: 'sy', name: '小光', faction: '棋魂', role: '战士', cost: 1, hp: 150, atk: 18 },
  { id: 'yt', name: '塔矢亮', faction: '院生', role: '猎手', cost: 2, hp: 110, atk: 24 },
  { id: 'is', name: '伊角', faction: '院生', role: '战士', cost: 1, hp: 140, atk: 19 },
  { id: 'hj', name: '和谷', faction: '街棋', role: '猎手', cost: 2, hp: 115, atk: 23 },
  { id: 'mo', name: '绪方', faction: '街棋', role: '法师', cost: 3, hp: 100, atk: 28 }
];

const LEVEL_CAP = [1, 2, 3, 4, 5, 6, 7, 8];
const LEVEL_EXP = [4, 6, 10, 16, 24, 32, 48];

const state = {
  round: 1,
  hp: 100,
  gold: 10,
  level: 1,
  exp: 0,
  board: Array(16).fill(null),
  bench: Array(8).fill(null),
  shop: [],
  selected: null,
  phase: 'prepare',
  logs: ['欢迎来到移动端佐为自走棋']
};

const el = {
  round: document.getElementById('round'),
  hp: document.getElementById('hp'),
  gold: document.getElementById('gold'),
  level: document.getElementById('level'),
  exp: document.getElementById('exp'),
  pop: document.getElementById('pop'),
  phase: document.getElementById('phase'),
  board: document.getElementById('board'),
  bench: document.getElementById('bench'),
  shop: document.getElementById('shop'),
  log: document.getElementById('log'),
  synergy: document.getElementById('synergy')
};

const uid = () => Math.random().toString(36).slice(2, 9);
const cap = () => LEVEL_CAP[state.level - 1];
const inBoard = () => state.board.filter(Boolean).length;

function cloneBase(id, star = 1) {
  const base = UNIT_POOL.find((u) => u.id === id);
  return { ...base, star, uid: uid() };
}

function addLog(text, cls = '') {
  state.logs.unshift(cls ? `<span class="${cls}">${text}</span>` : text);
  state.logs = state.logs.slice(0, 8);
}

function rollShop() {
  state.shop = Array.from({ length: 5 }, () => {
    const pick = UNIT_POOL[Math.floor(Math.random() * UNIT_POOL.length)];
    return { id: uid(), unitId: pick.id };
  });
}

function tryUpgrade() {
  const all = [...state.board.map((u, i) => ({ area: 'board', i, u })), ...state.bench.map((u, i) => ({ area: 'bench', i, u }))]
    .filter((x) => x.u);

  const groups = {};
  all.forEach((x) => {
    const key = `${x.u.id}-${x.u.star}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(x);
  });

  Object.values(groups).forEach((arr) => {
    if (arr.length >= 3 && arr[0].u.star < 3) {
      const picked = arr.slice(0, 3);
      picked.forEach((p) => { state[p.area][p.i] = null; });
      const next = cloneBase(picked[0].u.id, picked[0].u.star + 1);
      const toBench = state.bench.findIndex((x) => !x);
      if (toBench >= 0) state.bench[toBench] = next;
      else {
        const toBoard = state.board.findIndex((x) => !x);
        if (toBoard >= 0) state.board[toBoard] = next;
      }
      addLog(`⭐ ${next.name} 升到 ${next.star} 星`);
    }
  });
}

function moveUnit(from, to) {
  const src = state[from.area];
  const dst = state[to.area];
  const mover = src[from.index];
  if (!mover) return;

  if (to.area === 'board' && !dst[to.index] && from.area !== 'board' && inBoard() >= cap()) {
    return addLog('人口已满，无法上阵');
  }

  src[from.index] = dst[to.index] || null;
  dst[to.index] = mover;
  tryUpgrade();
}

function calcSynergy() {
  const active = state.board.filter(Boolean);
  const count = {
    faction: {},
    role: {}
  };

  active.forEach((u) => {
    count.faction[u.faction] = (count.faction[u.faction] || 0) + 1;
    count.role[u.role] = (count.role[u.role] || 0) + 1;
  });

  const effects = { atk: 0, hp: 0 };
  if ((count.role['战士'] || 0) >= 2) effects.hp += 20;
  if ((count.role['猎手'] || 0) >= 2) effects.atk += 6;
  if ((count.role['法师'] || 0) >= 2) effects.atk += 8;
  if ((count.faction['棋魂'] || 0) >= 2) effects.hp += 18;

  const lines = [];
  Object.entries(count.role).forEach(([k, v]) => lines.push(`${k}:${v}`));
  Object.entries(count.faction).forEach(([k, v]) => lines.push(`${k}:${v}`));
  el.synergy.textContent = lines.length ? `羁绊计数 ${lines.join(' / ')}` : '羁绊计数：暂无';
  return effects;
}

function simulateBattle() {
  const allies = state.board.filter(Boolean).map((u) => ({ ...u }));
  if (!allies.length) {
    addLog('请先上阵至少1个棋子');
    return;
  }

  state.phase = 'battle';
  const enemyCount = Math.min(1 + Math.floor(state.round / 2), 8);
  const enemies = Array.from({ length: enemyCount }, (_, i) => {
    const base = UNIT_POOL[(state.round + i) % UNIT_POOL.length];
    const star = state.round >= 8 && Math.random() > 0.6 ? 2 : 1;
    const e = cloneBase(base.id, star);
    const scale = 1 + state.round * 0.05;
    e.hp = Math.round((e.hp + star * 20) * scale);
    e.atk = Math.round((e.atk + star * 4) * scale);
    return e;
  });

  const syn = calcSynergy();
  allies.forEach((u) => { u.hp += syn.hp + u.star * 20; u.atk += syn.atk + u.star * 4; });

  while (allies.some((x) => x.hp > 0) && enemies.some((x) => x.hp > 0)) {
    allies.filter((x) => x.hp > 0).forEach((a) => {
      const t = enemies.find((x) => x.hp > 0);
      if (t) t.hp -= a.atk;
    });
    enemies.filter((x) => x.hp > 0).forEach((e) => {
      const t = allies.find((x) => x.hp > 0);
      if (t) t.hp -= e.atk;
    });
  }

  const win = allies.some((x) => x.hp > 0);
  if (win) {
    const income = 5;
    const interest = Math.min(5, Math.floor(state.gold / 10));
    const reward = income + interest + 1;
    state.gold += reward;
    addLog(`第${state.round}回合胜利 +${reward}金币(含利息${interest})`, 'win');
  } else {
    const loss = Math.max(4, enemies.filter((x) => x.hp > 0).length * 2);
    state.hp -= loss;
    const income = 5;
    const interest = Math.min(5, Math.floor(state.gold / 10));
    state.gold += income + interest;
    addLog(`第${state.round}回合失败 -${loss}HP`, 'lose');
  }

  if (state.hp <= 0) {
    state.phase = 'over';
    addLog('游戏结束，刷新页面可重开');
    return;
  }

  state.round += 1;
  state.phase = 'prepare';
  rollShop();
}

function buyFromShop(i) {
  const card = state.shop[i];
  if (!card) return;
  const unit = UNIT_POOL.find((u) => u.id === card.unitId);
  if (state.gold < unit.cost) return addLog('金币不足');

  const slot = state.bench.findIndex((x) => !x);
  if (slot < 0) return addLog('备战区已满');

  state.gold -= unit.cost;
  state.bench[slot] = cloneBase(unit.id);
  state.shop[i] = null;
  tryUpgrade();
}

function buyExp() {
  if (state.gold < 4) return addLog('金币不足，无法购买经验');
  if (state.level >= 8) return;
  state.gold -= 4;
  state.exp += 4;
  while (state.level < 8 && state.exp >= LEVEL_EXP[state.level - 1]) {
    state.exp -= LEVEL_EXP[state.level - 1];
    state.level += 1;
    addLog(`升级到 ${state.level} 级`);
  }
}

function renderBoard() {
  el.board.innerHTML = '';
  state.board.forEach((u, index) => {
    const cell = document.createElement('button');
    cell.className = 'board-cell';
    cell.onclick = () => onCell('board', index);
    if (u) cell.appendChild(renderUnit(u, state.selected?.area === 'board' && state.selected?.index === index));
    el.board.appendChild(cell);
  });
}

function renderBench() {
  el.bench.innerHTML = '';
  state.bench.forEach((u, index) => {
    const cell = document.createElement('button');
    cell.className = 'bench-cell';
    cell.onclick = () => onCell('bench', index);
    if (u) cell.appendChild(renderUnit(u, state.selected?.area === 'bench' && state.selected?.index === index));
    el.bench.appendChild(cell);
  });
}

function renderUnit(u, selected) {
  const d = document.createElement('div');
  d.className = `unit u${Math.min(3, u.cost)} ${selected ? 'selected' : ''}`;
  d.innerHTML = `<div class="name">${u.name}</div><div class="star">${'★'.repeat(u.star)}</div><div class="tag">${u.faction}/${u.role}</div>`;
  return d;
}

function renderShop() {
  el.shop.innerHTML = '';
  state.shop.forEach((card, i) => {
    const box = document.createElement('div');
    box.className = 'shop-card';
    if (!card) {
      box.innerHTML = '<div>已购买</div>';
    } else {
      const u = UNIT_POOL.find((x) => x.id === card.unitId);
      box.innerHTML = `<div>${u.name}</div><div>${u.faction}/${u.role}</div><div>费用 ${u.cost}</div>`;
      const btn = document.createElement('button');
      btn.textContent = '购买';
      btn.onclick = () => { buyFromShop(i); render(); };
      box.appendChild(btn);
    }
    el.shop.appendChild(box);
  });
}

function onCell(area, index) {
  if (state.phase !== 'prepare') return;
  const unit = state[area][index];
  if (state.selected) {
    const same = state.selected.area === area && state.selected.index === index;
    if (same) state.selected = null;
    else {
      moveUnit(state.selected, { area, index });
      state.selected = null;
    }
  } else if (unit) {
    state.selected = { area, index };
  }
  render();
}

function render() {
  el.round.textContent = state.round;
  el.hp.textContent = Math.max(0, state.hp);
  el.gold.textContent = state.gold;
  el.level.textContent = state.level;
  el.exp.textContent = state.level >= 8 ? 'MAX' : `${state.exp}/${LEVEL_EXP[state.level - 1]}`;
  el.pop.textContent = `${inBoard()}/${cap()}`;
  el.phase.textContent = state.phase === 'prepare' ? '准备阶段：可购买、摆放、升星与升级' : state.phase === 'battle' ? '战斗结算中' : '已结束';
  renderBoard();
  renderBench();
  renderShop();
  calcSynergy();
  el.log.innerHTML = state.logs.join('<br>');
}

function setupTabs() {
  const tabBench = document.getElementById('tabBench');
  const tabShop = document.getElementById('tabShop');
  const benchPanel = document.getElementById('benchPanel');
  const shopPanel = document.getElementById('shopPanel');

  tabBench.onclick = () => {
    tabBench.classList.add('active');
    tabShop.classList.remove('active');
    benchPanel.classList.remove('hidden');
    shopPanel.classList.add('hidden');
  };

  tabShop.onclick = () => {
    tabShop.classList.add('active');
    tabBench.classList.remove('active');
    shopPanel.classList.remove('hidden');
    benchPanel.classList.add('hidden');
  };
}

function init() {
  rollShop();
  setupTabs();
  document.getElementById('btnRefresh').onclick = () => {
    if (state.gold < 2) return addLog('金币不足，无法刷新');
    state.gold -= 2;
    rollShop();
    render();
  };
  document.getElementById('btnExp').onclick = () => { buyExp(); render(); };
  document.getElementById('btnBattle').onclick = () => { simulateBattle(); render(); };
  render();
}

init();
