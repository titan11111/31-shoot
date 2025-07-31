// キャンバスとコンテキストの取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const healthDisplay = document.getElementById('health');
const stageDisplay = document.getElementById('stage');
const gameOverScreen = document.getElementById('game-over-screen');
const restartButton = document.getElementById('restart-button');
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnFire = document.getElementById('btn-fire');

// ゲームの状態変数
let gameRunning = true;
let score = 0;
let stage = 1;
let stageTimer = 0;
let boss = null;

// ボス画像の読み込み
const bossImage = new Image();
bossImage.src = 'boss.svg';

// ハート回復アイテム
let hearts = [];
const heartSVG = `<svg width="20" height="20" viewBox="0 0 32 29.6" xmlns="http://www.w3.org/2000/svg"><path d="M23.6 0c-2.9 0-5.6 1.2-7.6 3.1C13.9 1.2 11.2 0 8.4 0 3.8 0 0 3.8 0 8.4c0 9.5 16 21.2 16 21.2s16-11.7 16-21.2C32 3.8 28.2 0 23.6 0z" fill="#FF0000"/></svg>`;
const heartImage = createSVGImage(heartSVG);

// --- 背景用の星 ---
const stars = [];
function initStars() {
    stars.length = 0;
    for (let i = 0; i < 50; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 0.5 + 0.5
        });
    }
}

// --- 効果音再生 ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}
function playSE(type) {
    if (type === 'fire') playSound(600);
    else if (type === 'hit') playSound(250);
    else if (type === 'enemy') playSound(400);
}

// SVG文字列をImageオブジェクトに変換し再利用するキャッシュ関数
const svgCache = new Map();
function createSVGImage(svgString) {
    if (svgCache.has(svgString)) {
        return svgCache.get(svgString);
    }
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => URL.revokeObjectURL(url);
    img.src = url;
    svgCache.set(svgString, img);
    return img;
}

// Imageオブジェクトを描画するヘルパー関数
function renderImage(ctx, img, x, y, width, height) {
    if (img.complete) {
        ctx.drawImage(img, x, y, width, height);
    } else {
        img.onload = () => ctx.drawImage(img, x, y, width, height);
    }
}

// --- プレイヤーの設定 ---
const player = {
    x: 50,
    // 初期化時はキャンバスサイズが決まっていないため仮の値を設定
    y: 0,
    width: 60,
    height: 50,
    speed: 5,
    health: 100,
    bullets: [],
    fireRate: 10, // 弾の発射間隔 (フレーム数)
    fireCooldown: 0,
    bulletSpeed: 10,
    bulletDamage: 10,
    shieldActive: false,
    shieldDuration: 0,
    flashTimer: 0,
    shotType: 'normal',
    shotTimer: 0,
    // プレイヤーのSVG画像
    svg: `
        <svg width="60" height="50" viewBox="0 0 60 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 25L60 0L45 25L60 50L0 25Z" fill="#00BFFF"/>
            <path d="M10 25L40 10L35 25L40 40L10 25Z" fill="#ADD8E6"/>
            <circle cx="45" cy="25" r="5" fill="#FFD700"/>
        </svg>
    `
};
player.image = createSVGImage(player.svg);

// --- 敵の設定 ---
let enemies = [];
let enemySpawnTimer = 0;
const enemySpawnInterval = 120; // 敵の出現間隔 (フレーム数)
// 敵のSVG画像
const enemySVG = `
    <svg width="50" height="40" viewBox="0 0 50 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 20L50 0L40 20L50 40L0 20Z" fill="#FF4500"/>
        <circle cx="15" cy="10" r="5" fill="#FFD700"/>
        <circle cx="15" cy="30" r="5" fill="#FFD700"/>
    </svg>
`;
const fastEnemySVG = `
    <svg width="40" height="30" viewBox="0 0 40 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 15L40 0L30 15L40 30L0 15Z" fill="#00ff7f"/>
        <circle cx="12" cy="7" r="4" fill="#FFD700"/>
        <circle cx="12" cy="23" r="4" fill="#FFD700"/>
    </svg>
`;

const enemyTypes = [
    { width: 50, height: 40, speedMin: 1, speedMax: 3, health: 30, image: createSVGImage(enemySVG) },
    { width: 40, height: 30, speedMin: 3, speedMax: 5, health: 20, image: createSVGImage(fastEnemySVG) }
];

