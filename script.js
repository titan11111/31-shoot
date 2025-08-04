// ビームシューターゲーム - script.js

// ゲーム要素の取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const lifeElement = document.getElementById('life');
const powerElement = document.getElementById('power');
const shieldElement = document.getElementById('shield');
const stageElement = document.getElementById('stage');
const gameContainer = document.getElementById('gameContainer');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

const STAGE_DURATION = 60 * 60; // 1 minute at 60 FPS

// ボス画像の読み込み
const bossImg = new Image();
bossImg.src = 'boss.svg';

// BGM
const bgm = new Audio('audio/Dreaming_Stargazer.mp3');
const bossBgm = new Audio('audio/Assault_of_enemy.mp3');
bgm.loop = true;
bossBgm.loop = true;

// ユーザー操作後にBGMを開始
let audioInitialized = false;
function initAudio() {
    if (!audioInitialized) {
        bgm.play().catch(() => {});
        audioInitialized = true;
    }
}
document.addEventListener('keydown', initAudio, { once: true });
document.addEventListener('touchstart', initAudio, { once: true });
document.addEventListener('mousedown', initAudio, { once: true });

// モバイル操作時の画面スクロールやズームを防止
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// ゲーム状態
let gameState = {
    playing: true,
    score: 0,
    life: 3,
    power: 1,
    frameCount: 0,
    stage: 1,
    stageFrame: 0,
    bossActive: false
};

// プレイヤー
let player = {
    x: canvas.width / 2 - 15,
    y: canvas.height - 80,
    width: 30,
    height: 30,
    speed: 5,
    shootCooldown: 0,
    shield: 0
};

// 配列の初期化
let bullets = [];
let beams = [];
let enemies = [];
let items = [];
let explosions = [];

// キー入力管理
let keys = {};
let touchButtons = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false
};

// イベントリスナー設定
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// タッチボタンの設定
document.getElementById('leftBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchButtons.left = true;
});
document.getElementById('leftBtn').addEventListener('touchend', (e) => {
    e.preventDefault();
    touchButtons.left = false;
});

document.getElementById('rightBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchButtons.right = true;
});
document.getElementById('rightBtn').addEventListener('touchend', (e) => {
    e.preventDefault();
    touchButtons.right = false;
});

document.getElementById('upBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchButtons.up = true;
});
document.getElementById('upBtn').addEventListener('touchend', (e) => {
    e.preventDefault();
    touchButtons.up = false;
});

document.getElementById('downBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchButtons.down = true;
});
document.getElementById('downBtn').addEventListener('touchend', (e) => {
    e.preventDefault();
    touchButtons.down = false;
});

document.getElementById('shootBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchButtons.shoot = true;
    if (player.shootCooldown <= 0) {
        shoot();
        player.shootCooldown = gameState.power === 4 ? 20 : 10;
    }
});
document.getElementById('shootBtn').addEventListener('touchend', (e) => {
    e.preventDefault();
    touchButtons.shoot = false;
});

// マウスボタンの設定
document.getElementById('leftBtn').addEventListener('mousedown', () => touchButtons.left = true);
document.getElementById('leftBtn').addEventListener('mouseup', () => touchButtons.left = false);
document.getElementById('rightBtn').addEventListener('mousedown', () => touchButtons.right = true);
document.getElementById('rightBtn').addEventListener('mouseup', () => touchButtons.right = false);
document.getElementById('upBtn').addEventListener('mousedown', () => touchButtons.up = true);
document.getElementById('upBtn').addEventListener('mouseup', () => touchButtons.up = false);
document.getElementById('downBtn').addEventListener('mousedown', () => touchButtons.down = true);
document.getElementById('downBtn').addEventListener('mouseup', () => touchButtons.down = false);
document.getElementById('shootBtn').addEventListener('mousedown', (e) => {
    e.preventDefault();
    touchButtons.shoot = true;
    if (player.shootCooldown <= 0) {
        shoot();
        player.shootCooldown = gameState.power === 4 ? 20 : 10;
    }
});
document.getElementById('shootBtn').addEventListener('mouseup', (e) => {
    e.preventDefault();
    touchButtons.shoot = false;
});

