// キャンバスとコンテキストの取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const healthDisplay = document.getElementById('health');
const gameOverScreen = document.getElementById('game-over-screen');
const restartButton = document.getElementById('restart-button');

// ゲームの状態変数
let gameRunning = true;
let score = 0;

// SVGをCanvasに描画するためのヘルパー関数
function drawSVG(ctx, svgString, x, y, width, height, callback) {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        ctx.drawImage(img, x, y, width, height);
        URL.revokeObjectURL(url); // メモリリーク防止
        if (callback) callback();
    };
    img.onerror = (e) => {
        console.error("SVG画像の読み込みエラー:", e);
        URL.revokeObjectURL(url);
    };
    img.src = url;
}

// --- プレイヤーの設定 ---
const player = {
    x: 50,
    y: canvas.height / 2 - 25,
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
    // プレイヤーのSVG画像
    svg: `
        <svg width="60" height="50" viewBox="0 0 60 50" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 25L60 0L45 25L60 50L0 25Z" fill="#00BFFF"/>
            <path d="M10 25L40 10L35 25L40 40L10 25Z" fill="#ADD8E6"/>
            <circle cx="45" cy="25" r="5" fill="#FFD700"/>
        </svg>
    `
};

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
    SHIELD: {
        name: "Shield",
        color: "#00FFFF",
        effect: (p) => { p.shieldActive = true; p.shieldDuration = 300; console.log("Shield Active!"); }, // 5秒間 (60fps * 5)
        svg: `<svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="12" fill="#00FFFF"/><path d="M15 5C10 5 7 10 7 15C7 20 10 25 15 25C20 25 23 20 23 15C23 10 20 5 15 5Z" fill="#000" fill-opacity="0.2"/></svg>`
    }
};

// --- キーボード入力の管理 ---
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// --- ゲームのリセット ---
function resetGame() {
    player.x = 50;
    player.y = canvas.height / 2 - 25;
    player.health = 100;
    player.bullets = [];
    player.fireRate = 10;
    player.fireCooldown = 0;
    player.bulletSpeed = 10;
    player.bulletDamage = 10;
    player.shieldActive = false;
    player.shieldDuration = 0;

    enemies = [];
    enemySpawnTimer = 0;
    powerUps = [];
    powerUpSpawnTimer = 0;
    score = 0;
    gameRunning = true;
    gameOverScreen.style.display = 'none';
    updateGameInfo();
    gameLoop();
}

// --- ゲーム情報の更新 ---
function updateGameInfo() {
    scoreDisplay.textContent = `スコア: ${score}`;
    healthDisplay.textContent = `体力: ${player.health}`;
}

// --- 衝突判定関数 ---
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// --- ゲームループ ---
function gameLoop() {
    if (!gameRunning) return;

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景のスクロール (ここでは簡略化)
    // 実際のゲームでは、背景画像をスクロールさせるロジックを追加します。
    ctx.fillStyle = '#1a1a1a'; // 暗い背景色
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // プレイヤーの移動
    if (keys['ArrowUp'] || keys['KeyW']) player.y = Math.max(0, player.y - player.speed);
    if (keys['ArrowDown'] || keys['KeyS']) player.y = Math.min(canvas.height - player.height, player.y + player.speed);
    if (keys['ArrowLeft'] || keys['KeyA']) player.x = Math.max(0, player.x - player.speed);
    if (keys['ArrowRight'] || keys['KeyD']) player.x = Math.min(canvas.width - player.width, player.x + player.speed);

    // プレイヤーの弾の発射
    if (keys['Space'] && player.fireCooldown <= 0) {
        player.bullets.push({
            x: player.x + player.width,
            y: player.y + player.height / 2 - 2,
            width: 10,
            height: 4,
            speed: player.bulletSpeed,
            damage: player.bulletDamage
        });
        player.fireCooldown = player.fireRate;
    }
    if (player.fireCooldown > 0) player.fireCooldown--;

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
    drawSVG(ctx, player.svg, player.x, player.y, player.width, player.height);

    // 弾の更新と描画
    for (let i = player.bullets.length - 1; i >= 0; i--) {
        const bullet = player.bullets[i];
        bullet.x += bullet.speed;
        ctx.fillStyle = 'yellow';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

        // 画面外に出たら削除
        if (bullet.x > canvas.width) {
            player.bullets.splice(i, 1);
        }
    }

    // 敵の生成
    enemySpawnTimer++;
    if (enemySpawnTimer >= enemySpawnInterval) {
        enemies.push({
            x: canvas.width,
            y: Math.random() * (canvas.height - 40),
            width: 50,
            height: 40,
            speed: Math.random() * 2 + 1, // 1から3のランダムな速度
            health: 30
        });
        enemySpawnTimer = 0;
    }

    // 敵の更新と描画
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.x -= enemy.speed;

        // 敵の描画
        drawSVG(ctx, enemySVG, enemy.x, enemy.y, enemy.width, enemy.height);

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

        // 敵と弾の衝突判定
        for (let j = player.bullets.length - 1; j >= 0; j--) {
            const bullet = player.bullets[j];
            if (checkCollision(bullet, enemy)) {
                enemy.health -= bullet.damage;
                player.bullets.splice(j, 1); // 衝突した弾は削除

                if (enemy.health <= 0) {
                    enemies.splice(i, 1); // 敵を削除
                    score += 10; // スコア加算
                    updateGameInfo();
                    break; // 敵が破壊されたので、この敵に対する弾のチェックは終了
                }
            }
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
        drawSVG(ctx, powerUp.type.svg, powerUp.x, powerUp.y, powerUp.width, powerUp.height);

        // 画面外に出たら削除
        if (powerUp.x + powerUp.width < 0) {
            powerUps.splice(i, 1);
            continue;
        }

        // プレイヤーとパワーアップの衝突判定
        if (checkCollision(player, powerUp)) {
            powerUp.type.effect(player); // 効果を適用
            powerUps.splice(i, 1); // 取得したパワーアップは削除
            updateGameInfo();
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
    player.y = canvas.height / 2 - player.height / 2; // プレイヤーの初期Y位置を中央に調整
    gameLoop();
};

// ウィンドウのリサイズ時にキャンバスサイズを調整
window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    // プレイヤーの位置を再調整（画面中央に保つため）
    player.y = Math.min(canvas.height - player.height, Math.max(0, player.y));
    player.x = Math.min(canvas.width - player.width, Math.max(0, player.x));
});
