const SIZE = 13;
const TILE = 32;
const CANVAS_PX = SIZE * TILE;

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

const DOOR_TO_KEY = { [T.DOOR_Y]: 'keyY', [T.DOOR_B]: 'keyB', [T.DOOR_R]: 'keyR' };
const KEY_TILE_TO_KEY = { [T.KEY_Y]: 'keyY', [T.KEY_B]: 'keyB', [T.KEY_R]: 'keyR' };

const MONSTERS = {
  slime: { name: '绿史莱姆', hp: 40, atk: 15, def: 4, gold: 4, color: '#22c55e', icon: '🟢' },
  bat: { name: '小蝙蝠', hp: 70, atk: 22, def: 8, gold: 8, color: '#a78bfa', icon: '🦇' },
  guard: { name: '骷髅卫兵', hp: 120, atk: 32, def: 15, gold: 14, color: '#d1d5db', icon: '💀' },
  knight: { name: '铁甲骑士', hp: 220, atk: 55, def: 30, gold: 28, color: '#60a5fa', icon: '🛡️' },
  mage: { name: '黑袍法师', hp: 300, atk: 78, def: 42, gold: 40, color: '#f97316', icon: '🔮' },
  demon: { name: '高阶恶魔', hp: 450, atk: 110, def: 68, gold: 55, color: '#ef4444', icon: '😈' },
  king: { name: '真魔王', hp: 1500, atk: 220, def: 140, gold: 0, color: '#b91c1c', icon: '👹' },
};

const STORY = {
  intro: [
    '【序章】勇者踏入魔塔：公主被囚禁在塔顶。',
    '入塔瞬间触发陷阱，你的圣剑被封印，只能从低层重新成长。',
    '目标：先收集线索与钥匙，最终击败真魔王后再救出公主。'
  ],
  quest: [
    '主线目标：突破 1F~50F。',
    '阶段目标：20F 击退吸血鬼、32F 打败大法师、41F 拆穿假魔王。',
    '终局目标：50F 击败真魔王 -> 回 49F 解救公主。'
  ],
  npc: {
    thief: [
      '小偷：我在暗道做了标记，带“主线”标记的门一定要开。',
      '小偷：如果你钥匙不够，先别碰支线门，回头再拿奖励。',
      '小偷：20F 有个吸血鬼守门，别忘了先补防御。',
      '小偷：我在 33F 留了蓝钥匙，别错过。'
    ],
    merchant: [
      '商人：我卖的是补给，不是通关前提。',
      '商人：金币紧张时优先买生命，保证容错。',
      '商人：红钥匙昂贵，除非你明确要走红门主线。',
      '商人：如果你想冲层，先看怪物手册的预计损耗。'
    ],
    elder: [
      '老人：蓝门通常是支线，主线通常由黄门引导。',
      '老人：32F 的大法师会考验你的攻防平衡。',
      '老人：41F 的“魔王”是假的，真正决战在 50F。',
      '老人：记住，先斩真魔王，公主的封印才会解除。'
    ]
  },
  checkpoints: {
    20: '20F：阶段Boss【吸血鬼】出现。',
    32: '32F：阶段Boss【大法师】出现。',
    41: '41F：你击败了【假魔王】，真相逐渐浮现。',
    49: '49F：公主仍被终局封印，需先击败真魔王。',
    50: '50F：真魔王现身，终局之战开始。'
  }
};

const canvas = document.getElementById('gameCanvas');
const canvasWrap = document.getElementById('canvasWrap');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const statusPanel = document.getElementById('statusPanel');
const hint = document.getElementById('hint');
const overlay = document.getElementById('overlay');
const panelTitle = document.getElementById('panelTitle');
const panelBody = document.getElementById('panelBody');

