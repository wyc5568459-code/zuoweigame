const UNIT_POOL = [
  { id: 'zw', name: '佐为', faction: '棋魂', role: '法师', cost: 3, hp: 120, atk: 26, range: 3 },
  { id: 'sy', name: '小光', faction: '棋魂', role: '战士', cost: 1, hp: 150, atk: 18, range: 1 },
  { id: 'yt', name: '塔矢亮', faction: '院生', role: '猎手', cost: 2, hp: 110, atk: 24, range: 3 },
  { id: 'is', name: '伊角', faction: '院生', role: '战士', cost: 1, hp: 140, atk: 19, range: 1 },
  { id: 'hj', name: '和谷', faction: '街棋', role: '猎手', cost: 2, hp: 115, atk: 23, range: 3 },
  { id: 'mo', name: '绪方', faction: '街棋', role: '刺客', cost: 3, hp: 100, atk: 30, range: 1 }
];

const TRAITS = {
  战士: { kind: 'role', breaks: [2, 4], bonus: ['全体+20生命', '全体+45生命'] },
  猎手: { kind: 'role', breaks: [2, 4], bonus: ['全体+8攻击', '全体+18攻击'] },
  法师: { kind: 'role', breaks: [2, 3], bonus: ['全体+10攻击', '全体+20攻击'] },
  刺客: { kind: 'role', breaks: [2, 3], bonus: ['刺客开场跳后排，+8攻击', '刺客+18攻击'] },
  棋魂: { kind: 'faction', breaks: [2, 4], bonus: ['棋魂+18生命', '棋魂+40生命'] },
  院生: { kind: 'faction', breaks: [2, 3], bonus: ['院生+6攻击', '院生+14攻击'] },
  街棋: { kind: 'faction', breaks: [2, 3], bonus: ['街棋+12生命+4攻击', '街棋+24生命+10攻击'] }
};

const LEVEL_CAP = [1, 2, 3, 4, 5, 6, 7, 8];
const LEVEL_EXP = [4, 6, 10, 16, 24, 32, 48];

const state = {
  round: 1, hp: 100, gold: 10, level: 1, exp: 0,
  board: Array(16).fill(null), bench: Array(8).fill(null), shop: [],
  selected: null, phase: 'prepare', winStreak: 0, loseStreak: 0,
  logs: ['欢迎来到移动端佐为自走棋'],
  nextEnemy: null, battleReport: ''
};

const el = Object.fromEntries(['round','hp','gold','interest','winStreak','loseStreak','level','exp','pop','phase','board','bench','shop','log','synergy','enemyBoard','enemyLabel','enemyStrategy'].map((id)=>[id,document.getElementById(id)]));

const uid = () => Math.random().toString(36).slice(2, 9);
const cap = () => LEVEL_CAP[state.level - 1];
const inBoard = () => state.board.filter(Boolean).length;
const row = (i) => Math.floor(i / 4);
const col = (i) => i % 4;
const dist = (a, b) => Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b));

function cloneBase(id, star = 1) { const b = UNIT_POOL.find((u)=>u.id===id); return { ...b, star, uid: uid() }; }
function addLog(t, c='') { state.logs.unshift(c ? `<span class="${c}">${t}</span>` : t); state.logs = state.logs.slice(0, 10); }

function incomePreview() { return Math.min(5, Math.floor(state.gold / 10)); }
function streakBonus(win, lose) { const n = Math.max(win, lose); return n >= 5 ? 3 : n >= 3 ? 2 : n >= 2 ? 1 : 0; }

function rollShop() { state.shop = Array.from({ length: 5 }, () => ({ id: uid(), unitId: UNIT_POOL[Math.floor(Math.random() * UNIT_POOL.length)].id })); }

function calcTraitCounts(units) {
  const c = { role: {}, faction: {} };
  units.forEach((u) => { c.role[u.role] = (c.role[u.role] || 0) + 1; c.faction[u.faction] = (c.faction[u.faction] || 0) + 1; });
  return c;
}

function traitLevel(name, amount) {
  const t = TRAITS[name];
  if (!t) return -1;
  let lv = -1;
  t.breaks.forEach((need, i) => { if (amount >= need) lv = i; });
  return lv;
}