// リスタートボタン
restartBtn.addEventListener('click', restartGame);

// 弾丸クラス
class Bullet {
    constructor(x, y, dx, dy, color = '#ffff00') {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.width = 4;
        this.height = 8;
        this.color = color;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
    }
}

// ビームクラス
class Beam {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 8;
        this.height = canvas.height;
        this.duration = 15; // ビーム持続時間
    }

    update() {
        this.duration--;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(this.x - this.width/2, 0, this.width, canvas.height);
        
        // ビームの光エフェクト
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - this.width/2 - 2, 0, this.width + 4, canvas.height);
        ctx.restore();
    }
}

// 敵クラス
class Enemy {
    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type;
        if (type === 'boss') {
            this.width = 225;
            this.height = 225;
            const stage = gameState.stage;
            const hpTable = {1: 8, 2: 12, 3: 15};
            this.hp = hpTable[stage] || (8 + (stage - 1) * 3 + (stage > 1 ? 1 : 0));
            this.maxHp = this.hp;
            this.speed = 1 + stage * 0.5;
            this.bulletSpeed = 3 + stage;
            this.shootInterval = Math.max(20, 60 - stage * 5);
            this.shootCooldown = this.shootInterval;
            this.pattern = Math.floor(Math.random() * 3);
            this.attackPattern = Math.floor(Math.random() * 3);
            this.dx = this.speed; // for bouncing pattern
        } else {
            this.width = 25;
            this.height = 25;
            this.speed = 2;
            this.hp = 1;
            this.maxHp = this.hp;
            this.shootCooldown = 0;
        }
    }

    update() {
        if (this.type === 'boss') {
            if (this.y < 150) {
                this.y += this.speed;
            }
            const frame = gameState.frameCount;
            switch (this.pattern) {
                case 0:
                    // 横方向にサイン波移動
                    this.x += Math.sin(frame * 0.05) * (2 + gameState.stage);
                    break;
                case 1:
                    // 画面端で反射する左右移動
                    this.x += this.dx;
                    if (this.x < this.width / 2 || this.x > canvas.width - this.width / 2) {
                        this.dx *= -1;
                    }
                    break;
                case 2:
                    // 円を描くように移動
                    this.x = canvas.width / 2 + Math.sin(frame * 0.02) * (canvas.width / 2 - this.width / 2);
                    this.y = 100 + Math.cos(frame * 0.02) * 50;
                    break;
            }

            this.shootCooldown--;
            if (this.shootCooldown <= 0) {
                this.shoot();
                this.shootCooldown = this.shootInterval;
            }
        } else {
            this.y += this.speed;
        }
    }

    shoot() {
        const speed = this.bulletSpeed || 3;
        switch (this.attackPattern) {
            case 0:
                bullets.push(new Bullet(this.x, this.y + this.height / 2, 0, speed, '#ff4444'));
                break;
            case 1:
                bullets.push(new Bullet(this.x, this.y + this.height / 2, 0, speed, '#ff4444'));
                bullets.push(new Bullet(this.x, this.y + this.height / 2, -2, speed, '#ff4444'));
                bullets.push(new Bullet(this.x, this.y + this.height / 2, 2, speed, '#ff4444'));
                break;
            case 2:
                const angle = Math.atan2(player.y - (this.y + this.height / 2), player.x - this.x);
                bullets.push(new Bullet(this.x, this.y + this.height / 2, Math.cos(angle) * speed, Math.sin(angle) * speed, '#ff4444'));
                break;
        }
    }

    draw() {
        if (this.type === 'boss') {
            // ボス敵
            ctx.drawImage(bossImg, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

            // HPバー
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2 - 10, this.width, 4);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(
                this.x - this.width / 2,
                this.y - this.height / 2 - 10,
                this.width * (this.hp / this.maxHp),
                4
            );
        } else {
            // 通常敵
            ctx.fillStyle = '#ff6666';
            ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
        }
    }
}