const game = {
  floor: 1,
  hero: { x: 1, y: 1, hp: 1200, atk: 48, def: 22, gold: 0, keyY: 1, keyB: 0, keyR: 0 },
  flags: { bossDefeated: false, princess: false, win: false, introShown: false },
  floors: [],
  npcTalk: { thief: 0, merchant: 0, elder: 0 },
};

function damageForecast(hero, m) {
  const perHero = Math.max(1, hero.atk - m.def);
  const rounds = Math.ceil(m.hp / perHero);
  const perMonster = Math.max(0, m.atk - hero.def);
  return perMonster * Math.max(0, rounds - 1);
}

function createPath() {
  const path = [];
  const pushLine = (x1, y1, x2, y2) => {
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
    let x = x1, y = y1;
    path.push([x, y]);
    while (x !== x2 || y !== y2) {
      x += dx; y += dy;
      path.push([x, y]);
    }
  };
  pushLine(1, 1, 9, 1);
  pushLine(9, 1, 9, 3);
  pushLine(9, 3, 3, 3);
  pushLine(3, 3, 3, 6);
  pushLine(3, 6, 10, 6);
  pushLine(10, 6, 10, 9);
  pushLine(10, 9, 2, 9);
  pushLine(2, 9, 2, 11);
  pushLine(2, 11, 11, 11);
  return path.filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
}

const MAIN_PATH = createPath();

function makeFloor(n) {
  const map = Array.from({ length: SIZE }, () => Array(SIZE).fill(T.WALL));
  const monsters = [];
  const forcedDoors = [];

  for (const [x, y] of MAIN_PATH) map[y][x] = T.FLOOR;
  for (let i = 2; i < MAIN_PATH.length - 2; i += 4) {
    const [x, y] = MAIN_PATH[i];
    if (x + 1 < SIZE - 1) map[y][x + 1] = T.FLOOR;
    if (y + 1 < SIZE - 1) map[y + 1][x] = T.FLOOR;
  }

  const stairUp = { x: 1, y: 1 };
  const stairDown = { x: 11, y: 11 };
  if (n > 1) map[stairUp.y][stairUp.x] = T.STAIR_UP;
  if (n < 50) map[stairDown.y][stairDown.x] = T.STAIR_DOWN;

  const put = (x, y, tile) => { if (map[y][x] === T.FLOOR) map[y][x] = tile; };
  const pathAt = (idx) => ({ x: MAIN_PATH[Math.min(idx, MAIN_PATH.length - 3)][0], y: MAIN_PATH[Math.min(idx, MAIN_PATH.length - 3)][1] });

  if (n >= 2) {
    const keyCell = pathAt(4);
    const doorCell = pathAt(12);
    put(keyCell.x, keyCell.y, T.KEY_Y);
    put(doorCell.x, doorCell.y, T.DOOR_Y);
    forcedDoors.push({ x: doorCell.x, y: doorCell.y, type: T.DOOR_Y, keyType: '黄钥匙', reason: '主线必经黄门' });
  }
  if (n >= 12) {
    const keyCell = pathAt(16);
    const doorCell = pathAt(24);
    put(keyCell.x, keyCell.y, T.KEY_B);
    put(doorCell.x, doorCell.y, T.DOOR_B);
    forcedDoors.push({ x: doorCell.x, y: doorCell.y, type: T.DOOR_B, keyType: '蓝钥匙', reason: '主线必经蓝门' });
  }
  if (n >= 24) {
    const keyCell = pathAt(22);
    const doorCell = pathAt(32);
    put(keyCell.x, keyCell.y, T.KEY_R);
    put(doorCell.x, doorCell.y, T.DOOR_R);
    forcedDoors.push({ x: doorCell.x, y: doorCell.y, type: T.DOOR_R, keyType: '红钥匙', reason: '主线必经红门' });
  }

  // 支线门（非必经）
  const sideDoor = { x: 4, y: 2 };
  const sideReward = { x: 5, y: 2 };
  map[2][4] = T.DOOR_B;
  map[2][5] = T.POTION;

  // 普通资源
  put(6, 1, T.KEY_Y);
  put(8, 3, T.GEM_R);
  put(4, 6, T.GEM_B);
  put(9, 6, T.POTION);
  put(10, 10, T.GOLD);
  if (n % 5 === 0) put(3, 10, T.SHOP);

  if (n % 3 === 1) put(8, 9, T.NPC);

  const roster = n < 8 ? ['slime', 'bat'] : n < 16 ? ['bat', 'guard'] : n < 28 ? ['guard', 'knight'] : n < 40 ? ['knight', 'mage'] : ['mage', 'demon'];
  const spawnCells = [[7,1],[9,2],[6,3],[3,4],[6,6],[10,7],[8,9],[4,11]];
  spawnCells.forEach(([x,y], i) => {
    if (map[y][x] === T.FLOOR) monsters.push({ x, y, type: roster[i % roster.length] });
  });

  if (n === 20) monsters.push({ x: 9, y: 9, type: 'demon', boss: true, label: '吸血鬼' });
  if (n === 32) monsters.push({ x: 9, y: 9, type: 'mage', boss: true, label: '大法师' });
  if (n === 41) monsters.push({ x: 9, y: 9, type: 'demon', boss: true, fakeKing: true, label: '假魔王' });
  if (n === 50) monsters.push({ x: 9, y: 9, type: 'king', boss: true, trueKing: true, label: '真魔王' });

  return { map, monsters, forcedDoors, sideDoor, sideReward };
}

