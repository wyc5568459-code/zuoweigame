/**
 * 佐为自走棋 - 数据结构说明
 * UNIT_POOL: 棋子基础配置（id/name/cost/hp/atk/atkInterval/faction/class）
 * SYNERGY_CONFIG: 羁绊阈值和效果（按场上友军数量激活）
 * STATE: 当前局状态（资源、棋盘、备战区、商店、日志、保存数据）
 */

const UNIT_POOL = [
  { id: 'wei-warrior', icon: '⚔️', name: '围棋武士', cost: 1, hp: 110, atk: 18, atkInterval: 1.2, faction: '棋魂', role: '战士' },
  { id: 'ink-ranger', icon: '🏹', name: '墨影猎手', cost: 1, hp: 90, atk: 22, atkInterval: 1.0, faction: '山林', role: '猎手' },
  { id: 'seal-mage', icon: '🔮', name: '封印术师', cost: 2, hp: 80, atk: 20, atkInterval: 0.95, faction: '学院', role: '法师' },
  { id: 'forest-guard', icon: '🛡️', name: '森语守卫', cost: 1, hp: 120, atk: 16, atkInterval: 1.3, faction: '山林', role: '战士' },
  { id: 'moon-hunter', icon: '🌙', name: '望月弓手', cost: 2, hp: 85, atk: 25, atkInterval: 0.9, faction: '月隐', role: '猎手' },
  { id: 'wind-mage', icon: '💨', name: '风行法使', cost: 2, hp: 78, atk: 24, atkInterval: 0.85, faction: '月隐', role: '法师' },
  { id: 'stone-warrior', icon: '🗿', name: '玄石力士', cost: 3, hp: 150, atk: 27, atkInterval: 1.4, faction: '棋魂', role: '战士' },
  { id: 'star-mage', icon: '✨', name: '星辉术者', cost: 3, hp: 88, atk: 32, atkInterval: 1.0, faction: '学院', role: '法师' },
  { id: 'bamboo-hunter', icon: '🎋', name: '竹影追猎', cost: 2, hp: 92, atk: 23, atkInterval: 0.95, faction: '山林', role: '猎手' }
];

const SYNERGY_CONFIG = [
  { key: '战士', title: '战士', type: 'role', thresholds: [2, 4], effects: ['全体战士生命+25%', '全体战士生命+55%'] },
  { key: '猎手', title: '猎手', type: 'role', thresholds: [2, 4], effects: ['全体猎手攻击+20%', '全体猎手攻击+45%'] },
  { key: '法师', title: '法师', type: 'role', thresholds: [2, 4], effects: ['全体法师攻速+20%', '全体法师攻速+45%'] },
  { key: '山林', title: '山林', type: 'faction', thresholds: [2, 3], effects: ['开局获得20护盾', '开局获得45护盾'] }
];

const STORAGE_KEY = 'saiAutoChessSaveV1';
const BOARD_SIZE = 16;
const BENCH_SIZE = 8;

const state = {
  round: 1,
  hp: 100,
  gold: 10,
  level: 1,
  exp: 0,
  lockedShop: false,
  board: Array(BOARD_SIZE).fill(null),
  bench: Array(BENCH_SIZE).fill(null),
  shop: [],
  selected: null,
  phase: 'prepare',
  highScore: 1,
  battleLog: [],
  history: []
};

const el = {
  round: document.getElementById('roundLabel'), hp: document.getElementById('hpLabel'), gold: document.getElementById('goldLabel'),
  level: document.getElementById('levelLabel'), exp: document.getElementById('expLabel'), pop: document.getElementById('popLabel'),
  phase: document.getElementById('phaseLabel'), board: document.getElementById('battleBoard'), bench: document.getElementById('bench'),
  shop: document.getElementById('shop'), synergy: document.getElementById('synergyPanel'), detail: document.getElementById('unitDetail'),
  log: document.getElementById('logPanel'), btnLock: document.getElementById('btnLock')
};

function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function levelExpNeed(lv) { return Math.min(4 + (lv - 1) * 2, 14); }
function capByLevel(lv) { return Math.min(lv, 8); }

