// GameScene.js - Main game scene coordinator
// REFACTORED: Now acts purely as a coordinator, delegating all logic to systems

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
        
        // Game initializer will manage all systems
        this.gameInitializer = null;
        
        // Entity collections
        this.sprites = new Map();
        this.trails = new Map();
        this.enemyGroup = null;
        this.powerupGroup = null;
        this.projectileGroup = null;
    }
    
    preload() {
        // Create textures for the game
        this.createTextures();
    }
    
    create() {
        // Initialize collections
        this.sprites = new Map();
        this.trails = new Map();
        this.enemyGroup = this.add.group();
        this.powerupGroup = this.add.group();
        this.projectileGroup = this.add.group();
        
        // Configure physics world
        this.matter.world.setBounds(0, 0, GameConfig.world.width, GameConfig.world.height);
        this.matter.world.setGravity(0, 0);
        
        // Initialize game systems using GameInitializer
        this.gameInitializer = new GameInitializer(this);
        this.gameInitializer.initializeAllSystems();
        
        // Get references to core systems
        const { eventBus, renderSystem, waveSystem, entityFactory, audioManager } = this.gameInitializer;
        
        // Create environment through RenderSystem
        renderSystem.createEnvironment();
        
        // Set scene for entity factory
        entityFactory.setScene(this);
        
        // Create initial entities through factory
        this.createInitialEntities(entityFactory);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start game
        eventBus.emit('GAME_START');
        
        // Start first wave after delay
        this.time.delayedCall(2000, () => {
            console.log('[GameScene] Starting wave 1');
            // Ensure wave state is clean before starting
            this.gameInitializer.gameState.update('waves.waveInProgress', false);
            waveSystem.startWave(1);
        });
        
        // Start UI updates
        this.startUIUpdates();
        
        // Play music
        eventBus.emit('AUDIO_PLAY_MUSIC');
    }
    
    update(time, delta) {
        if (this.gameInitializer.gameState.get('game.paused')) return;
        
        const dt = delta / 1000;
        
        // Update all systems through initializer
        this.gameInitializer.updateAllSystems(dt);
        
        // Update game time
        const playTime = this.gameInitializer.gameState.get('game.playTime') + delta;
        this.gameInitializer.gameState.update('game.playTime', playTime);
    }
    
    createTextures() {
        // Create simple geometric textures
        const graphics = this.add.graphics();
        
        // Player ship (triangle)
        graphics.fillStyle(0x00ffff, 1);
        graphics.fillTriangle(0, 16, 32, 8, 0, 0);
        graphics.generateTexture('player', 32, 16);
        graphics.clear();
        
        // Enemy ship (generic)
        graphics.fillStyle(0xff0066, 1);
        graphics.fillTriangle(0, 0, 32, 8, 0, 16);
        graphics.generateTexture('enemy', 32, 16);
        graphics.clear();
        
        // Faction-specific enemy textures
        // Swarm enemy
        graphics.fillStyle(0xff6666, 1);
        graphics.fillTriangle(0, 0, 24, 6, 0, 12);
        graphics.generateTexture('enemy-swarm', 24, 12);
        graphics.clear();
        
        // Sentinel enemy
        graphics.fillStyle(0x66ff66, 1);
        graphics.fillRect(0, 0, 28, 20);
        graphics.generateTexture('enemy-sentinel', 28, 20);
        graphics.clear();
        
        // Phantom enemy
        graphics.fillStyle(0x9966ff, 1);
        graphics.fillTriangle(0, 8, 16, 0, 32, 8);
        graphics.fillTriangle(0, 8, 32, 8, 16, 16);
        graphics.generateTexture('enemy-phantom', 32, 16);
        graphics.clear();
        
        // Titan enemy
        graphics.fillStyle(0xff9966, 1);
        graphics.fillRect(0, 0, 40, 32);
        graphics.fillCircle(20, 16, 12);
        graphics.generateTexture('enemy-titan', 40, 32);
        graphics.clear();
        
        // Projectiles
        // Basic projectile
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('projectile', 8, 8);
        graphics.generateTexture('projectile-basic', 8, 8);
        graphics.clear();
        
        // Enemy projectile
        graphics.fillStyle(0xff6666, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('projectile-enemy', 8, 8);
        graphics.clear();
        
        // Charged projectile
        graphics.fillStyle(0x00ffff, 1);
        graphics.fillCircle(6, 6, 6);
        graphics.generateTexture('projectile-charged', 12, 12);
        graphics.clear();
        
        // Powerups
        // Health powerup
        graphics.fillStyle(0xff0000, 1);
        graphics.fillRect(6, 0, 4, 16);
        graphics.fillRect(0, 6, 16, 4);
        graphics.generateTexture('powerup-health', 16, 16);
        graphics.clear();
        
        // Energy powerup
        graphics.fillStyle(0x00ffff, 1);
        graphics.fillTriangle(8, 0, 0, 16, 16, 16);
        graphics.generateTexture('powerup-energy', 16, 16);
        graphics.clear();
        
        // Credits powerup
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(8, 8, 8);
        graphics.generateTexture('powerup-credits', 16, 16);
        graphics.clear();
        
        // Generic powerup
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillRect(0, 0, 16, 16);
        graphics.generateTexture('powerup', 16, 16);
        graphics.clear();
        
        // Planets
        // Small planet (40 radius)
        graphics.fillStyle(0x8888ff, 1);
        graphics.fillCircle(40, 40, 40);
        graphics.generateTexture('planet-small', 80, 80);
        graphics.clear();
        
        // Medium planet (60 radius)
        graphics.fillStyle(0x6666ff, 1);
        graphics.fillCircle(60, 60, 60);
        graphics.generateTexture('planet', 120, 120);
        graphics.generateTexture('planet-medium', 120, 120);
        graphics.clear();
        
        // Large planet (80 radius)
        graphics.fillStyle(0x4444ff, 1);
        graphics.fillCircle(80, 80, 80);
        graphics.generateTexture('planet-large', 160, 160);
        graphics.clear();
        
        // Star
        graphics.fillStyle(0xffffaa, 1);
        graphics.fillCircle(64, 64, 64);
        graphics.generateTexture('star', 128, 128);
        graphics.clear();
        
        // Vortex - spiral pattern
        const vortexSize = 128;
        const cx = vortexSize / 2;
        const cy = vortexSize / 2;
        
        // Create spiral effect
        for (let i = 0; i < 20; i++) {
            const angle = i * 0.5;
            const radius = i * 3;
            const alpha = 1 - (i / 20);
            
            graphics.lineStyle(4, 0xff00ff, alpha);
            graphics.beginPath();
            
            for (let j = 0; j < 50; j++) {
                const t = j / 50;
                const r = radius + t * 20;
                const a = angle + t * Math.PI * 2;
                const x = cx + Math.cos(a) * r;
                const y = cy + Math.sin(a) * r;
                
                if (j === 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }
            
            graphics.strokePath();
        }
        
        // Add center glow
        graphics.fillStyle(0xff00ff, 0.8);
        graphics.fillCircle(cx, cy, 15);
        graphics.fillStyle(0xffffff, 0.5);
        graphics.fillCircle(cx, cy, 8);
        
        graphics.generateTexture('vortex', vortexSize, vortexSize);
        
        graphics.destroy();
    }
    
    createInitialEntities(entityFactory) {
        // Create player
        const startX = GameConfig.world.width * 0.2;
        const startY = GameConfig.world.height * 0.5;
        const playerId = entityFactory.createPlayer(startX, startY);
        
        // Store player ID in game state and scene
        this.gameInitializer.gameState.setPlayerId(playerId);
        this.player = playerId;
        
        // Create orbital systems
        const orbitalSystems = [
            { x: GameConfig.world.centerX, y: GameConfig.world.centerY, planets: 5, size: 'large' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.25, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.25, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.75, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.75, planets: 3, size: 'medium' }
        ];
        
        orbitalSystems.forEach(system => {
            entityFactory.createOrbitalSystem(system.x, system.y, system.planets, system.size);
        });
        
        // Create wandering planets
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(1000, GameConfig.world.width - 1000);
            const y = Phaser.Math.Between(1000, GameConfig.world.height - 1000);
            const sizes = ['small', 'medium'];
			const size = sizes[Math.floor(Math.random() * sizes.length)];
            
            const planet = entityFactory.createPlanet(x, y, size);
            
            // Random velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(1, 3);
            const physics = this.gameInitializer.entityManager.getComponent(planet, 'physics');
            if (physics) {
                physics.velocity.x = Math.cos(angle) * speed;
                physics.velocity.y = Math.sin(angle) * speed;
            }
        }
        
        // Create single wandering catastrophe (combined vortex + spiral)
        const catastropheX = Phaser.Math.Between(2000, GameConfig.world.width - 2000);
        const catastropheY = Phaser.Math.Between(2000, GameConfig.world.height - 2000);
        this.catastropheId = entityFactory.createCatastrophe(catastropheX, catastropheY);
    }
    
    setupEventListeners() {
        const { eventBus, entityManager, entityFactory } = this.gameInitializer;
        
        // Game state events
        eventBus.on('GAME_PAUSE', (data) => {
            this.handlePause(data.paused);
        });
        
        // Wave events
        eventBus.on('WAVE_COMPLETE', () => {
            this.handleWaveComplete();
        });
        
        // Entity lifecycle events
        eventBus.on('DESTROY_ENTITY', (data) => {
            entityManager.destroyEntity(data.entityId);
        });
        
        // Powerup spawning
        eventBus.on('SPAWN_POWERUP', (data) => {
            entityFactory.createPowerup(data.x, data.y, data.type);
        });
        
        // UI commands
        window.addEventListener('gameCommand', (event) => {
            this.handleUICommand(event.detail);
        });
    }
    
    handlePause(paused) {
        this.gameInitializer.gameState.update('game.paused', paused);
        
        if (paused) {
            this.matter.world.pause();
        } else {
            this.matter.world.resume();
        }
    }
    
    handleWaveComplete() {
        const { gameState, combatSystem, waveSystem } = this.gameInitializer;
        const currentWave = gameState.get('waves.current');
        
        // Let CombatSystem handle rewards
        combatSystem.processWaveRewards(currentWave);
        
        // Start next wave after delay
        this.time.delayedCall(3000, () => {
            waveSystem.startWave(currentWave + 1);
        });
    }
    
    handleUICommand(data) {
        const { eventBus, gameState } = this.gameInitializer;
        
        const commands = {
            pause: () => {
                const paused = !gameState.get('game.paused');
                eventBus.emit('GAME_PAUSE', { paused });
            },
            restart: () => {
                this.scene.restart();
            },
            menu: () => {
                eventBus.emit('AUDIO_STOP_MUSIC');
                this.scene.start('Menu');
            },
            upgrade: () => {
                eventBus.emit('UPGRADE_REQUEST', {
                    upgradeType: data.upgradeType
                });
            },
            sound: () => {
                this.sound.mute = !data.value;
                eventBus.emit('AUDIO_SET_MUTE', { muted: !data.value });
            }
        };
        
        if (commands[data.command]) {
            commands[data.command]();
        }
    }
    
    startUIUpdates() {
        const { gameState, abilitySystem } = this.gameInitializer;
        
        // Update UI periodically
        this.time.addEvent({
            delay: 100,
            repeat: -1,
            callback: () => {
                if (!gameState.get('game.paused')) {
                    const waveInProgress = gameState.get('waves.waveInProgress');
                    const state = {
                        player: {
                            health: gameState.get('player.health'),
                            maxHealth: gameState.get('player.maxHealth'),
                            energy: gameState.get('player.energy'),
                            maxEnergy: gameState.get('player.maxEnergy'),
                            alive: gameState.get('player.alive')
                        },
                        game: {
                            credits: gameState.get('game.credits'),
                            score: gameState.get('game.score'),
                            combo: gameState.get('game.combo'),
                            comboTimer: gameState.get('game.comboTimer'),
                            paused: gameState.get('game.paused'),
                            gameOver: gameState.get('game.gameOver')
                        },
                        mission: {
                            currentWave: gameState.get('waves.current'),
                            waveInProgress: waveInProgress,
                            enemiesDefeated: gameState.get('waves.totalEnemies') - gameState.get('waves.enemiesRemaining'),
                            totalEnemies: gameState.get('waves.totalEnemies')
                        },
                        upgrades: abilitySystem.getAllUpgradeInfo()
                    };
                    
                    // Debug log wave state changes
                    if (this.lastWaveInProgress !== waveInProgress) {
                        console.log('[GameScene] Wave state changed:', this.lastWaveInProgress, '->', waveInProgress);
                        this.lastWaveInProgress = waveInProgress;
                    }
                    
                    // Add upgrade costs
                    const upgrades = {
                        damage: this.gameInitializer.upgradeSystem.getUpgradeCost('damage'),
                        speed: this.gameInitializer.upgradeSystem.getUpgradeCost('speed'),
                        defense: this.gameInitializer.upgradeSystem.getUpgradeCost('defense'),
                        energy: this.gameInitializer.upgradeSystem.getUpgradeCost('energy')
                    };
                    state.upgrades = upgrades;
                    
                    window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: state }));
                }
            }
        });
    }
    
    destroy() {
        // Clean up event listeners
        window.removeEventListener('gameCommand', this.handleUICommand);
        
        // Stop music
        this.gameInitializer.eventBus.emit('AUDIO_STOP_MUSIC');
        
        // Clear collections
        this.sprites.clear();
        this.trails.clear();
        
        // Destroy game initializer (which will clean up all systems)
        this.gameInitializer.destroy();
        
        // Clear UI messages
        this.gameInitializer.uiManager.destroy();
    }
}