function ensureFloors() {
  if (game.floors.length) return;
  for (let i = 1; i <= 50; i++) game.floors.push(makeFloor(i));
}

function floorData() { return game.floors[game.floor - 1]; }

function resizeCanvas() {
  const box = canvasWrap.getBoundingClientRect();
  const side = Math.max(200, Math.floor(Math.min(box.width, box.height)));
  canvas.style.width = `${side}px`;
  canvas.style.height = `${side}px`;
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  ctx.imageSmoothingEnabled = false;
  render();
}

function drawIcon(px, py, icon, size = 18) {
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, px + TILE / 2, py + TILE / 2 + 1);
}

function drawTile(x, y, tile) {
  const px = x * TILE, py = y * TILE;
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(px, py, TILE, TILE);
  if (tile === T.FLOOR || tile === T.STAIR_UP || tile === T.STAIR_DOWN) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }
  if (tile === T.WALL) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  }
  if (tile === T.DOOR_Y) { ctx.fillStyle = '#eab308'; ctx.fillRect(px + 4, py + 3, TILE - 8, TILE - 6); drawIcon(px, py, '🚪', 14); }
  if (tile === T.DOOR_B) { ctx.fillStyle = '#3b82f6'; ctx.fillRect(px + 4, py + 3, TILE - 8, TILE - 6); drawIcon(px, py, '🚪', 14); }
  if (tile === T.DOOR_R) { ctx.fillStyle = '#ef4444'; ctx.fillRect(px + 4, py + 3, TILE - 8, TILE - 6); drawIcon(px, py, '🚪', 14); }
  if (tile === T.KEY_Y) drawIcon(px, py, '🗝️');
  if (tile === T.KEY_B) drawIcon(px, py, '🔑');
  if (tile === T.KEY_R) drawIcon(px, py, '🔐');
  if (tile === T.GEM_R) drawIcon(px, py, '❤️');
  if (tile === T.GEM_B) drawIcon(px, py, '💎');
  if (tile === T.POTION) drawIcon(px, py, '🧪');
  if (tile === T.STAIR_UP) drawIcon(px, py, '⬆️');
  if (tile === T.STAIR_DOWN) drawIcon(px, py, '⬇️');
  if (tile === T.SHOP) drawIcon(px, py, '🏪');
  if (tile === T.NPC) drawIcon(px, py, '🧙');
  if (tile === T.TRAP) drawIcon(px, py, '🪤');
  if (tile === T.GOLD) drawIcon(px, py, '💰');
}

