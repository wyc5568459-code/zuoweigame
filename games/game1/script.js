const TOTAL_ROUNDS = 5;

const roundText = document.getElementById("roundText");
const statusText = document.getElementById("statusText");
const resultText = document.getElementById("resultText");
const startBtn = document.getElementById("startBtn");
const gameArea = document.getElementById("gameArea");
const target = document.getElementById("target");

let state = "idle";
let round = 0;
let delayTimer = null;
let reactionStart = 0;
const records = [];

function updateRoundText() {
  roundText.textContent = `当前回合：${round} / ${TOTAL_ROUNDS}`;
}

function hideTarget() {
  target.classList.add("hidden");
}

function clearWaitTimer() {
  if (delayTimer) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }
}

function placeTargetRandomly() {
  const areaRect = gameArea.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const maxX = Math.max(0, areaRect.width - targetRect.width);
  const maxY = Math.max(0, areaRect.height - targetRect.height);

  const x = Math.random() * maxX;
  const y = Math.random() * maxY;

  target.style.left = `${x}px`;
  target.style.top = `${y}px`;
}

function showTarget() {
  placeTargetRandomly();
  target.classList.remove("hidden");
  reactionStart = performance.now();
  state = "ready";
  statusText.textContent = "快点点击目标！";
}

function waitForTarget() {
  hideTarget();
  state = "waiting";
  statusText.textContent = "准备中… 目标将在 1~3 秒后出现";
  const delay = 1000 + Math.random() * 2000;
  delayTimer = setTimeout(showTarget, delay);
}

function finishGame() {
  state = "finished";
  hideTarget();
  const sum = records.reduce((total, value) => total + value, 0);
  const avg = Math.round(sum / records.length);
  statusText.textContent = `挑战结束！5 回合平均反应时间：${avg} ms`;
  resultText.textContent = "点击“重新开始”再来一次。";
  startBtn.disabled = false;
  startBtn.textContent = "重新开始";
}

function nextRound() {
  if (round >= TOTAL_ROUNDS) {
    finishGame();
    return;
  }

  round += 1;
  updateRoundText();
  waitForTarget();
}

function startGame() {
  clearWaitTimer();
  records.length = 0;
  round = 0;
  state = "idle";
  startBtn.disabled = true;
  startBtn.textContent = "游戏进行中";
  resultText.textContent = "";
  statusText.textContent = "游戏开始！请等待目标出现。";
  updateRoundText();
  nextRound();
}

startBtn.addEventListener("click", startGame);

target.addEventListener("click", () => {
  if (state !== "ready") {
    return;
  }

  const reaction = Math.round(performance.now() - reactionStart);
  records.push(reaction);
  resultText.textContent = `第 ${round} 回合：${reaction} ms`;
  statusText.textContent = "已记录本回合成绩。";
  hideTarget();
  clearWaitTimer();

  setTimeout(nextRound, 500);
});

gameArea.addEventListener("click", (event) => {
  if (event.target === target) {
    return;
  }

  if (state === "waiting") {
    clearWaitTimer();
    statusText.textContent = "太早了！本回合重试。";
    resultText.textContent = "请等目标出现后再点击。";
    setTimeout(waitForTarget, 700);
  }
});

window.addEventListener("beforeunload", clearWaitTimer);

updateRoundText();