// --- パワーアップアイテムの設定 ---
let powerUps = [];
const powerUpSpawnInterval = 500; // パワーアップの出現間隔 (フレーム数)
let powerUpSpawnTimer = 0;
const powerUpTypes = {
    FIRE_RATE: {
        name: "Fire Rate Up",
        color: "#00FF00",
        effect: (p) => { p.fireRate = Math.max(5, p.fireRate - 2); console.log("Fire Rate Up!"); },
        svg: `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#00FF00"/><path d="M10 15H20M15 10V20" stroke="#000" stroke-width="2"/></svg>`
    },
    POWER_SHOT: {
        name: "Power Shot",
        color: "#FF00FF",
        effect: (p) => { p.bulletDamage += 5; console.log("Power Shot!"); },
        svg: `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#FF00FF"/><path d="M15 8V22M8 15H22" stroke="#000" stroke-width="2"/></svg>`
    },
    BLUE_BEAM: {
        name: "Beam",
        color: "#0000FF",
        effect: (p) => { p.shotType = 'beam'; p.shotTimer = 300; console.log("Beam!"); },
        svg: `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#0000FF"/><rect x="13" y="5" width="4" height="20" fill="#FFFFFF"/></svg>`
    },
    YELLOW_SPREAD: {
        name: "Spread",
        color: "#FFFF00",
        effect: (p) => { p.shotType = 'spread'; p.shotTimer = 300; console.log("Spread!"); },
        svg: `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#FFFF00"/><path d="M10 20L15 10L20 20" stroke="#000" stroke-width="2"/></svg>`
    },
    SHIELD: {
        name: "Shield",
        color: "#00FFFF",
        effect: (p) => { p.shieldActive = true; p.shieldDuration = 300; console.log("Shield Active!"); }, // 5秒間 (60fps * 5)
        svg: `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#00FFFF"/><path d="M15 5C10 5 7 10 7 15C7 20 10 25 15 25C20 25 23 20 23 15C23 10 20 5 15 5Z" fill="#000" fill-opacity="0.2"/></svg>`
    }
};

// 各パワーアップの画像をあらかじめ生成
for (const type of Object.values(powerUpTypes)) {
    type.image = createSVGImage(type.svg);
}

// --- キーボード入力の管理 ---
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// --- タッチ入力の管理 ---
function bindTouch(btn, code) {
    if (!btn) return;
    btn.addEventListener('touchstart', (e) => {
        keys[code] = true;
        e.preventDefault();
    });
    btn.addEventListener('touchend', (e) => {
        keys[code] = false;
        e.preventDefault();
    });
}

bindTouch(btnUp, 'ArrowUp');
bindTouch(btnDown, 'ArrowDown');
bindTouch(btnLeft, 'ArrowLeft');
bindTouch(btnRight, 'ArrowRight');
bindTouch(btnFire, 'Space');

// --- ゲームのリセット ---
function resetGame() {
    player.x = 50;
    // キャンバス中心にプレイヤーを配置
    player.y = canvas.height / 2 - player.height / 2;
    player.health = 100;
    player.bullets = [];
    player.fireRate = 10;
    player.fireCooldown = 0;
    player.bulletSpeed = 10;
    player.bulletDamage = 10;
    player.shieldActive = false;
    player.shieldDuration = 0;
    player.flashTimer = 0;
    player.shotType = 'normal';
    player.shotTimer = 0;

    enemies = [];
    enemySpawnTimer = 0;
    powerUps = [];
    powerUpSpawnTimer = 0;
    hearts = [];
    // 入力状態をリセットしてキー押下が残らないようにする
    for (const key in keys) {
        keys[key] = false;
    }
    score = 0;
    stage = 1;
    stageTimer = 0;
    boss = null;
    gameRunning = true;
    gameOverScreen.style.display = 'none';
    updateGameInfo();
    gameLoop();
}

// --- ゲーム情報の更新 ---
function updateGameInfo() {
    scoreDisplay.textContent = `スコア: ${score}`;
    healthDisplay.textContent = `体力: ${player.health}`;
    stageDisplay.textContent = `ステージ: ${stage}`;
}

// --- 衝突判定関数 ---
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

function spawnHeart(x, y) {
    if (Math.random() < 0.05) {
        hearts.push({ x, y, width: 20, height: 20, speed: 2 });
    }
}