function createUnit(baseId, star = 1) {
  const base = UNIT_POOL.find(u => u.id === baseId);
  const mult = star === 1 ? 1 : star === 2 ? 1.8 : 3.1;
  return {
    uid: uid(), baseId,
    name: base.name, icon: base.icon || '♟️', cost: base.cost, star,
    hp: Math.round(base.hp * mult), maxHp: Math.round(base.hp * mult),
    atk: Math.round(base.atk * mult),
    atkInterval: Math.max(0.45, +(base.atkInterval * (star === 1 ? 1 : star === 2 ? 0.88 : 0.74)).toFixed(2)),
    faction: base.faction, role: base.role,
    shield: 0
  };
}

function weightedRandomBaseId() {
  const list = UNIT_POOL.map(u => ({ id: u.id, w: u.cost === 1 ? 50 : u.cost === 2 ? 32 : 18 }));
  const total = list.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of list) { r -= x.w; if (r <= 0) return x.id; }
  return list[0].id;
}

function refreshShop(free = false) {
  if (!free && state.gold < 2) return log('金币不足，无法刷新商店');
  if (!free) state.gold -= 2;
  state.shop = Array.from({ length: 5 }, () => createUnit(weightedRandomBaseId()));
  render();
}

function addToBench(unit) {
  const idx = state.bench.findIndex(x => !x);
  if (idx === -1) return false;
  state.bench[idx] = unit;
  checkUpgrade();
  return true;
}

function buyFromShop(idx) {
  const unit = state.shop[idx];
  if (!unit) return;
  if (state.gold < unit.cost) return log('金币不足，购买失败');
  if (!addToBench(unit)) return log('备战区已满');
  state.gold -= unit.cost;
  state.shop[idx] = null;
  log(`购买 ${unit.name}（${unit.cost}金）`);
  saveGame();
  render();
}

function checkUpgrade() {
  // 聚合场上+备战区同名同星棋子，执行3合1（支持2星->3星）
  for (const star of [1, 2]) {
    const all = [];
    state.board.forEach((u, i) => u && all.push({ area: 'board', i, u }));
    state.bench.forEach((u, i) => u && all.push({ area: 'bench', i, u }));
    const groups = {};
    for (const item of all) {
      const key = `${item.u.baseId}-${item.u.star}`;
      groups[key] = groups[key] || [];
      groups[key].push(item);
    }
    for (const key in groups) {
      while (groups[key].length >= 3) {
        const consumed = groups[key].splice(0, 3);
        consumed.forEach(c => { state[c.area][c.i] = null; });
        const upgraded = createUnit(consumed[0].u.baseId, star + 1);
        if (!addToBench(upgraded)) {
          const emptyBoard = state.board.findIndex(x => !x);
          if (emptyBoard >= 0) state.board[emptyBoard] = upgraded;
        }
        log(`⭐ 升星成功：${upgraded.name} -> ${upgraded.star}星！`);
      }
    }
  }
}

function buyExp() {
  if (state.gold < 4) return log('金币不足，无法购买经验');
  state.gold -= 4;
  state.exp += 4;
  while (state.level < 8 && state.exp >= levelExpNeed(state.level)) {
    state.exp -= levelExpNeed(state.level);
    state.level += 1;
    log(`等级提升到 ${state.level} 级`);
  }
  render();
}

function armyCount() { return state.board.filter(Boolean).length; }

function onCellClick(area, idx) {
  if (state.phase !== 'prepare') return;
  const arr = state[area];
  const unit = arr[idx];

  if (state.selected) {
    const from = state.selected;
    if (from.area === area && from.idx === idx) {
      state.selected = null;
    } else {
      moveUnit(from, { area, idx });
      state.selected = null;
    }
  } else if (unit) {
    state.selected = { area, idx };
    showDetail(unit);
  }
  render();
}

