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
        // Add game-active class to body for CSS styling
        document.body.classList.add('game-active');
        
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
        const { eventBus, renderSystem, waveSystem, entityFactory, audioManager, inputSystem } = this.gameInitializer;
        
        // Store inputSystem reference for RenderSystem
        this.inputSystem = inputSystem;
        
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
            // Initialize first wave
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
        // Texture creation is now handled by TextureGenerator in RenderSystem
        // This method is kept for compatibility but does nothing
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
            { x: GameConfig.world.centerX, y: GameConfig.world.centerY, planets: 5, type: 'jupiter' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.25, planets: 3, type: 'earth' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.25, planets: 3, type: 'saturn' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.75, planets: 3, type: 'toxic' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.75, planets: 3, type: 'neptune' }
        ];
        
        orbitalSystems.forEach(system => {
            entityFactory.createOrbitalSystem(system.x, system.y, system.planets, system.type);
        });
        
        // Create wandering planets with variety
        for (let i = 0; i < 25; i++) {
            const x = Phaser.Math.Between(1000, GameConfig.world.width - 1000);
            const y = Phaser.Math.Between(1000, GameConfig.world.height - 1000);
            
            // Use random planet profiles instead of just sizes
            const planet = entityFactory.createPlanet(x, y); // null = random profile
            
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
        
        // Minion spawning (from boss abilities)
        eventBus.on('SPAWN_MINION', (data) => {
            const minionId = entityFactory.createEnemy(data.faction, data.x, data.y, { x: 0, y: 0 }, data.scale || 1);
            if (minionId && data.isBossMinion) {
                const ai = entityManager.getComponent(minionId, 'ai');
                if (ai) {
                    ai.isBossMinion = true;
                }
            }
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
                // Don't allow pausing/unpausing if game is over
                if (gameState.get('game.gameOver')) return;
                
                const paused = !gameState.get('game.paused');
                eventBus.emit('GAME_PAUSE', { paused });
            },
            restart: () => {
                // Clear UI states before restarting
                gameState.update('game.paused', false);
                gameState.update('game.gameOver', false);
                
                // Directly update Alpine.js data
                const alpineData = Alpine.$data(document.querySelector('[x-data="gameUI"]'));
                if (alpineData) {
                    alpineData.paused = false;
                    alpineData.gameOver = false;
                }
                
                this.scene.restart();
            },
            menu: () => {
                // Reset the entire game state
                gameState.reset();
                
                // Stop the game properly before returning to menu
                eventBus.emit('AUDIO_STOP_MUSIC');
                this.matter.world.pause();
                this.scene.stop();
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
            },
            purchaseAbility: () => {
                eventBus.emit('PURCHASE_ABILITY', {
                    abilityId: data.abilityId,
                    slot: data.slot
                });
            },
            closeAbilityShop: () => {
                eventBus.emit('CLOSE_ABILITY_SHOP');
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
                // Always send UI updates, even when paused
                const waveInProgress = gameState.get('waves.waveInProgress');
                // Get dash cooldown from ability system
                let dashCooldown = 0;
                if (this.gameInitializer.abilitySystem) {
                    dashCooldown = this.gameInitializer.abilitySystem.cooldowns.get('dash') || 0;
                }
                
                const state = {
                    player: {
                        health: gameState.get('player.health'),
                        maxHealth: gameState.get('player.maxHealth'),
                        energy: gameState.get('player.energy'),
                        maxEnergy: gameState.get('player.maxEnergy'),
                        alive: gameState.get('player.alive'),
                        dashCooldown: dashCooldown
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
                        phase: gameState.get('waves.phase'),
                        enemiesDefeated: gameState.get('waves.enemiesKilled') || 0,
                        totalEnemies: gameState.get('waves.initialEnemyCount') || 0,
                        enemiesRemaining: gameState.get('waves.enemiesRemaining') || 0
                    },
                    upgrades: abilitySystem.getAllUpgradeInfo()
                };
                    
                    // Debug log wave state changes
                    if (this.lastWaveInProgress !== waveInProgress) {
                        // Wave state transition detected
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
        });
    }
    
    destroy() {
        // Remove game-active class from body
        document.body.classList.remove('game-active');
        
        // Release pointer lock if active
        if (this.input.mouse.locked) {
            this.input.mouse.releasePointerLock();
        }
        
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