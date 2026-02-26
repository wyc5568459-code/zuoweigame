const SIZE = 13;
const TILE = 32;

const T = {
  FLOOR: 0,
  WALL: 1,
  HERO: 2,
  DOOR_Y: 3,
  DOOR_B: 4,
  DOOR_R: 5,
  KEY_Y: 6,
  KEY_B: 7,
  KEY_R: 8,
  GEM_R: 9,
  GEM_B: 10,
  POTION: 11,
  STAIR_UP: 12,
  STAIR_DOWN: 13,
  SHOP: 14,
  NPC: 15,
  TRAP: 16,
  GOLD: 17,
};

const MONSTERS = {
  slime: { name: '绿史莱姆', hp: 40, atk: 15, def: 4, gold: 4, color: '#22c55e' },
  bat: { name: '小蝙蝠', hp: 70, atk: 22, def: 8, gold: 8, color: '#a78bfa' },
  guard: { name: '骷髅卫兵', hp: 120, atk: 32, def: 15, gold: 14, color: '#d1d5db' },
  knight: { name: '铁甲骑士', hp: 220, atk: 55, def: 30, gold: 28, color: '#60a5fa' },
  mage: { name: '黑袍法师', hp: 300, atk: 78, def: 42, gold: 40, color: '#f97316' },
  demon: { name: '高阶恶魔', hp: 450, atk: 110, def: 68, gold: 55, color: '#ef4444' },
  king: { name: '魔王', hp: 1500, atk: 220, def: 140, gold: 0, color: '#b91c1c' },
};

const EVENT_TEXT = {
  1: '1F: 新手提示：战斗前看预计损耗，别硬刚。',
  5: '5F: 老人：黄钥匙优先开路，蓝门多藏宝。',
  10: '10F: 商人：金币可在商店兑换生命和属性。',
  20: '20F: 骑士：30F 后红门变多，留好红钥匙。',
  30: '30F: 先知：40F 起怪物攻防激增，蓝宝石要拿。',
  40: '40F: 公主的声音：我在 49F，快来救我！',
  49: '49F: 你救出了公主。她说魔王在 50F 顶层。',
  50: '50F: 最终决战，击败魔王即可通关。'
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusPanel = document.getElementById('statusPanel');
const hint = document.getElementById('hint');
const overlay = document.getElementById('overlay');
const panelTitle = document.getElementById('panelTitle');
const panelBody = document.getElementById('panelBody');

const game = {
  floor: 1,
  hero: { x: 1, y: 1, hp: 1200, atk: 48, def: 22, gold: 0, keyY: 1, keyB: 0, keyR: 0 },
  flags: { princess: false, win: false },
  floors: [],
  messages: [],
};

function damageForecast(hero, m) {
  const perHero = Math.max(1, hero.atk - m.def);
  const rounds = Math.ceil(m.hp / perHero);
  const perMonster = Math.max(0, m.atk - hero.def);
  return perMonster * Math.max(0, rounds - 1);
}

function buildFloor(n) {
  const map = Array.from({ length: SIZE }, () => Array(SIZE).fill(T.FLOOR));
  const monsters = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1 || (x % 4 === 0 && y % 4 === 0)) map[y][x] = T.WALL;
    }
  }

  const stairUp = { x: 1, y: 1 };
  const stairDown = { x: SIZE - 2, y: SIZE - 2 };
  if (n > 1) map[stairUp.y][stairUp.x] = T.STAIR_UP;
  if (n < 50) map[stairDown.y][stairDown.x] = T.STAIR_DOWN;

  const points = [
    [2, 2, T.KEY_Y], [3, 2, T.GEM_R], [2, 3, T.POTION],
    [6, 2, T.GEM_B], [9, 3, T.GOLD], [10, 2, T.KEY_B],
    [2, 6, T.DOOR_Y], [3, 6, T.GOLD], [5, 5, T.TRAP],
    [7, 7, T.DOOR_B], [8, 8, T.KEY_R], [10, 9, T.POTION],
  ];
  points.forEach(([x, y, t]) => {
    if (map[y][x] === T.FLOOR) map[y][x] = t;
  });

  if (n % 5 === 0) map[6][10] = T.SHOP;
  if (EVENT_TEXT[n]) map[10][1] = T.NPC;
  if (n % 10 === 0) map[4][9] = T.DOOR_R;

  const roster = n < 8 ? ['slime', 'bat'] : n < 16 ? ['bat', 'guard'] : n < 28 ? ['guard', 'knight'] : n < 40 ? ['knight', 'mage'] : ['mage', 'demon'];
  for (let i = 0; i < 8; i++) {
    const x = 2 + ((i * 3 + n) % 9);
    const y = 2 + ((i * 5 + n) % 9);
    if (map[y][x] === T.FLOOR) monsters.push({ x, y, type: roster[i % roster.length] });
  }

  if (n === 49) {
    map[6][6] = T.NPC;
  }
  if (n === 50) {
    monsters.push({ x: 6, y: 6, type: 'king', boss: true });
    map[stairDown.y][stairDown.x] = T.FLOOR;
  }

  return { map, monsters, visited: false };
}

