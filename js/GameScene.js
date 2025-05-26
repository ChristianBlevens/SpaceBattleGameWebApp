// GameScene.js - Main game scene coordinator
// REFACTORED: Now acts purely as a coordinator, delegating all logic to systems

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
        
        // Core references
        this.entityManager = window.EntityManager;
        this.gameState = window.GameState;
        this.eventBus = window.EventBus;
        
        // Game entities
        this.player = null;
        
        // Entity collections
        this.sprites = new Map();
        this.trails = new Map();
        this.enemyGroup = null;
        this.powerupGroup = null;
        this.projectileGroup = null;
        
        // Systems
        this.systems = {};
    }
    
    preload() {
        // Delegate texture creation to RenderSystem
        RenderSystem.createTextures(this);
    }
    
    create() {
        // Reset state
        this.gameState.reset();
        this.entityManager.clear();
        
        // Initialize collections
        this.sprites = new Map();
        this.trails = new Map();
        this.enemyGroup = this.add.group();
        this.powerupGroup = this.add.group();
        this.projectileGroup = this.add.group();
        
        // Configure physics world
        this.matter.world.setBounds(0, 0, GameConfig.world.width, GameConfig.world.height);
        this.matter.world.setGravity(0, 0);
        
        // Initialize systems
        this.initializeSystems();
        
        // Create environment through RenderSystem
        this.systems.render.createEnvironment();
        
        // Create initial entities through factory
        this.createInitialEntities();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start game
        window.EventBus.emit(window.GameEvents.GAME_START);
        
        // Start first wave after delay
        this.time.delayedCall(2000, () => {
            this.systems.wave.startWave(1);
        });
        
        // Start UI updates
        this.startUIUpdates();
        
        // Play music
        AudioManager.playMusic();
    }
    
    update(time, delta) {
        if (this.gameState.get('game.paused')) return;
        
        const dt = delta / 1000;
        
        // Update systems in correct order
        this.systems.input.update(dt);
        this.systems.physics.update(dt, this.entityManager);
        this.systems.ai.update(dt, this.entityManager);
        this.systems.weapon.update(dt, this.entityManager);
        this.systems.combat.update(dt, this.entityManager);
        this.systems.wave.update(dt);
        this.systems.ability.update(dt);
        this.systems.render.update(dt);  // Now handles both rendering and effects
        
        // Update game time
        const playTime = this.gameState.get('game.playTime') + delta;
        this.gameState.update('game.playTime', playTime);
    }
    
    initializeSystems() {
        // Create entity factory (shared by multiple systems)
        const entityFactory = new EntityFactory(this);
        
        // Initialize all systems
        this.systems = {
            physics: new PhysicsSystem(this),
            combat: new CombatSystem(this),
            weapon: new WeaponSystem(this),
            ai: new AISystem(this),
            wave: new WaveSystem(this),
            input: new InputSystem(this),
            render: new RenderSystem(this),  // Now includes effects functionality
            ability: new AbilitySystem(this)  // Now includes upgrade functionality
        };
        
        // Initialize UIManager with scene reference
        window.UIManager.init();
        
        // Initialize systems with dependencies
        Object.values(this.systems).forEach(system => {
            if (system.init) {
                system.init(this.entityManager);
            }
        });
    }
    
    createInitialEntities() {
        const factory = new EntityFactory(this);
        
        // Create player
        const startX = GameConfig.world.width * 0.2;
        const startY = GameConfig.world.height * 0.5;
        this.player = factory.createPlayer(startX, startY);
        
        // Create orbital systems
        const orbitalSystems = [
            { x: GameConfig.world.centerX, y: GameConfig.world.centerY, planets: 5, size: 'large' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.25, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.25, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.75, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.75, planets: 3, size: 'medium' }
        ];
        
        orbitalSystems.forEach(system => {
            factory.createOrbitalSystem(system.x, system.y, system.planets, system.size);
        });
        
        // Create wandering planets
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(1000, GameConfig.world.width - 1000);
            const y = Phaser.Math.Between(1000, GameConfig.world.height - 1000);
            const size = Phaser.Math.Pick(['small', 'medium']);
            
            const planet = factory.createPlanet(x, y, size);
            
            // Random velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(1, 3);
            const physics = this.entityManager.getComponent(planet, 'physics');
            if (physics) {
                physics.velocity.x = Math.cos(angle) * speed;
                physics.velocity.y = Math.sin(angle) * speed;
            }
        }
    }
    
    setupEventListeners() {
        // Game state events
        this.eventBus.on(window.GameEvents.GAME_PAUSE, (data) => {
            this.handlePause(data.paused);
        });
        
        // Wave events
        this.eventBus.on(window.GameEvents.WAVE_COMPLETE, () => {
            this.handleWaveComplete();
        });
        
        // Entity lifecycle events
        this.eventBus.on(window.GameEvents.DESTROY_ENTITY, (data) => {
            this.entityManager.destroyEntity(data.entityId);
        });
        
        // Powerup spawning
        this.eventBus.on(window.GameEvents.SPAWN_POWERUP, (data) => {
            const factory = new EntityFactory(this);
            factory.createPowerup(data.x, data.y, data.type);
        });
        
        // UI commands
        window.addEventListener('gameCommand', (event) => {
            this.handleUICommand(event.detail);
        });
    }
    
    handlePause(paused) {
        this.gameState.update('game.paused', paused);
        
        if (paused) {
            this.matter.world.pause();
        } else {
            this.matter.world.resume();
        }
    }
    
    handleWaveComplete() {
        const currentWave = this.gameState.get('waves.current');
        
        // Let CombatSystem handle rewards
        this.systems.combat.processWaveRewards(currentWave);
        
        // Start next wave after delay
        this.time.delayedCall(3000, () => {
            this.systems.wave.startWave(currentWave + 1);
        });
    }
    
    handleUICommand(command) {
        const commands = {
            pause: () => {
                const paused = !this.gameState.get('game.paused');
                this.eventBus.emit(window.GameEvents.GAME_PAUSE, { paused });
            },
            restart: () => {
                this.scene.restart();
            },
            menu: () => {
                AudioManager.stopMusic();
                this.scene.start('Menu');
            },
            upgrade: () => {
                this.eventBus.emit(window.GameEvents.UPGRADE_REQUEST, {
                    upgradeType: command.upgradeType
                });
            },
            sound: () => {
                this.sound.mute = !command.value;
                AudioManager.setMute(!command.value);
            }
        };
        
        if (commands[command.command]) {
            commands[command.command]();
        }
    }
    
    startUIUpdates() {
        // Update UI periodically
        this.time.addEvent({
            delay: 100,
            repeat: -1,
            callback: () => {
                if (!this.gameState.get('game.paused')) {
                    const state = {
                        player: {
                            health: this.gameState.get('player.health'),
                            maxHealth: this.gameState.get('player.maxHealth'),
                            energy: this.gameState.get('player.energy'),
                            maxEnergy: this.gameState.get('player.maxEnergy'),
                            alive: this.gameState.get('player.alive')
                        },
                        game: {
                            credits: this.gameState.get('game.credits'),
                            score: this.gameState.get('game.score'),
                            combo: this.gameState.get('game.combo'),
                            comboTimer: this.gameState.get('game.comboTimer'),
                            paused: this.gameState.get('game.paused'),
                            gameOver: this.gameState.get('game.gameOver')
                        },
                        mission: {
                            currentWave: this.gameState.get('waves.current'),
                            waveInProgress: this.gameState.get('waves.waveInProgress'),
                            enemiesDefeated: this.gameState.get('waves.totalEnemies') - this.gameState.get('waves.enemiesRemaining'),
                            totalEnemies: this.gameState.get('waves.totalEnemies')
                        },
                        upgrades: this.systems.ability.getAllUpgradeInfo()
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
        AudioManager.stopMusic();
        
        // Clean up entities
        this.entityManager.clear();
        
        // Clear collections
        this.sprites.clear();
        this.trails.clear();
        
        // Let systems clean up their own resources
        Object.values(this.systems).forEach(system => {
            if (system.destroy) {
                system.destroy();
            }
        });
        
        // Clear UIManager messages
        window.UIManager.destroy();
    }
}