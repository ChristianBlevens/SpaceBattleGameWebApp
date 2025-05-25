// GameScene.js - Main game scene coordinator (Refactored)

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
        
        // Core references
        this.entityManager = window.EntityManager;
        this.gameState = window.GameState;
        this.eventBus = window.EventBus;
        
        // Game entities
        this.player = null;
        
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
        
        // Start gameplay
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
        
        // Update all systems
        const dt = delta / 1000;
        
        this.systems.input.update(dt);
        this.systems.physics.update(dt, this.entityManager);
        this.systems.combat.update(dt, this.entityManager);
        this.systems.weapon.update(dt, this.entityManager);
        this.systems.ai.update(dt, this.entityManager);
        this.systems.wave.update(dt);
        this.systems.effects.update(dt, this.entityManager);
        this.systems.render.update(dt);
        
        // Update game time
        const playTime = this.gameState.get('game.playTime') + delta;
        this.gameState.update('game.playTime', playTime);
        
        // Check game state
        if (!this.gameState.get('player.alive') && !this.gameState.get('game.gameOver')) {
            this.handleGameOver();
        }
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
            effects: new EffectsSystem(this),
            input: new InputSystem(this),
            render: new RenderSystem(this),
            ability: new AbilitySystem(this)
        };
        
        // Initialize UIManager with scene reference
        window.UIManager.init(this);
        
        // Initialize systems with dependencies
        Object.values(this.systems).forEach(system => {
            if (system.init) {
                system.init(this.entityManager);
            }
        });
        
        // Add update systems to entity manager
        this.entityManager.addSystem(this.systems.physics);
        this.entityManager.addSystem(this.systems.combat);
        this.entityManager.addSystem(this.systems.weapon);
        this.entityManager.addSystem(this.systems.ai);
        this.entityManager.addSystem(this.systems.effects);
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
        // Combat events - delegate to CombatSystem
        this.eventBus.on(GameEvents.PROJECTILE_HIT, (data) => {
            this.systems.combat.handleProjectileHit(data);
        });
        
        this.eventBus.on(GameEvents.ENEMY_DEATH, (data) => {
            this.systems.combat.handleEnemyDeath(data);
        });
        
        this.eventBus.on(GameEvents.PLAYER_DEATH, () => {
            this.systems.combat.handlePlayerDeath();
        });
        
        // Pickup events - delegate to CombatSystem
        this.eventBus.on(GameEvents.PICKUP_COLLECT, (data) => {
            this.systems.combat.handlePickupCollect(data);
        });
        
        // Ability events - delegate to AbilitySystem
        this.eventBus.on(GameEvents.PLAYER_ABILITY, (data) => {
            this.systems.ability.activateAbility(data.ability);
        });
        
        // Game state events
        this.eventBus.on(GameEvents.GAME_PAUSE, (data) => {
            this.handlePause(data);
        });
        
        // Wave events
        this.eventBus.on(GameEvents.WAVE_COMPLETE, () => {
            this.handleWaveComplete();
        });
        
        // UI commands
        window.addEventListener('gameCommand', (event) => {
            this.handleUICommand(event.detail);
        });
    }
    
    handlePause(data) {
        if (data.paused) {
            this.matter.world.pause();
        } else {
            this.matter.world.resume();
        }
    }
    
    handleWaveComplete() {
        const currentWave = this.gameState.get('waves.current');
        
        // Let CombatSystem handle rewards
        this.systems.combat.processWaveRewards(currentWave);
        
        // Show wave complete message through UIManager
        window.EventBus.emit(window.GameEvents.WAVE_COMPLETE, {
            waveNumber: currentWave,
            callback: () => {
                this.systems.wave.startWave(currentWave + 1);
            }
        });
    }
    
    handleGameOver() {
        AudioManager.stopMusic();
        
        this.gameState.update('game.gameOver', true);
        
        // Send final stats to UI
        window.dispatchEvent(new CustomEvent('gameStateUpdate', {
            detail: {
                gameOver: true,
                victory: false,
                finalScore: this.gameState.get('game.score'),
                wavesCompleted: this.gameState.get('waves.current') - 1,
                totalKills: this.gameState.get('game.totalKills')
            }
        }));
    }
    
    handleUICommand(command) {
        const commands = {
            pause: () => this.gameState.update('game.paused', command.value),
            restart: () => this.scene.restart(),
            menu: () => this.scene.start('Menu'),
            upgrade: () => this.systems.combat.handleUpgrade(command.stat),
            sound: () => this.sound.mute = !command.value
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
                            maxEnergy: this.gameState.get('player.maxEnergy')
                        },
                        game: {
                            credits: this.gameState.get('game.credits'),
                            score: this.gameState.get('game.score'),
                            combo: this.gameState.get('game.combo'),
                            comboTimer: this.gameState.get('game.comboTimer')
                        },
                        mission: {
                            currentWave: this.gameState.get('waves.current'),
                            waveInProgress: this.gameState.get('waves.waveInProgress'),
                            enemiesDefeated: this.gameState.get('waves.totalEnemies') - this.gameState.get('waves.enemiesRemaining'),
                            totalEnemies: this.gameState.get('waves.totalEnemies')
                        }
                    };
                    
                    window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: state }));
                }
            }
        });
    }
    
    destroy() {
        // Clean up event listeners
        this.eventBus.clear();
        window.removeEventListener('gameCommand', this.handleUICommand);
        
        // Stop music
        AudioManager.stopMusic();
        
        // Clean up entities
        this.entityManager.clear();
        
        // Let systems clean up their own resources
        Object.values(this.systems).forEach(system => {
            if (system.destroy) {
                system.destroy();
            }
        });
    }
}