function ensureFloors() {
  if (game.floors.length) return;
  for (let i = 1; i <= 50; i++) game.floors.push(buildFloor(i));
}

function floorData() { return game.floors[game.floor - 1]; }

function drawTile(x, y, tile) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(px, py, TILE, TILE);
  if (tile === T.WALL) { ctx.fillStyle = '#475569'; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); }
  if (tile === T.DOOR_Y) { ctx.fillStyle = '#eab308'; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); }
  if (tile === T.DOOR_B) { ctx.fillStyle = '#3b82f6'; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); }
  if (tile === T.DOOR_R) { ctx.fillStyle = '#ef4444'; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); }
  if (tile === T.KEY_Y || tile === T.KEY_B || tile === T.KEY_R) {
    ctx.fillStyle = tile === T.KEY_Y ? '#facc15' : tile === T.KEY_B ? '#60a5fa' : '#f87171';
    ctx.beginPath(); ctx.arc(px + 12, py + 16, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(px + 16, py + 14, 10, 4);
  }
  if (tile === T.GEM_R || tile === T.GEM_B) {
    ctx.fillStyle = tile === T.GEM_R ? '#fb7185' : '#93c5fd';
    ctx.beginPath(); ctx.moveTo(px + 16, py + 4); ctx.lineTo(px + 28, py + 16); ctx.lineTo(px + 16, py + 28); ctx.lineTo(px + 4, py + 16); ctx.closePath(); ctx.fill();
  }
  if (tile === T.POTION) { ctx.fillStyle = '#ef4444'; ctx.fillRect(px + 10, py + 8, 12, 16); }
  if (tile === T.STAIR_UP || tile === T.STAIR_DOWN) {
    ctx.fillStyle = '#94a3b8';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * 6, py + (tile === T.STAIR_UP ? 22 - i * 4 : 8 + i * 4), 6, 4);
  }
  if (tile === T.SHOP) { ctx.fillStyle = '#22d3ee'; ctx.fillRect(px + 6, py + 6, 20, 20); }
  if (tile === T.NPC) { ctx.fillStyle = '#fbbf24'; ctx.fillRect(px + 8, py + 8, 16, 16); }
  if (tile === T.TRAP) { ctx.fillStyle = '#f97316'; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4); }
  if (tile === T.GOLD) { ctx.fillStyle = '#fde047'; ctx.fillRect(px + 8, py + 8, 16, 16); }
}

