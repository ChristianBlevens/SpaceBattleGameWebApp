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
        
        // Create initial entities through factory
        this.createInitialEntities(entityFactory);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start game
        eventBus.emit('GAME_START');
        
        // Start first wave after delay
        this.time.delayedCall(2000, () => {
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
        
        // Enemy ship
        graphics.fillStyle(0xff0066, 1);
        graphics.fillTriangle(0, 0, 32, 8, 0, 16);
        graphics.generateTexture('enemy', 32, 16);
        graphics.clear();
        
        // Projectile
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('projectile', 8, 8);
        graphics.clear();
        
        // Powerup
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillRect(0, 0, 16, 16);
        graphics.generateTexture('powerup', 16, 16);
        graphics.clear();
        
        // Planet
        graphics.fillStyle(0x6666ff, 1);
        graphics.fillCircle(32, 32, 32);
        graphics.generateTexture('planet', 64, 64);
        graphics.clear();
        
        // Star
        graphics.fillStyle(0xffffaa, 1);
        graphics.fillCircle(64, 64, 64);
        graphics.generateTexture('star', 128, 128);
        
        graphics.destroy();
    }
    
    createInitialEntities(entityFactory) {
        // Create player
        const startX = GameConfig.world.width * 0.2;
        const startY = GameConfig.world.height * 0.5;
        const playerId = entityFactory.createPlayer(startX, startY);
        
        // Store player ID in game state
        this.gameInitializer.gameState.setPlayerId(playerId);
        
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
            const size = Phaser.Math.Pick(['small', 'medium']);
            
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
    
    handleUICommand(command) {
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
                    upgradeType: command.upgradeType
                });
            },
            sound: () => {
                this.sound.mute = !command.value;
                eventBus.emit('AUDIO_SET_MUTE', { muted: !command.value });
            }
        };
        
        if (commands[command.command]) {
            commands[command.command]();
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
                            waveInProgress: gameState.get('waves.waveInProgress'),
                            enemiesDefeated: gameState.get('waves.totalEnemies') - gameState.get('waves.enemiesRemaining'),
                            totalEnemies: gameState.get('waves.totalEnemies')
                        },
                        upgrades: abilitySystem.getAllUpgradeInfo()
                    };
                    
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