// アイテムクラス
class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.type = type;
        this.speed = 2;
    }

    update() {
        this.y += this.speed;
    }

    draw() {
        if (this.type === 'power') {
            ctx.fillStyle = '#00ff00';
        } else if (this.type === 'shield') {
            ctx.fillStyle = '#00aaff';
        } else {
            ctx.fillStyle = '#00ff00';
        }
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);

        // アイテムマーク
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        const symbol = this.type === 'shield' ? '🛡️' : '🔺';
        ctx.fillText(symbol, this.x, this.y + 4);
    }
}

// 爆発エフェクトクラス
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                dx: (Math.random() - 0.5) * 8,
                dy: (Math.random() - 0.5) * 8,
                life: 20
            });
        }
    }

    update() {
        this.particles.forEach(particle => {
            particle.x += particle.dx;
            particle.y += particle.dy;
            particle.life--;
        });
        this.particles = this.particles.filter(particle => particle.life > 0);
    }

    draw() {
        this.particles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.life / 20;
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
            ctx.restore();
        });
    }

    isDead() {
        return this.particles.length === 0;
    }
}

// プレイヤーの移動
function updatePlayer() {
    // 移動処理
    if (keys['ArrowLeft'] || touchButtons.left) {
        player.x = Math.max(player.width/2, player.x - player.speed);
    }
    if (keys['ArrowRight'] || touchButtons.right) {
        player.x = Math.min(canvas.width - player.width/2, player.x + player.speed);
    }
    if (keys['ArrowUp'] || touchButtons.up) {
        player.y = Math.max(player.height/2, player.y - player.speed);
    }
    if (keys['ArrowDown'] || touchButtons.down) {
        player.y = Math.min(canvas.height - player.height/2, player.y + player.speed);
    }

    // 射撃処理
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }

    if ((keys['Space'] || touchButtons.shoot) && player.shootCooldown <= 0) {
        shoot();
        player.shootCooldown = gameState.power === 4 ? 20 : 10; // ビーム時は発射間隔が長い
    }
}

// 射撃システム
function shoot() {
    const power = gameState.power;
    
    if (power === 1) {
        // 1方向ショット
        bullets.push(new Bullet(player.x, player.y - player.height/2, 0, -8));
    } else if (power === 2) {
        // 2連ショット
        bullets.push(new Bullet(player.x - 8, player.y - player.height/2, 0, -8));
        bullets.push(new Bullet(player.x + 8, player.y - player.height/2, 0, -8));
    } else if (power === 3) {
        // 3方向ショット
        bullets.push(new Bullet(player.x, player.y - player.height/2, 0, -8));
        bullets.push(new Bullet(player.x - 10, player.y - player.height/2, -2, -8));
        bullets.push(new Bullet(player.x + 10, player.y - player.height/2, 2, -8));
    } else if (power >= 4) {
        // 最終形態：ビーム + 左右ショット
        beams.push(new Beam(player.x, player.y));
        bullets.push(new Bullet(player.x - 15, player.y - player.height/2, -1, -8));
        bullets.push(new Bullet(player.x + 15, player.y - player.height/2, 1, -8));
    }
}

// 敵の生成
function spawnEnemies() {
    if (!gameState.bossActive) {
        if (gameState.stageFrame % 60 === 0) {
            const x = Math.random() * (canvas.width - 50) + 25;
            enemies.push(new Enemy(x, -25));
        }

        if (gameState.stageFrame >= STAGE_DURATION) {
            enemies = [];
            const x = canvas.width / 2;
            enemies.push(new Enemy(x, -150, 'boss'));
            gameState.bossActive = true;
            bgm.pause();
            bossBgm.currentTime = 0;
            bossBgm.play();
        }
    }
}