function render() {
  const fd = floorData();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) drawTile(x, y, fd.map[y][x]);

  fd.monsters.forEach(m => {
    const color = MONSTERS[m.type].color;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(m.x * TILE + 16, m.y * TILE + 16, 11, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(game.hero.x * TILE + 7, game.hero.y * TILE + 7, 18, 18);

  const hereMonster = fd.monsters.find(m => Math.abs(m.x - game.hero.x) + Math.abs(m.y - game.hero.y) === 1);
  if (hereMonster) {
    const m = MONSTERS[hereMonster.type];
    const loss = damageForecast(game.hero, m);
    hint.textContent = `邻近怪物 ${m.name}，预计损失 HP：${Number.isFinite(loss) ? loss : '无法破防'}`;
  }

  statusPanel.innerHTML = [
    `楼层: ${game.floor}F / 50F`, `HP: ${game.hero.hp}`, `ATK: ${game.hero.atk}`, `DEF: ${game.hero.def}`,
    `金币: ${game.hero.gold}`, `黄钥匙: ${game.hero.keyY}`, `蓝钥匙: ${game.hero.keyB}`, `红钥匙: ${game.hero.keyR}`,
    `公主: ${game.flags.princess ? '已救出' : '未救出'}`,
  ].map(v => `<div class="line">${v}</div>`).join('');
}

function fightAt(x, y) {
  const fd = floorData();
  const idx = fd.monsters.findIndex(m => m.x === x && m.y === y);
  if (idx < 0) return false;
  const mon = fd.monsters[idx];
  const data = MONSTERS[mon.type];
  const loss = damageForecast(game.hero, data);
  if (!Number.isFinite(loss) || game.hero.hp <= loss) {
    hint.textContent = `打不过 ${data.name}，请先提升属性。`;
    return true;
  }
  game.hero.hp -= loss;
  game.hero.gold += data.gold;
  fd.monsters.splice(idx, 1);
  hint.textContent = `击败 ${data.name}，损失 ${loss} HP。`;
  if (mon.boss) {
    if (!game.flags.princess) {
      hint.textContent = '魔王嘲讽：先救公主再来！';
      game.hero.hp += loss;
      fd.monsters.push(mon);
      return true;
    }
    game.flags.win = true;
    showDialog('通关', '<p>你救出公主并击败魔王，佐为のタワー通关！</p>');
  }
  return true;
}

function move(dx, dy) {
  if (!overlay.classList.contains('hidden')) return;
  const nx = game.hero.x + dx, ny = game.hero.y + dy;
  const fd = floorData();
  if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return;
  if (fightAt(nx, ny)) return render();
  const tile = fd.map[ny][nx];
  if (tile === T.WALL) return;
  if (tile === T.DOOR_Y) { if (game.hero.keyY < 1) return; game.hero.keyY--; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.DOOR_B) { if (game.hero.keyB < 1) return; game.hero.keyB--; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.DOOR_R) { if (game.hero.keyR < 1) return; game.hero.keyR--; fd.map[ny][nx] = T.FLOOR; }

  game.hero.x = nx; game.hero.y = ny;

  if (tile === T.KEY_Y) { game.hero.keyY++; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.KEY_B) { game.hero.keyB++; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.KEY_R) { game.hero.keyR++; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.GEM_R) { game.hero.atk += 6; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.GEM_B) { game.hero.def += 6; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.POTION) { game.hero.hp += 220; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.GOLD) { game.hero.gold += 20 + game.floor * 2; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.TRAP) { game.hero.hp -= 60; hint.textContent = '踩到陷阱，HP -60'; }
  if (tile === T.SHOP) openShop();
  if (tile === T.NPC) handleNpc();

  if (tile === T.STAIR_UP && game.floor > 1) {
    game.floor--; game.hero.x = SIZE - 2; game.hero.y = SIZE - 2;
  }
  if (tile === T.STAIR_DOWN && game.floor < 50) {
    game.floor++; game.hero.x = 1; game.hero.y = 1;
  }

  if (game.hero.hp <= 0) showDialog('失败', '<p>你倒下了，建议读档重来。</p>');
  render();
}

function handleNpc() {
  if (game.floor === 49) {
    game.flags.princess = true;
    showDialog('公主', '<p>谢谢你救我！请前往 50F 击败魔王！</p>');
    return;
  }
  showDialog('NPC 对话', `<p>${EVENT_TEXT[game.floor] || '继续前进吧。'}</p>`);
}

function openShop() {
  showDialog('商店', `
    <div class="shop-list">
      <button onclick="window.__buy(80,'hp')">80 金币：HP +500</button>
      <button onclick="window.__buy(60,'atk')">60 金币：ATK +8</button>
      <button onclick="window.__buy(60,'def')">60 金币：DEF +8</button>
      <button onclick="window.__buy(45,'key')">45 金币：红钥匙 +1</button>
    </div>
  `);
}

window.__buy = (cost, type) => {
  if (game.hero.gold < cost) return;
  game.hero.gold -= cost;
  if (type === 'hp') game.hero.hp += 500;
  if (type === 'atk') game.hero.atk += 8;
  if (type === 'def') game.hero.def += 8;
  if (type === 'key') game.hero.keyR += 1;
  render();
};

function save(slot) {
  localStorage.setItem(`mota50_save_${slot}`, JSON.stringify(game));
  hint.textContent = `已保存到存档 ${slot}`;
}
function load(slot) {
  const raw = localStorage.getItem(`mota50_save_${slot}`);
  if (!raw) return;
  const parsed = JSON.parse(raw);
  Object.assign(game, parsed);
  hint.textContent = `已读取存档 ${slot}`;
  render();
}

function manualHtml() {
  return Object.entries(MONSTERS).map(([k, m]) => {
    const loss = damageForecast(game.hero, m);
    return `<div>${m.name} HP${m.hp}/ATK${m.atk}/DEF${m.def} 预计损耗:${Number.isFinite(loss) ? loss : '无法击败'}</div>`;
  }).join('');
}

function openMenu() {
  showDialog('菜单', `
    <div class="menu-list">
      <button onclick="window.__openManual()">怪物手册</button>
      <button onclick="window.__save(1)">存档 1</button>
      <button onclick="window.__save(2)">存档 2</button>
      <button onclick="window.__save(3)">存档 3</button>
      <button onclick="window.__load(1)">读档 1</button>
      <button onclick="window.__load(2)">读档 2</button>
      <button onclick="window.__load(3)">读档 3</button>
      <button onclick="window.__story()">剧情目标</button>
    </div>
  `);
}

window.__openManual = () => showDialog('怪物手册', manualHtml());
window.__save = save;
window.__load = load;
window.__story = () => showDialog('任务', '<p>穿越 1F~50F，收集钥匙与宝石，49F 救公主，50F 讨伐魔王。</p>');

function showDialog(title, bodyHtml) {
  panelTitle.textContent = title;
  panelBody.innerHTML = bodyHtml;
  overlay.classList.remove('hidden');
}
function closeDialog() { overlay.classList.add('hidden'); }

function bind() {
  document.querySelectorAll('.dpad button').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      if (dir === 'up') move(0, -1);
      if (dir === 'down') move(0, 1);
      if (dir === 'left') move(-1, 0);
      if (dir === 'right') move(1, 0);
    });
  });
  document.getElementById('btnMenu').addEventListener('click', openMenu);
  document.getElementById('btnCancel').addEventListener('click', closeDialog);
  document.getElementById('btnConfirm').addEventListener('click', () => {
    if (overlay.classList.contains('hidden')) openMenu();
    else closeDialog();
  });
  document.getElementById('panelClose').addEventListener('click', closeDialog);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') move(0, -1);
    if (e.key === 'ArrowDown') move(0, 1);
    if (e.key === 'ArrowLeft') move(-1, 0);
    if (e.key === 'ArrowRight') move(1, 0);
    if (e.key.toLowerCase() === 'm') openMenu();
    if (e.key === 'Escape') closeDialog();
  });
}

ensureFloors();
bind();
render();