function moveUnit(from, to) {
  const src = state[from.area];
  const dst = state[to.area];
  const moving = src[from.idx];
  if (!moving) return;

  if (to.area === 'board' && !dst[to.idx] && armyCount() >= capByLevel(state.level) && from.area !== 'board') {
    return log('人口已满，无法继续上阵');
  }

  const target = dst[to.idx];
  if (from.area === 'board' && to.area !== 'board' && target && armyCount() > capByLevel(state.level)) {
    return;
  }

  src[from.idx] = target || null;
  dst[to.idx] = moving;
  checkUpgrade();
  saveGame();
}

function computeSynergies(units) {
  const countRole = {};
  const countFaction = {};
  units.forEach(u => {
    countRole[u.role] = (countRole[u.role] || 0) + 1;
    countFaction[u.faction] = (countFaction[u.faction] || 0) + 1;
  });

  const active = [];
  for (const syn of SYNERGY_CONFIG) {
    const c = syn.type === 'role' ? (countRole[syn.key] || 0) : (countFaction[syn.key] || 0);
    let tier = 0;
    syn.thresholds.forEach((t, i) => { if (c >= t) tier = i + 1; });
    active.push({ ...syn, count: c, tier });
  }
  return active;
}

function applySynergies(units, synergies) {
  units.forEach(u => {
    u.tempAtk = u.atk;
    u.tempHp = u.maxHp;
    u.tempInterval = u.atkInterval;
    u.shield = 0;
  });

  for (const s of synergies) {
    if (s.tier === 0) continue;
    if (s.key === '战士') {
      const bonus = s.tier === 1 ? 0.25 : 0.55;
      units.filter(u => u.role === '战士').forEach(u => { u.tempHp = Math.round(u.tempHp * (1 + bonus)); u.hp = u.tempHp; });
    }
    if (s.key === '猎手') {
      const bonus = s.tier === 1 ? 0.2 : 0.45;
      units.filter(u => u.role === '猎手').forEach(u => { u.tempAtk = Math.round(u.tempAtk * (1 + bonus)); });
    }
    if (s.key === '法师') {
      const bonus = s.tier === 1 ? 0.2 : 0.45;
      units.filter(u => u.role === '法师').forEach(u => { u.tempInterval = +(u.tempInterval * (1 - bonus)).toFixed(2); });
    }
    if (s.key === '山林') {
      const shield = s.tier === 1 ? 20 : 45;
      units.filter(u => u.faction === '山林').forEach(u => { u.shield += shield; });
    }
  }
}

function makeEnemyArmy(round) {
  const count = Math.min(1 + Math.floor((round + 1) / 2), 8);
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const base = UNIT_POOL[(round + i) % UNIT_POOL.length];
    const star = round > 10 && Math.random() > 0.55 ? 2 : 1;
    const u = createUnit(base.id, star);
    const scale = 1 + round * 0.05;
    u.maxHp = Math.round(u.maxHp * scale);
    u.hp = u.maxHp;
    u.atk = Math.round(u.atk * (1 + round * 0.03));
    enemies.push(u);
  }
  return enemies;
}

function pickTarget(alive) { return alive.find(u => u.hp > 0); }