// 当たり判定
function checkCollisions() {
    // プレイヤーの弾と敵の当たり判定
    bullets.forEach((bullet, bulletIndex) => {
        if (bullet.dy < 0) { // プレイヤーの弾のみ
            enemies.forEach((enemy, enemyIndex) => {
                if (Math.abs(bullet.x - enemy.x) < enemy.width/2 + bullet.width/2 &&
                    Math.abs(bullet.y - enemy.y) < enemy.height/2 + bullet.height/2) {
                    
                    enemy.hp--;
                    bullets.splice(bulletIndex, 1);
                    
                    if (enemy.hp <= 0) {
                        explosions.push(new Explosion(enemy.x, enemy.y));
                        gameState.score += enemy.type === 'boss' ? 100 : 10;

                        // アイテムドロップ
                        const rand = Math.random();
                        if (rand < 0.3) {
                            items.push(new Item(enemy.x, enemy.y, 'power'));
                        } else if (rand < 0.4) {
                            items.push(new Item(enemy.x, enemy.y, 'shield'));
                        }

                        enemies.splice(enemyIndex, 1);
                        if (enemy.type === 'boss') {
                            nextStage();
                        }
                    }
                }
            });
        }
    });

    // ビームと敵の当たり判定
    beams.forEach((beam) => {
        enemies.forEach((enemy, enemyIndex) => {
            if (Math.abs(beam.x - enemy.x) < enemy.width/2 + beam.width/2) {
                enemy.hp -= 2; // ビームは高威力
                
                if (enemy.hp <= 0) {
                    explosions.push(new Explosion(enemy.x, enemy.y));
                    gameState.score += enemy.type === 'boss' ? 100 : 10;

                    // アイテムドロップ
                    const rand = Math.random();
                    if (rand < 0.3) {
                        items.push(new Item(enemy.x, enemy.y, 'power'));
                    } else if (rand < 0.4) {
                        items.push(new Item(enemy.x, enemy.y, 'shield'));
                    }

                    enemies.splice(enemyIndex, 1);
                    if (enemy.type === 'boss') {
                        nextStage();
                    }
                }
            }
        });
    });

    // 敵の弾とプレイヤーの当たり判定
    bullets.forEach((bullet, bulletIndex) => {
        if (bullet.dy > 0) { // 敵の弾のみ
            if (Math.abs(bullet.x - player.x) < player.width/2 + bullet.width/2 &&
                Math.abs(bullet.y - player.y) < player.height/2 + bullet.height/2) {
                
                bullets.splice(bulletIndex, 1);
                if (player.shield > 0) {
                    player.shield--;
                    explosions.push(new Explosion(player.x, player.y));
                } else {
                    gameState.life--;
                    explosions.push(new Explosion(player.x, player.y));

                    if (gameState.life <= 0) {
                        gameOver();
                    }
                }
            }
        }
    });

    // 敵とプレイヤーの当たり判定
    enemies.forEach((enemy, enemyIndex) => {
        if (Math.abs(enemy.x - player.x) < enemy.width/2 + player.width/2 &&
            Math.abs(enemy.y - player.y) < enemy.height/2 + player.height/2) {

            if (player.shield > 0) {
                player.shield--;
                explosions.push(new Explosion(player.x, player.y));
                explosions.push(new Explosion(enemy.x, enemy.y));
                enemies.splice(enemyIndex, 1);
            } else {
                gameState.life--;
                explosions.push(new Explosion(player.x, player.y));
                explosions.push(new Explosion(enemy.x, enemy.y));
                enemies.splice(enemyIndex, 1);

                if (gameState.life <= 0) {
                    gameOver();
                }
            }
        }
    });

    // アイテムとプレイヤーの当たり判定
    items.forEach((item, itemIndex) => {
        if (Math.abs(item.x - player.x) < item.width/2 + player.width/2 &&
            Math.abs(item.y - player.y) < item.height/2 + player.height/2) {
            
            if (item.type === 'power' && gameState.power < 4) {
                gameState.power++;
            } else if (item.type === 'shield') {
                player.shield = 3;
            }
            items.splice(itemIndex, 1);
        }
    });
}

// ゲームオーバー
function gameOver() {
    gameState.playing = false;
    finalScoreElement.textContent = gameState.score;
    gameOverElement.classList.remove('hidden');
    bgm.pause();
    bossBgm.pause();
}