// --- ゲームループ ---
function gameLoop() {
    if (!gameRunning) return;

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景のスクロール演出
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const star of stars) {
        star.x -= star.speed;
        if (star.x < 0) {
            star.x = canvas.width;
            star.y = Math.random() * canvas.height;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    // ステージタイマーとボス出現
    stageTimer++;
    if (!boss && stageTimer >= 10800) {
        boss = {
            x: canvas.width,
            y: canvas.height / 2 - 75,
            width: 150,
            height: 150,
            speed: 2,
            health: 200,
            image: bossImage
        };
    }

    // プレイヤーの移動
    if (keys['ArrowUp'] || keys['KeyW']) player.y = Math.max(0, player.y - player.speed);
    if (keys['ArrowDown'] || keys['KeyS']) player.y = Math.min(canvas.height - player.height, player.y + player.speed);
    if (keys['ArrowLeft'] || keys['KeyA']) player.x = Math.max(0, player.x - player.speed);
    if (keys['ArrowRight'] || keys['KeyD']) player.x = Math.min(canvas.width - player.width, player.x + player.speed);

    // プレイヤーの弾の発射
    if (keys['Space'] && player.fireCooldown <= 0 && player.shotType !== 'beam') {
        if (player.shotType === 'spread') {
            player.bullets.push({
                x: player.x + player.width,
                y: player.y + player.height / 2 - 2,
                width: 10,
                height: 4,
                vx: player.bulletSpeed,
                vy: -player.bulletSpeed / 2,
                damage: player.bulletDamage
            });
            player.bullets.push({
                x: player.x + player.width,
                y: player.y + player.height / 2 - 2,
                width: 10,
                height: 4,
                vx: player.bulletSpeed,
                vy: player.bulletSpeed / 2,
                damage: player.bulletDamage
            });
        } else {
            player.bullets.push({
                x: player.x + player.width,
                y: player.y + player.height / 2 - 2,
                width: 10,
                height: 4,
                vx: player.bulletSpeed,
                vy: 0,
                damage: player.bulletDamage
            });
        }
        player.fireCooldown = player.fireRate;
        playSE('fire');
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

    // ショットタイプのタイマー
    if (player.shotType !== 'normal') {
        player.shotTimer--;
        if (player.shotTimer <= 0) {
            player.shotType = 'normal';
        }
    }

    // ビームの描画
    let beamHitbox = null;
    if (player.shotType === 'beam') {
        beamHitbox = {
            x: player.x + player.width,
            y: player.y + player.height / 2 - 5,
            width: canvas.width - (player.x + player.width),
            height: 10
        };
        ctx.fillStyle = 'blue';
        ctx.fillRect(beamHitbox.x, beamHitbox.y, beamHitbox.width, beamHitbox.height);
    }

    // プレイヤーのシールド効果
    if (player.shieldActive) {
        player.shieldDuration--;
        if (player.shieldDuration <= 0) {
            player.shieldActive = false;
        }
        // シールドの視覚的な表示 (例: プレイヤーの周りに円を描く)
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // プレイヤーの描画
    renderImage(ctx, player.image, player.x, player.y, player.width, player.height);
    if (player.flashTimer > 0) {
        ctx.save();
        ctx.globalAlpha = player.flashTimer / 10;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        player.flashTimer--;
    }

    // 弾の更新と描画
    for (let i = player.bullets.length - 1; i >= 0; i--) {
        const bullet = player.bullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        ctx.fillStyle = 'yellow';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

        // 画面外に出たら削除
        if (bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            player.bullets.splice(i, 1);
        }
    }

    // 敵の生成
    if (!boss) {
        enemySpawnTimer++;
        if (enemySpawnTimer >= enemySpawnInterval) {
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            const r = Math.random();
            let moveType = 'straight';
            if (r > 0.66) moveType = 'zigzag';
            else if (r > 0.33) moveType = 'sine';
            enemies.push({
                x: canvas.width,
                y: Math.random() * (canvas.height - type.height),
                width: type.width,
                height: type.height,
                speed: Math.random() * (type.speedMax - type.speedMin) + type.speedMin,
                health: type.health,
                image: type.image,
                moveType,
                angle: 0,
                direction: 1
            });
            enemySpawnTimer = 0;
        }
    }

    // 敵の更新と描画
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        if (enemy.moveType === 'sine') {
            enemy.x -= enemy.speed;
            enemy.y += Math.sin(enemy.angle) * 2;
            enemy.angle += 0.1;
        } else if (enemy.moveType === 'zigzag') {
            enemy.x -= enemy.speed;
            enemy.y += enemy.direction * enemy.speed;
            if (enemy.y <= 0 || enemy.y + enemy.height >= canvas.height) enemy.direction *= -1;
        } else {
            enemy.x -= enemy.speed;
        }

        // 敵の描画
        renderImage(ctx, enemy.image, enemy.x, enemy.y, enemy.width, enemy.height);

        // 画面外に出たら削除
        if (enemy.x + enemy.width < 0) {
            enemies.splice(i, 1);
            continue; // 削除されたので次のループへ
        }

        // 敵とプレイヤーの衝突判定
        if (checkCollision(player, enemy)) {
            if (!player.shieldActive) {
                player.health -= 10; // 敵に触れるとダメージ
                updateGameInfo();
            }
            enemies.splice(i, 1); // 衝突した敵は削除
            if (player.health <= 0) {
                gameRunning = false;
                gameOverScreen.style.display = 'flex';
            }
            continue;
        }

        // ビームとの衝突判定
        if (beamHitbox && checkCollision(beamHitbox, enemy)) {
            enemy.health -= player.bulletDamage;
            if (enemy.health <= 0) {
                enemies.splice(i, 1);
                score += 10;
                updateGameInfo();
                playSE('enemy');
                spawnHeart(enemy.x, enemy.y);
                continue;
            }
        }

        // 敵と弾の衝突判定
        for (let j = player.bullets.length - 1; j >= 0; j--) {
            const bullet = player.bullets[j];
            if (checkCollision(bullet, enemy)) {
                enemy.health -= bullet.damage;
                player.bullets.splice(j, 1); // 衝突した弾は削除
                playSE('hit');

                if (enemy.health <= 0) {
                    enemies.splice(i, 1); // 敵を削除
                    score += 10; // スコア加算
                    updateGameInfo();
                    playSE('enemy');
                    spawnHeart(enemy.x, enemy.y);
                    break; // 敵が破壊されたので、この敵に対する弾のチェックは終了
                }
            }
        }
    }

    // ハートアイテムの更新と描画
    for (let i = hearts.length - 1; i >= 0; i--) {
        const heart = hearts[i];
        heart.x -= heart.speed;
        renderImage(ctx, heartImage, heart.x, heart.y, heart.width, heart.height);

        if (heart.x + heart.width < 0) {
            hearts.splice(i, 1);
            continue;
        }

        if (checkCollision(player, heart)) {
            player.health = Math.min(100, player.health + 10);
            hearts.splice(i, 1);
            player.flashTimer = 10;
            updateGameInfo();
        }
    }

    // パワーアップアイテムの生成
    powerUpSpawnTimer++;
    if (powerUpSpawnTimer >= powerUpSpawnInterval) {
        const types = Object.values(powerUpTypes);
        const randomType = types[Math.floor(Math.random() * types.length)];
        powerUps.push({
            x: canvas.width,
            y: Math.random() * (canvas.height - 30),
            width: 30,
            height: 30,
            speed: 2,
            type: randomType
        });
        powerUpSpawnTimer = 0;
    }

    // パワーアップアイテムの更新と描画
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.x -= powerUp.speed;

        // パワーアップの描画
        renderImage(ctx, powerUp.type.image, powerUp.x, powerUp.y, powerUp.width, powerUp.height);

        // 画面外に出たら削除
        if (powerUp.x + powerUp.width < 0) {
            powerUps.splice(i, 1);
            continue;
        }

        // プレイヤーとパワーアップの衝突判定
        if (checkCollision(player, powerUp)) {
            powerUp.type.effect(player); // 効果を適用
            powerUps.splice(i, 1); // 取得したパワーアップは削除
            player.flashTimer = 10;
            updateGameInfo();
        }
    }

    // ボスの更新と描画
    if (boss) {
        if (boss.x > canvas.width - boss.width - 50) {
            boss.x -= boss.speed;
        }
        renderImage(ctx, boss.image, boss.x, boss.y, boss.width, boss.height);

        if (checkCollision(player, boss)) {
            if (!player.shieldActive) {
                player.health -= 20;
                updateGameInfo();
            }
        }

        for (let j = player.bullets.length - 1; j >= 0; j--) {
            const bullet = player.bullets[j];
            if (checkCollision(bullet, boss)) {
                boss.health -= bullet.damage;
                player.bullets.splice(j, 1);
                playSE('hit');
            }
        }

        if (beamHitbox && checkCollision(beamHitbox, boss)) {
            boss.health -= player.bulletDamage;
        }

        if (boss.health <= 0) {
            spawnHeart(boss.x, boss.y);
            boss = null;
            stage++;
            stageTimer = 0;
        }
    }

    // ゲーム情報の更新
    updateGameInfo();

    // 次のフレームをリクエスト
    requestAnimationFrame(gameLoop);
}

// リスタートボタンのイベントリスナー
restartButton.addEventListener('click', resetGame);

// ウィンドウのロード時にゲームを開始
window.onload = function() {
    // キャンバスのサイズを初期化
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    initStars();
    // 初期化したサイズでゲームをリセット
    resetGame();
};

// ウィンドウのリサイズ時にキャンバスサイズを調整
window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    initStars();
    // プレイヤーの位置を再調整（画面中央に保つため）
    player.y = Math.min(canvas.height - player.height, Math.max(0, player.y));
    player.x = Math.min(canvas.width - player.width, Math.max(0, player.x));
});