async function startBattle() {
  if (state.phase === 'battle') return;
  const allies = state.board.filter(Boolean).map(u => structuredClone(u));
  if (!allies.length) return log('请至少上阵1个棋子再开始战斗');

  state.battleLog = [];
  el.log.innerHTML = '';

  state.phase = 'battle';
  log('⚔️ 战斗开始');
  render();

  const enemy = makeEnemyArmy(state.round);
  applySynergies(allies, computeSynergies(allies));

  let tick = 0;
  const cooldownA = new Map(allies.map(u => [u.uid, 0]));
  const cooldownE = new Map(enemy.map(u => [u.uid, 0]));

  while (allies.some(u => u.hp > 0) && enemy.some(u => u.hp > 0) && tick < 240) {
    tick++;
    await new Promise(r => setTimeout(r, 180));

    for (const a of allies.filter(u => u.hp > 0)) {
      cooldownA.set(a.uid, cooldownA.get(a.uid) + 0.18);
      if (cooldownA.get(a.uid) >= a.tempInterval) {
        const t = pickTarget(enemy.filter(u => u.hp > 0));
        if (!t) break;
        cooldownA.set(a.uid, 0);
        doDamage(a, t, 'ally');
      }
    }

    for (const e of enemy.filter(u => u.hp > 0)) {
      cooldownE.set(e.uid, cooldownE.get(e.uid) + 0.18);
      if (cooldownE.get(e.uid) >= e.atkInterval) {
        const t = pickTarget(allies.filter(u => u.hp > 0));
        if (!t) break;
        cooldownE.set(e.uid, 0);
        doDamage(e, t, 'enemy');
      }
    }
    renderBattlePreview(allies, enemy);
  }

  const allyAlive = allies.filter(u => u.hp > 0).length;
  const enemyAlive = enemy.filter(u => u.hp > 0).length;
  if (allyAlive > 0 && enemyAlive === 0) {
    const gain = 5 + Math.floor(state.round / 2);
    state.gold += gain;
    log(`✅ 胜利！获得 ${gain} 金币`);
  } else {
    const dmg = Math.max(4, enemyAlive * 2);
    state.hp -= dmg;
    log(`❌ 失败！受到 ${dmg} 点伤害`);
  }

  state.history.push({ round: state.round, result: allyAlive > 0 ? 'win' : 'lose' });
  state.highScore = Math.max(state.highScore, state.round);

  if (state.hp <= 0) {
    state.phase = 'over';
    log('💀 游戏结束，点击“重新开局”再来一局');
    saveGame();
    render();
    return;
  }

  endRound();
}

function doDamage(attacker, target, side) {
  const raw = side === 'ally' ? attacker.tempAtk : attacker.atk;
  let dmg = raw;
  if (target.shield > 0) {
    const absorb = Math.min(target.shield, dmg);
    target.shield -= absorb;
    dmg -= absorb;
  }
  target.hp -= dmg;
  log(`${attacker.name} 攻击 ${target.name}，造成 ${raw} 伤害${dmg < raw ? '（含护盾吸收）' : ''}`);
}

function endRound() {
  state.round += 1;
  state.phase = 'prepare';
  const baseIncome = 5;
  const interest = Math.min(5, Math.floor(state.gold / 10));
  state.gold += baseIncome + interest;
  log(`回合结算：基础+${baseIncome}，利息+${interest}`);
  if (!state.lockedShop) refreshShop(true);
  renderBattlePreview(null, null);
  saveGame();
  render();
}

function renderBattlePreview(allies, enemy) {
  // 战斗阶段在棋盘右上角渲染一个简化预览
  const label = allies && enemy ? `战斗中：我方${allies.filter(u=>u.hp>0).length} 敌方${enemy.filter(u=>u.hp>0).length}` : (state.phase === 'prepare' ? '准备阶段' : state.phase);
  el.phase.textContent = label;
}

function renderCells(container, arr, area) {
  container.innerHTML = '';
  arr.forEach((unit, idx) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const selected = state.selected && state.selected.area === area && state.selected.idx === idx;
    if (selected) cell.classList.add('highlight');

    cell.addEventListener('click', () => onCellClick(area, idx));
    if (unit) cell.appendChild(renderUnit(unit, { selected, enemy: false, onTap: () => onCellClick(area, idx) }));
    container.appendChild(cell);
  });
}

function renderUnit(unit, opts = {}) {
  const { selected = false, enemy = false, onTap = null } = opts;
  const div = document.createElement('div');
  div.className = `unit ${selected ? 'selected' : ''} ${enemy ? 'enemy' : ''}`;
  div.innerHTML = `
    <div class="head"><span class="icon">${unit.icon || '♟️'}</span><div class="name">${unit.name} ${'★'.repeat(unit.star)}</div></div>
    <div class="meta">${unit.faction}/${unit.role}｜攻:${unit.atk}</div>
    <div class="hp-bar"><div class="hp-fill" style="width:${Math.max(0, unit.hp / unit.maxHp * 100)}%"></div></div>
  `;
  div.addEventListener('click', (e) => {
    e.stopPropagation();
    showDetail(unit);
    if (onTap) onTap();
  });
  return div;
}