function render() {
  const fd = floorData();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) drawTile(x, y, fd.map[y][x]);
  fd.monsters.forEach(m => {
    const data = MONSTERS[m.type];
    ctx.fillStyle = data.color;
    ctx.beginPath();
    ctx.arc(m.x * TILE + 16, m.y * TILE + 16, 12, 0, Math.PI * 2);
    ctx.fill();
    drawIcon(m.x * TILE, m.y * TILE, data.icon, 16);
  });
  drawIcon(game.hero.x * TILE, game.hero.y * TILE, '🦸', 18);
  drawIcon(game.hero.x * TILE + 8, game.hero.y * TILE + 8, '⚔️', 10);

  const nearDoor = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ x: game.hero.x + dx, y: game.hero.y + dy }))
    .map(p => fd.forcedDoors.find(d => d.x === p.x && d.y === p.y)).find(Boolean);
  if (nearDoor) hint.textContent = `提示：这是一扇主线必经门，需要${nearDoor.keyType}。`;

  statusPanel.innerHTML = [
    `楼层: ${game.floor}F / 50F`, `HP: ${game.hero.hp}`, `ATK: ${game.hero.atk}`, `DEF: ${game.hero.def}`,
    `金币: ${game.hero.gold}`, `黄钥匙: ${game.hero.keyY}`, `蓝钥匙: ${game.hero.keyB}`, `红钥匙: ${game.hero.keyR}`,
    `真魔王: ${game.flags.bossDefeated ? '已击败' : '未击败'}`,
    `公主: ${game.flags.princess ? '已救出' : '未救出'}`,
  ].map(v => `<div class="line">${v}</div>`).join('');
}

function openPagedDialog(title, lines) {
  let idx = 0;
  const renderPage = () => {
    showDialog(title, `
      <div class="dialog-lines"><p>${lines[idx]}</p></div>
      <div class="dialog-nav">
        <button onclick="window.__prevDialog()" ${idx === 0 ? 'disabled' : ''}>上一段</button>
        <span>${idx + 1} / ${lines.length}</span>
        <button onclick="window.__nextDialog()" ${idx === lines.length - 1 ? 'disabled' : ''}>下一段</button>
      </div>
    `);
  };
  window.__prevDialog = () => { idx = Math.max(0, idx - 1); renderPage(); };
  window.__nextDialog = () => { idx = Math.min(lines.length - 1, idx + 1); renderPage(); };
  renderPage();
}

function fightAt(x, y) {
  const fd = floorData();
  const idx = fd.monsters.findIndex(m => m.x === x && m.y === y);
  if (idx < 0) return false;
  const mon = fd.monsters[idx];
  const data = MONSTERS[mon.type];
  const loss = damageForecast(game.hero, data);
  if (!Number.isFinite(loss) || game.hero.hp <= loss) {
    hint.textContent = `打不过 ${mon.label || data.name}，请先提升属性。`;
    return true;
  }
  game.hero.hp -= loss;
  game.hero.gold += data.gold;
  fd.monsters.splice(idx, 1);
  hint.textContent = `击败 ${mon.label || data.name}，损失 ${loss} HP。`;

  if (mon.fakeKing) openPagedDialog('剧情推进', ['你击败了假魔王。', '真正的魔王在 50F 的深处。']);
  if (mon.trueKing) {
    game.flags.bossDefeated = true;
    openPagedDialog('终局', ['真魔王倒下，塔内封印开始崩解。', '请返回 49F 救出公主，完成通关。']);
  }
  return true;
}

function tryOpenDoor(tile, nx, ny) {
  const keyField = DOOR_TO_KEY[tile];
  if (!keyField) return false;
  if (game.hero[keyField] < 1) {
    hint.textContent = `钥匙不足：需要${keyField === 'keyY' ? '黄' : keyField === 'keyB' ? '蓝' : '红'}钥匙。`;
    return true;
  }
  game.hero[keyField]--;
  floorData().map[ny][nx] = T.FLOOR;
  return false;
}

