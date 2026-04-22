const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const WIDTH = 960;
const HEIGHT = 540;

const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const timerEl = document.getElementById("timer");
const ammoEl = document.getElementById("ammo");
const comboEl = document.getElementById("combo");

const gameOverlay = document.getElementById("gameOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const flashOverlay = document.getElementById("flashOverlay");

const GAME_DURATION_MS = 60000;
const BASE_LIFETIME_MS = 2600;
const SPAWN_BASE_MS = 950;
const SPAWN_MIN_MS = 340;
const MAX_AMMO = 6;
const RELOAD_MS = 1200;

let entities = [];
let particles = [];

let score = 0;
let highScore = Number(localStorage.getItem("neonCopHighScore") || 0);
let combo = 0;
let comboTimer = 0;
let ammo = MAX_AMMO;
let canShoot = true;
let isReloading = false;

let gameActive = false;
let gameStartTime = 0;
let lastFrameTime = 0;
let spawnTimer = 0;

let mouse = {
    x: WIDTH / 2,
    y: HEIGHT / 2
};

class Target {
    constructor(type, now, difficultyScale) {
        this.type = type;
        this.radius = type === "enemy" ? 26 : 24;
        this.x = this.radius + Math.random() * (WIDTH - this.radius * 2);
        this.y = 110 + Math.random() * (HEIGHT - 150);
        this.spawnTime = now;
        this.lifetime = Math.max(1200, BASE_LIFETIME_MS - difficultyScale * 520 + Math.random() * 380);
        this.pulse = Math.random() * Math.PI * 2;
    }

    get expired() {
        return performance.now() - this.spawnTime > this.lifetime;
    }

    draw(time) {
        const wobble = Math.sin(time * 0.01 + this.pulse) * 2.5;
        const bodyY = this.y + wobble;

        ctx.save();
        ctx.translate(this.x, bodyY);

        if (this.type === "enemy") {
            ctx.fillStyle = "#ff4d6d";
            ctx.strokeStyle = "#ffd1db";
        } else {
            ctx.fillStyle = "#2ff3e0";
            ctx.strokeStyle = "#d3fffb";
        }

        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#081320";
        ctx.beginPath();
        ctx.arc(-8, -4, 3, 0, Math.PI * 2);
        ctx.arc(8, -4, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        if (this.type === "enemy") {
            ctx.strokeStyle = "#081320";
            ctx.arc(0, 6, 8, 0.15 * Math.PI, 0.85 * Math.PI, false);
        } else {
            ctx.strokeStyle = "#081320";
            ctx.arc(0, 11, 8, 1.15 * Math.PI, 1.85 * Math.PI, true);
        }
        ctx.stroke();

        ctx.restore();

        // Spawn timer ring warns player before target despawns.
        const remaining = Math.max(0, 1 - (performance.now() - this.spawnTime) / this.lifetime);
        ctx.strokeStyle = this.type === "enemy" ? "rgba(255,77,109,0.7)" : "rgba(47,243,224,0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, bodyY, this.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
        ctx.stroke();
    }

    contains(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 26 + Math.random() * 20;
        this.color = color;
        this.size = 2 + Math.random() * 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.97;
        this.vy *= 0.97;
        this.life -= 1;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / 40);
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }

    get dead() {
        return this.life <= 0;
    }
}

function resizeCanvas() {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
}

function safeFetchScore(value) {
    fetch("/score", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ score: value })
    }).catch(() => {
        // Non-blocking: score route is optional for local game flow.
    });
}

function spawnTarget(now) {
    const elapsed = now - gameStartTime;
    const progress = Math.min(1, elapsed / GAME_DURATION_MS);
    const enemyChance = Math.min(0.82, 0.65 + progress * 0.17);
    const type = Math.random() < enemyChance ? "enemy" : "civilian";
    entities.push(new Target(type, now, progress));
}

function burstParticles(x, y, type) {
    const color = type === "enemy" ? "#ff4d6d" : "#2ff3e0";
    for (let i = 0; i < 20; i += 1) {
        particles.push(new Particle(x, y, color));
    }
}

function updateHud() {
    scoreEl.textContent = String(score);
    highScoreEl.textContent = String(highScore);
    timerEl.textContent = String(Math.max(0, Math.ceil((GAME_DURATION_MS - (performance.now() - gameStartTime)) / 1000)));
    ammoEl.textContent = isReloading ? "..." : String(ammo);
    comboEl.textContent = "x" + String(Math.max(1, combo));
}