function showDetail(unit) {
  el.detail.innerHTML = `
    <strong>${unit.icon || '♟️'} ${unit.name} ${'★'.repeat(unit.star)}</strong><br>
    费用：${unit.cost} 金<br>
    阵营：${unit.faction}｜职业：${unit.role}<br>
    生命：${unit.hp}/${unit.maxHp}<br>
    攻击：${unit.atk}｜攻速间隔：${unit.atkInterval}s
  `;
}

function renderShop() {
  el.shop.innerHTML = '';
  state.shop.forEach((u, idx) => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    if (!u) {
      card.innerHTML = '<small>已售空</small>';
    } else {
      card.innerHTML = `<div class="shop-title"><span class="icon">${u.icon || '♟️'}</span><strong>${u.name}</strong></div><small>${u.faction}/${u.role}</small><br><span class="cost">${u.cost} 金币</span>`;
      card.addEventListener('click', () => buyFromShop(idx));
    }
    el.shop.appendChild(card);
  });
}

function renderSynergies() {
  const active = computeSynergies(state.board.filter(Boolean));
  el.synergy.innerHTML = '';
  active.forEach(s => {
    const d = document.createElement('div');
    d.className = `synergy-item ${s.tier > 0 ? 'active' : ''}`;
    d.innerHTML = `<strong>${s.title}</strong> (${s.count})<br>阈值：${s.thresholds.join('/')}<br>${s.tier > 0 ? `当前：${s.effects[s.tier - 1]}` : '未激活'}`;
    el.synergy.appendChild(d);
  });
}

function log(text) {
  state.battleLog.unshift(`[${new Date().toLocaleTimeString()}] ${text}`);
  state.battleLog = state.battleLog.slice(0, 12);
  el.log.innerHTML = state.battleLog.map(x => `<p>${x}</p>`).join('');
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: state.round, hp: state.hp, gold: state.gold, level: state.level, exp: state.exp,
    lockedShop: state.lockedShop, board: state.board, bench: state.bench, shop: state.shop,
    highScore: state.highScore, history: state.history
  }));
}

function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    Object.assign(state, data);
    state.phase = state.hp > 0 ? 'prepare' : 'over';
    return true;
  } catch {
    return false;
  }
}

function resetGame() {
  Object.assign(state, {
    round: 1, hp: 100, gold: 10, level: 1, exp: 0, lockedShop: false,
    board: Array(BOARD_SIZE).fill(null), bench: Array(BENCH_SIZE).fill(null),
    shop: [], selected: null, phase: 'prepare', battleLog: [], history: []
  });
  refreshShop(true);
  saveGame();
  render();
}

function render() {
  el.round.textContent = state.round;
  el.hp.textContent = state.hp;
  el.gold.textContent = state.gold;
  el.level.textContent = state.level;
  el.exp.textContent = `${state.exp}/${levelExpNeed(state.level)}`;
  el.pop.textContent = `${armyCount()}/${capByLevel(state.level)}`;
  el.phase.textContent = state.phase === 'prepare' ? '准备阶段' : state.phase === 'over' ? '游戏结束' : '战斗阶段';
  el.btnLock.textContent = `锁定商店: ${state.lockedShop ? '是' : '否'}`;

  renderCells(el.board, state.board, 'board');
  renderCells(el.bench, state.bench, 'bench');
  renderShop();
  renderSynergies();
  el.log.innerHTML = state.battleLog.map(x => `<p>${x}</p>`).join('');
}

document.getElementById('btnRefresh').addEventListener('click', () => refreshShop(false));
document.getElementById('btnBuyExp').addEventListener('click', () => { if (state.phase === 'prepare') buyExp(); saveGame(); render(); });
document.getElementById('btnStartBattle').addEventListener('click', startBattle);
document.getElementById('btnRestart').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  resetGame();
  log('已重新开始新对局');
});
document.getElementById('btnLock').addEventListener('click', () => {
  state.lockedShop = !state.lockedShop;
  saveGame();
  render();
});

(function init() {
  const loaded = loadGame();
  if (!loaded) refreshShop(true);
  log(`欢迎来到佐为自走棋，历史最高回合：${state.highScore}`);
  render();
})();