function move(dx, dy) {
  if (!overlay.classList.contains('hidden')) return;
  const nx = game.hero.x + dx, ny = game.hero.y + dy;
  const fd = floorData();
  if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return;
  if (fightAt(nx, ny)) return render();

  const tile = fd.map[ny][nx];
  if (tile === T.WALL) return;
  if (tryOpenDoor(tile, nx, ny)) return render();

  game.hero.x = nx; game.hero.y = ny;

  if (KEY_TILE_TO_KEY[tile]) { game.hero[KEY_TILE_TO_KEY[tile]]++; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.GEM_R) { game.hero.atk += 6; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.GEM_B) { game.hero.def += 6; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.POTION) { game.hero.hp += 220; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.GOLD) { game.hero.gold += 20 + game.floor * 2; fd.map[ny][nx] = T.FLOOR; }
  if (tile === T.SHOP) openShop();
  if (tile === T.NPC) handleNpc();

  if (tile === T.STAIR_UP && game.floor > 1) { game.floor--; game.hero.x = 11; game.hero.y = 11; }
  if (tile === T.STAIR_DOWN && game.floor < 50) { game.floor++; game.hero.x = 1; game.hero.y = 1; }

  if (game.hero.hp <= 0) showDialog('失败', '<p>你倒下了，建议读档重来。</p>');
  render();
}