function playTone(freq, duration, volume, type = "square") {
    const audioCtx = playTone.ctx || (playTone.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.value = volume;

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    oscillator.stop(audioCtx.currentTime + duration);
}

function shootSound(hitType) {
    playTone(220, 0.06, 0.08, "sawtooth");
    if (hitType === "enemy") {
        playTone(560, 0.08, 0.06, "square");
    } else if (hitType === "civilian") {
        playTone(140, 0.12, 0.06, "triangle");
    } else {
        playTone(300, 0.04, 0.04, "triangle");
    }
}

function reloadSound() {
    playTone(180, 0.07, 0.05, "square");
    setTimeout(() => playTone(280, 0.07, 0.05, "square"), 90);
}

function flashShot() {
    flashOverlay.classList.add("flash");
    setTimeout(() => flashOverlay.classList.remove("flash"), 70);
}

function doReload() {
    if (!gameActive || isReloading || ammo === MAX_AMMO) {
        return;
    }

    isReloading = true;
    canShoot = false;
    reloadSound();

    setTimeout(() => {
        ammo = MAX_AMMO;
        isReloading = false;
        canShoot = true;
        updateHud();
    }, RELOAD_MS);
}

function registerHit(target) {
    if (target.type === "enemy") {
        combo += 1;
        comboTimer = 1400;
        score += 10 * Math.max(1, Math.floor(combo / 3));
    } else {
        combo = 0;
        comboTimer = 0;
        score -= 20;
    }

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("neonCopHighScore", String(highScore));
    }

    burstParticles(target.x, target.y, target.type);
    safeFetchScore(score);
}

function handleShot(clientX, clientY) {
    if (!gameActive || !canShoot || isReloading) {
        return;
    }

    if (ammo <= 0) {
        playTone(110, 0.08, 0.05, "triangle");
        return;
    }

    ammo -= 1;
    flashShot();

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (WIDTH / rect.width);
    const y = (clientY - rect.top) * (HEIGHT / rect.height);
    mouse.x = x;
    mouse.y = y;

    let hitIndex = -1;
    for (let i = entities.length - 1; i >= 0; i -= 1) {
        if (entities[i].contains(x, y)) {
            hitIndex = i;
            break;
        }
    }

    if (hitIndex >= 0) {
        const hitType = entities[hitIndex].type;
        const hitTarget = entities.splice(hitIndex, 1)[0];
        registerHit(hitTarget);
        shootSound(hitType);
    } else {
        combo = 0;
        comboTimer = 0;
        shootSound("miss");
    }

    updateHud();

    if (ammo === 0) {
        doReload();
    }
}

function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#0a132b");
    gradient.addColorStop(0.5, "#111f3d");
    gradient.addColorStop(1, "#091018");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 40; i += 1) {
        const x = (i * 113 + time * 0.02) % WIDTH;
        const y = (i * 79) % HEIGHT;
        const w = 28 + (i % 4) * 12;
        const h = 10 + (i % 3) * 8;
        ctx.fillStyle = i % 2 === 0 ? "#2ff3e0" : "#ff4d6d";
        ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let y = 0; y < HEIGHT; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }
}

function drawCrosshair() {
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(20, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, -6);
    ctx.moveTo(0, 20);
    ctx.lineTo(0, 6);
    ctx.stroke();

    ctx.restore();
}

function gameOver() {
    gameActive = false;
    canShoot = false;

    overlayTitle.textContent = "MISSION OVER";
    overlayMessage.textContent = "Final Score: " + String(score) + " | High Score: " + String(highScore);
    gameOverlay.classList.add("active");

    startBtn.classList.add("hidden");
    restartBtn.classList.remove("hidden");

    safeFetchScore(score);
}

function resetGame() {
    entities = [];
    particles = [];

    score = 0;
    combo = 0;
    comboTimer = 0;
    ammo = MAX_AMMO;
    canShoot = true;
    isReloading = false;

    gameStartTime = performance.now();
    lastFrameTime = gameStartTime;
    spawnTimer = 120;

    gameActive = true;

    updateHud();
}

function tick(now) {
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    drawBackground(now);

    if (gameActive) {
        const elapsed = now - gameStartTime;
        const progress = Math.min(1, elapsed / GAME_DURATION_MS);

        spawnTimer -= delta;
        if (spawnTimer <= 0) {
            spawnTarget(now);
            const nextSpawn = SPAWN_BASE_MS - progress * (SPAWN_BASE_MS - SPAWN_MIN_MS);
            spawnTimer = nextSpawn + Math.random() * 260;
        }

        entities = entities.filter((entity) => !entity.expired);

        entities.forEach((entity) => entity.draw(now));

        particles.forEach((particle) => {
            particle.update();
            particle.draw();
        });
        particles = particles.filter((particle) => !particle.dead);

        if (combo > 0) {
            comboTimer -= delta;
            if (comboTimer <= 0) {
                combo = 0;
            }
        }

        updateHud();

        if (elapsed >= GAME_DURATION_MS) {
            gameOver();
        }
    } else {
        entities.forEach((entity) => entity.draw(now));
        particles.forEach((particle) => {
            particle.update();
            particle.draw();
        });
        particles = particles.filter((particle) => !particle.dead);
    }

    drawCrosshair();
    requestAnimationFrame(tick);
}

canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (WIDTH / rect.width);
    mouse.y = (event.clientY - rect.top) * (HEIGHT / rect.height);
});

canvas.addEventListener("mousedown", (event) => {
    if (event.button === 0) {
        handleShot(event.clientX, event.clientY);
    }
});

window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
        doReload();
    }
});

startBtn.addEventListener("click", () => {
    gameOverlay.classList.remove("active");
    resetGame();
});

restartBtn.addEventListener("click", () => {
    gameOverlay.classList.remove("active");
    restartBtn.classList.add("hidden");
    startBtn.classList.remove("hidden");
    resetGame();
});

window.addEventListener("resize", resizeCanvas);

highScoreEl.textContent = String(highScore);
updateHud();
resizeCanvas();
requestAnimationFrame(tick);