function calcSynergy(units) {
  const counts = calcTraitCounts(units);
  const eff = { atk: 0, hp: 0, assassinAtk: 0, byTrait: [] };
  Object.entries(TRAITS).forEach(([name, t]) => {
    const amount = counts[t.kind][name] || 0;
    const lv = traitLevel(name, amount);
    const next = t.breaks.find((x) => x > amount) || t.breaks[t.breaks.length - 1];
    if (lv >= 0) {
      if (name === '战士') eff.hp += lv === 0 ? 20 : 45;
      if (name === '猎手') eff.atk += lv === 0 ? 8 : 18;
      if (name === '法师') eff.atk += lv === 0 ? 10 : 20;
      if (name === '刺客') eff.assassinAtk += lv === 0 ? 8 : 18;
      if (name === '棋魂') eff.hp += lv === 0 ? 18 : 40;
      if (name === '院生') eff.atk += lv === 0 ? 6 : 14;
      if (name === '街棋') { eff.hp += lv === 0 ? 12 : 24; eff.atk += lv === 0 ? 4 : 10; }
    }
    eff.byTrait.push({ name, amount, next, active: lv >= 0, lv, desc: lv >= 0 ? t.bonus[lv] : '未激活' });
  });
  eff.byTrait.sort((a, b) => Number(b.active) - Number(a.active) || b.amount - a.amount);
  return eff;
}

function showTraitPanel() {
  const allies = state.board.filter(Boolean);
  const syn = calcSynergy(allies);
  el.synergy.innerHTML = syn.byTrait.map((t) => `<button class="trait-item ${t.active ? 'active' : ''}" data-trait="${t.name}">${t.name} ${t.amount}/${t.next} · ${t.desc}</button>`).join('');
  document.querySelectorAll('.trait-item').forEach((b) => {
    b.onclick = () => openTraitModal(b.dataset.trait);
  });
}

function openTraitModal(trait) {
  const t = TRAITS[trait]; if (!t) return;
  document.getElementById('traitTitle').textContent = `${trait} 羁绊`;
  const units = UNIT_POOL.filter((u) => u[t.kind] === trait).map((u) => u.name).join('、');
  document.getElementById('traitDesc').innerHTML = t.breaks.map((n, i) => `${n}：${t.bonus[i]}`).join('<br>') + `<br><br>单位：${units}`;
  document.getElementById('traitModal').classList.remove('hidden');
}
document.getElementById('closeTrait').onclick = () => document.getElementById('traitModal').classList.add('hidden');

function tryUpgrade() {
  const all = [...state.board.map((u, i) => ({ area: 'board', i, u })), ...state.bench.map((u, i) => ({ area: 'bench', i, u }))].filter((x) => x.u);
  const groups = {};
  all.forEach((x) => { const k = `${x.u.id}-${x.u.star}`; if (!groups[k]) groups[k] = []; groups[k].push(x); });
  Object.values(groups).forEach((arr) => {
    if (arr.length >= 3 && arr[0].u.star < 3) {
      arr.slice(0, 3).forEach((p) => { state[p.area][p.i] = null; });
      const next = cloneBase(arr[0].u.id, arr[0].u.star + 1);
      const b = state.bench.findIndex((x) => !x); if (b >= 0) state.bench[b] = next;
      addLog(`✨ 3合1升星：${next.name} -> ${next.star}星`);
    }
  });
}

function moveUnit(from, to) {
  const src = state[from.area], dst = state[to.area], mover = src[from.index]; if (!mover) return;
  if (to.area === 'board' && !dst[to.index] && from.area !== 'board' && inBoard() >= cap()) return addLog('人口已满，无法上阵');
  src[from.index] = dst[to.index] || null; dst[to.index] = mover; tryUpgrade();
}