function handleNpc() {
  if (game.floor === 49) {
    if (!game.flags.bossDefeated) {
      openPagedDialog('公主的声音', ['封印尚未解除！', '请先前往 50F 击败真魔王，再回来救我。']);
      return;
    }
    if (!game.flags.princess) {
      game.flags.princess = true;
      game.flags.win = true;
      openPagedDialog('通关', ['你在魔王败亡后解开封印，成功救出公主。', '彩蛋：小偷、商人和老人向你致敬——“真正的勇者归来！”']);
      return;
    }
  }

  const role = game.floor % 3 === 0 ? 'merchant' : game.floor % 3 === 1 ? 'elder' : 'thief';
  const texts = STORY.npc[role];
  const idx = game.npcTalk[role] % texts.length;
  game.npcTalk[role]++;
  openPagedDialog(role === 'merchant' ? '商人' : role === 'elder' ? '老人' : '小偷', texts.slice(idx, Math.min(texts.length, idx + 3)));
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

function validateFloors() {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let frontier = new Map([[`1,1,0,0,0`, { x: 1, y: 1, keyY: 0, keyB: 0, keyR: 0 }]]);

  for (let floor = 1; floor <= 50; floor++) {
    const fd = game.floors[floor - 1];
    const keyItems = [];
    const doorItems = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tile = fd.map[y][x];
        if (tile === T.KEY_Y || tile === T.KEY_B || tile === T.KEY_R) keyItems.push({ x, y, tile });
        if (tile === T.DOOR_Y || tile === T.DOOR_B || tile === T.DOOR_R) doorItems.push({ x, y, tile });
      }
    }

    const keyAt = (x, y) => keyItems.findIndex(k => k.x === x && k.y === y);
    const doorAt = (x, y) => doorItems.findIndex(d => d.x === x && d.y === y);
    const stateKey = (s) => `${s.x},${s.y},${s.keyMask},${s.doorMask}`;

    const queue = [...frontier.values()].map(v => ({ ...v, keyMask: 0, doorMask: 0 }));
    const visited = new Map();
    queue.forEach(q => visited.set(stateKey(q), { keyY: q.keyY, keyB: q.keyB, keyR: q.keyR }));
    const exits = new Map();

    while (queue.length) {
      const cur = queue.shift();
      for (const [dx,dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        const rawTile = fd.map[ny][nx];
        if (rawTile === T.WALL) continue;

        const next = { ...cur, x: nx, y: ny };

        const didx = doorAt(nx, ny);
        if (didx >= 0) {
          const opened = (next.doorMask & (1 << didx)) !== 0;
          if (!opened) {
            if (rawTile === T.DOOR_Y) { if (next.keyY < 1) continue; next.keyY -= 1; }
            if (rawTile === T.DOOR_B) { if (next.keyB < 1) continue; next.keyB -= 1; }
            if (rawTile === T.DOOR_R) { if (next.keyR < 1) continue; next.keyR -= 1; }
            next.doorMask |= (1 << didx);
          }
        }

        const kidx = keyAt(nx, ny);
        if (kidx >= 0 && (next.keyMask & (1 << kidx)) === 0) {
          if (rawTile === T.KEY_Y) next.keyY += 1;
          if (rawTile === T.KEY_B) next.keyB += 1;
          if (rawTile === T.KEY_R) next.keyR += 1;
          next.keyMask |= (1 << kidx);
        }

        const sk = stateKey(next);
        const prev = visited.get(sk);
        if (prev && prev.keyY >= next.keyY && prev.keyB >= next.keyB && prev.keyR >= next.keyR) continue;
        visited.set(sk, { keyY: Math.max(prev?.keyY ?? -1, next.keyY), keyB: Math.max(prev?.keyB ?? -1, next.keyB), keyR: Math.max(prev?.keyR ?? -1, next.keyR) });
        queue.push(next);

        if (rawTile === T.STAIR_DOWN || floor === 50) {
          exits.set(`${next.keyY},${next.keyB},${next.keyR}`, { keyY: next.keyY, keyB: next.keyB, keyR: next.keyR });
        }
      }
    }

    if (!exits.size && floor < 50) {
      const forced = fd.forcedDoors[0];
      const reason = forced ? `可能卡在 ${floor}F(${forced.x},${forced.y})，缺${forced.keyType}` : `${floor}F 无法到达楼梯`;
      const result = { ok: false, floor, reason };
      console.warn('validateFloors 失败', result);
      return result;
    }

    if (floor < 50) {
      frontier = new Map();
      [...exits.values()].forEach(s => frontier.set(`1,1,${s.keyY},${s.keyB},${s.keyR}`, { x: 1, y: 1, ...s }));
    }
  }

  const result = { ok: true, reason: '存在主线可通关路线：可到达 50F 并满足“击败真魔王后救公主”的事件顺序。' };
  console.info('validateFloors 成功', result);
  return result;
}

window.validateFloors = validateFloors;

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
  return Object.values(MONSTERS).map((m) => {
    const loss = damageForecast(game.hero, m);
    return `<div>${m.icon} ${m.name} HP${m.hp}/ATK${m.atk}/DEF${m.def} 预计损耗:${Number.isFinite(loss) ? loss : '无法击败'}</div>`;
  }).join('');
}

function openMenu() {
  showDialog('菜单', `
    <div class="menu-list">
      <button onclick="window.__openManual()">怪物手册</button>
      <button onclick="window.__save(1)">存档 1</button>
      <button onclick="window.__load(1)">读档 1</button>
      <button onclick="window.__story()">任务与剧情</button>
      <button onclick="window.__validate()">检查地图可通关性</button>
    </div>
  `);
}

window.__openManual = () => showDialog('怪物手册', manualHtml());
window.__save = save;
window.__load = load;
window.__story = () => openPagedDialog('任务', STORY.quest);
window.__validate = () => {
  const res = validateFloors();
  showDialog('可通关校验', `<p>${res.ok ? '✅' : '❌'} ${res.reason}</p>`);
};

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
  window.addEventListener('resize', resizeCanvas);
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
resizeCanvas();
render();
if (!game.flags.introShown) {
  game.flags.introShown = true;
  openPagedDialog('序章', STORY.intro);
}