// ゲーム再開
function restartGame() {
    gameState = {
        playing: true,
        score: 0,
        life: 3,
        power: 1,
        frameCount: 0,
        stage: 1,
        stageFrame: 0,
        bossActive: false
    };
    
    player = {
        x: canvas.width / 2 - 15,
        y: canvas.height - 80,
        width: 30,
        height: 30,
        speed: 5,
        shootCooldown: 0,
        shield: 0
    };
    
    bullets = [];
    beams = [];
    enemies = [];
    items = [];
    explosions = [];
    gameOverElement.classList.add('hidden');
    bossBgm.pause();
    bossBgm.currentTime = 0;
    bgm.currentTime = 0;
    bgm.play();
}

function nextStage() {
    gameState.stage++;
    gameState.stageFrame = 0;
    gameState.bossActive = false;
    bossBgm.pause();
    bossBgm.currentTime = 0;
    bgm.currentTime = 0;
    bgm.play();
}

// UI更新
function updateUI() {
    scoreElement.textContent = `スコア: ${gameState.score}`;

    const hearts = '❤️'.repeat(gameState.life);
    lifeElement.textContent = `ライフ: ${hearts}`;

    powerElement.textContent = `パワー: ${gameState.power}${gameState.power >= 4 ? ' (MAX)' : ''}`;
    shieldElement.textContent = `バリア: ${player.shield}`;
    stageElement.textContent = `ステージ: ${gameState.stage}`;
}

// 描画
function draw() {
    // 画面クリア
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 星空背景
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
        const x = (i * 37) % canvas.width;
        const y = (i * 41 + gameState.frameCount) % canvas.height;
        ctx.fillRect(x, y, 1, 1);
    }

    // プレイヤー描画
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(player.x - player.width/2, player.y - player.height/2, player.width, player.height);

    if (player.shield > 0) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.width, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 機体の詳細
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(player.x - 2, player.y - player.height/2, 4, 10);

    // 弾丸描画
    bullets.forEach(bullet => bullet.draw());
    
    // ビーム描画
    beams.forEach(beam => beam.draw());

    // 敵描画
    enemies.forEach(enemy => enemy.draw());

    // アイテム描画
    items.forEach(item => item.draw());

    // 爆発描画
    explosions.forEach(explosion => explosion.draw());

    // ボス登場までのカウントダウン表示
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    if (!gameState.bossActive) {
        const remaining = Math.max(0, Math.ceil((STAGE_DURATION - gameState.stageFrame) / 60));
        ctx.fillText(`ボス登場まで: ${remaining}秒`, 10, 20);
    } else {
        ctx.fillText('ボス登場！', 10, 20);
    }
}

// メインゲームループ
function gameLoop() {
    if (gameState.playing) {
        gameState.frameCount++;
        if (!gameState.bossActive) {
            gameState.stageFrame++;
        }

        updatePlayer();
        spawnEnemies();
        
        // 弾丸更新
        bullets.forEach(bullet => bullet.update());
        bullets = bullets.filter(bullet => 
            bullet.y > -10 && bullet.y < canvas.height + 10 &&
            bullet.x > -10 && bullet.x < canvas.width + 10
        );
        
        // ビーム更新
        beams.forEach(beam => beam.update());
        beams = beams.filter(beam => beam.duration > 0);

        // 敵更新
        enemies.forEach(enemy => enemy.update());
        enemies = enemies.filter(enemy => enemy.y < canvas.height + 50);

        // アイテム更新
        items.forEach(item => item.update());
        items = items.filter(item => item.y < canvas.height + 50);

        // 爆発更新
        explosions.forEach(explosion => explosion.update());
        explosions = explosions.filter(explosion => !explosion.isDead());

        checkCollisions();
        updateUI();
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// ゲーム開始
gameLoop();
bgm.play().catch(() => {});

// 画面サイズに合わせてゲーム全体をスケーリング
function resizeGame() {
    gameContainer.style.transform = 'none';
    const rect = gameContainer.getBoundingClientRect();
    const scale = Math.min(
        window.innerWidth / rect.width,
        window.innerHeight / rect.height,
        1
    );
    gameContainer.style.transform = `scale(${scale})`;
}

window.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', resizeGame);
resizeGame();