function templateSlots(name) {
  if (name === 'front') return [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
  if (name === 'corner') return [3,7,2,6,11,1,10,15,5,9,0,4,8,12,13,14];
  return [0,2,5,7,8,10,13,15,1,3,4,6,9,11,12,14];
}

function generateOpponent(roundSeed = state.round + 1) {
  const player = state.board.map((u, i) => u ? { ...u, pos: i } : null).filter(Boolean);
  const playerBackline = player.filter((u) => row(u.pos) >= 2).length;
  const playerFront = player.filter((u) => row(u.pos) <= 1).length;
  const rightBias = player.filter((u) => col(u.pos) >= 2).length >= Math.ceil(Math.max(player.length,1)/2);
  let template = 'front';
  if (playerBackline >= 3) template = 'corner';
  if (player.length >= 5 && playerFront >= 3) template = 'spread';
  if (playerFront <= 1) template = 'front';
  const unitCount = Math.min(LEVEL_CAP[Math.min(7, Math.floor((roundSeed + 1) / 2))], 2 + Math.floor(roundSeed / 2));
  const units = [];
  for (let i = 0; i < unitCount; i += 1) {
    const base = UNIT_POOL[(roundSeed + i) % UNIT_POOL.length];
    const star = roundSeed > 7 && i % 3 === 0 ? 2 : 1;
    const u = cloneBase(base.id, star);
    const scale = 1 + roundSeed * 0.08;
    u.hp = Math.round((u.hp + (star - 1) * 55) * scale);
    u.atk = Math.round((u.atk + (star - 1) * 10) * scale);
    units.push(u);
  }
  tryUpgradeArray(units);
  const slots = templateSlots(template);
  const board = Array(16).fill(null);
  const order = units.sort((a,b) => (a.role === '战士' ? -1 : 0) - (b.role === '战士' ? -1 : 0));
  order.forEach((u, idx) => {
    let target = slots[idx] ?? idx;
    if (u.role === '刺客') target = rightBias ? [2,6,10,14][idx % 4] : [1,5,9,13][idx % 4];
    board[target] = { ...u, pos: target };
  });
  const strategyText = template === 'corner' ? '角落抱团（针对后排同侧）' : template === 'spread' ? '分散站位（防范围）' : '前排推进（压制薄前排）';
  return { round: roundSeed, name: `棋馆守擂者R${roundSeed}`, template, strategyText, board, units: board.filter(Boolean), synergy: calcSynergy(board.filter(Boolean)) };
}

function tryUpgradeArray(units) {
  const map = {};
  units.forEach((u) => { const k = `${u.id}-${u.star}`; map[k] = map[k] || []; map[k].push(u); });
  Object.values(map).forEach((arr) => {
    if (arr.length >= 3 && arr[0].star < 3) {
      const keep = arr[0]; keep.star += 1; keep.hp += 60; keep.atk += 10;
      arr.slice(1, 3).forEach((x) => units.splice(units.indexOf(x), 1));
    }
  });
}

function chooseTarget(attacker, enemies) {
  const alive = enemies.filter((u) => u.hp > 0);
  alive.sort((a, b) => dist(attacker.pos, a.pos) - dist(attacker.pos, b.pos) || row(a.pos) - row(b.pos));
  return alive[0];
}

function applyBuffs(units, synergy, isEnemy = false) {
  units.forEach((u) => {
    u.maxHp = u.hp + synergy.hp + (u.star - 1) * 40;
    u.hp = u.maxHp;
    u.atkFinal = u.atk + synergy.atk + (u.role === '刺客' ? synergy.assassinAtk : 0) + (u.star - 1) * 8;
    if (!isEnemy && u.role === '刺客') {
      const back = [12,13,14,15].find((i) => !units.some((x) => x.pos === i));
      if (back !== undefined) u.pos = back;
    }
  });
}

function simulateBattle() {
  const ally = state.board.map((u,i) => u ? { ...u, pos: i } : null).filter(Boolean);
  if (!ally.length) return addLog('请先上阵至少1个棋子');
  if (!state.nextEnemy) state.nextEnemy = generateOpponent();
  const enemy = state.nextEnemy.board.map((u) => u ? { ...u } : null).filter(Boolean);

  const allySyn = calcSynergy(ally), enemySyn = state.nextEnemy.synergy;
  applyBuffs(ally, allySyn); applyBuffs(enemy, enemySyn, true);

  let ticks = 0;
  while (ally.some((u) => u.hp > 0) && enemy.some((u) => u.hp > 0) && ticks < 50) {
    ticks += 1;
    [...ally.filter((u) => u.hp > 0), ...enemy.filter((u) => u.hp > 0)].forEach((u) => {
      const foe = ally.includes(u) ? enemy : ally;
      const t = chooseTarget(u, foe);
      if (t) t.hp -= u.atkFinal;
    });
  }
  const allyAlive = ally.filter((u) => u.hp > 0).length;
  const enemyAlive = enemy.filter((u) => u.hp > 0).length;
  const win = allyAlive > 0 && enemyAlive === 0;

  const interest = incomePreview();
  const streak = streakBonus(state.winStreak, state.loseStreak);
  const base = 5;
  if (win) { state.winStreak += 1; state.loseStreak = 0; state.gold += base + interest + streak + 1; addLog(`第${state.round}回合胜利 +${base + interest + streak + 1}金币`, 'win'); }
  else { state.loseStreak += 1; state.winStreak = 0; const hpLoss = Math.max(2, enemyAlive * 2); state.hp -= hpLoss; state.gold += base + interest + streak; addLog(`第${state.round}回合失败 -${hpLoss}HP`, 'lose'); }
  state.battleReport = `战报：我方存活${allyAlive}，对手存活${enemyAlive}。${win ? '胜利奖励含连胜与利息。' : '失败扣血=存活敌人数×2。'}`;

  if (state.hp <= 0) { state.phase = 'over'; addLog('游戏结束，刷新重开'); return; }
  state.round += 1;
  state.phase = 'prepare';
  state.exp += 1;
  while (state.level < 8 && state.exp >= LEVEL_EXP[state.level - 1]) { state.exp -= LEVEL_EXP[state.level - 1]; state.level += 1; addLog(`自动升级到${state.level}级`); }
  rollShop();
  state.nextEnemy = generateOpponent(state.round + 1);
}

function buyFromShop(i) {
  const c = state.shop[i]; if (!c) return;
  const u = UNIT_POOL.find((x) => x.id === c.unitId);
  if (state.gold < u.cost) return addLog('金币不足');
  const slot = state.bench.findIndex((x) => !x);
  if (slot < 0) return addLog('备战区已满');
  state.gold -= u.cost; state.bench[slot] = cloneBase(u.id); state.shop[i] = null; tryUpgrade();
}

function buyExp() {
  if (state.gold < 4) return addLog('金币不足，无法购买经验');
  if (state.level >= 8) return;
  state.gold -= 4; state.exp += 4;
  while (state.level < 8 && state.exp >= LEVEL_EXP[state.level - 1]) { state.exp -= LEVEL_EXP[state.level - 1]; state.level += 1; addLog(`升级到 ${state.level} 级`); }
}

function renderUnit(u, selected) { const d = document.createElement('div'); d.className = `unit u${Math.min(3, u.cost)} ${selected ? 'selected' : ''}`; d.innerHTML = `<div class="name">${u.name}</div><div class="star">${'★'.repeat(u.star)}</div><div class="tag">${u.faction}/${u.role}</div>`; return d; }
function renderGrid(node, data, clickable, area = 'board') {
  node.innerHTML = '';
  data.forEach((u, index) => {
    const c = document.createElement('button');
    c.className = area === 'bench' ? 'bench-cell' : 'board-cell';
    if (clickable) c.onclick = () => onCell(area, index);
    if (u) c.appendChild(renderUnit(u, state.selected?.area === area && state.selected?.index === index));
    node.appendChild(c);
  });
}

function renderShop() {
  el.shop.innerHTML = '';
  state.shop.forEach((card, i) => {
    const box = document.createElement('div'); box.className = 'shop-card';
    if (!card) box.innerHTML = '<div>已购买</div>';
    else {
      const u = UNIT_POOL.find((x) => x.id === card.unitId);
      box.innerHTML = `<div>${u.name}</div><div>${u.faction}/${u.role}</div><div>费用 ${u.cost}</div>`;
      const b = document.createElement('button'); b.textContent = '购买'; b.onclick = () => { buyFromShop(i); render(); }; box.appendChild(b);
    }
    el.shop.appendChild(box);
  });
}

function renderEnemyBoard() {
  if (!state.nextEnemy) return;
  el.enemyLabel.textContent = `${state.nextEnemy.name} · R${state.nextEnemy.round}`;
  el.enemyStrategy.textContent = `对手采用：${state.nextEnemy.strategyText}`;
  const asCells = Array(16).fill(null);
  state.nextEnemy.units.forEach((u) => { asCells[u.pos] = u; });
  renderGrid(el.enemyBoard, asCells, false);
}

function onCell(area, index) {
  if (state.phase !== 'prepare') return;
  const unit = state[area][index];
  if (state.selected) {
    const same = state.selected.area === area && state.selected.index === index;
    if (same) state.selected = null;
    else { moveUnit(state.selected, { area, index }); state.selected = null; }
  } else if (unit) state.selected = { area, index };
  render();
}

function render() {
  el.round.textContent = state.round; el.hp.textContent = Math.max(0, state.hp); el.gold.textContent = state.gold;
  el.interest.textContent = incomePreview(); el.winStreak.textContent = state.winStreak; el.loseStreak.textContent = state.loseStreak;
  el.level.textContent = state.level; el.exp.textContent = state.level >= 8 ? 'MAX' : `${state.exp}/${LEVEL_EXP[state.level - 1]}`;
  el.pop.textContent = `${inBoard()}/${cap()}`;
  el.phase.textContent = state.phase === 'prepare' ? `准备阶段：收入→准备→战斗。${state.battleReport}` : state.phase === 'battle' ? '战斗结算中' : '已结束';
  renderGrid(el.board, state.board, true, 'board'); renderGrid(el.bench, state.bench, true, 'bench'); renderShop(); renderEnemyBoard(); showTraitPanel(); el.log.innerHTML = state.logs.join('<br>');
}

function init() {
  rollShop();
  state.nextEnemy = generateOpponent(2);
  document.getElementById('btnRefresh').onclick = () => { if (state.gold < 2) return addLog('金币不足，无法刷新'); state.gold -= 2; rollShop(); render(); };
  document.getElementById('btnExp').onclick = () => { buyExp(); render(); };
  document.getElementById('btnBattle').onclick = () => { simulateBattle(); render(); };
  render();
}
init();
