// GameInitializer.js - System initialization and lifecycle management
// Coordinates all game systems and their interdependencies

class GameInitializer {
    constructor(scene) {
        this.scene = scene;
        
        // Initialize core infrastructure
        this.eventBus = new EventBus();
        this.entityManager = new EntityManager(this.eventBus);
        this.gameState = new GameState(this.eventBus);
        
        // Entity creation factory
        this.entityFactory = new EntityFactory(this.entityManager, this.eventBus);
        
        // Initialize gameplay systems
        this.physicsSystem = new PhysicsSystem(scene, this.eventBus);
        this.aiSystem = new AiSystem(scene, this.eventBus);
        this.weaponSystem = new WeaponSystem(scene, this.eventBus, this.entityManager, this.entityFactory);
        this.combatSystem = new CombatSystem(scene, this.eventBus, this.entityManager, this.gameState);
        this.waveSystem = new WaveSystem(scene, this.eventBus, this.gameState, this.entityFactory);
        this.bossSystem = new BossSystem(scene, this.eventBus, this.entityManager, this.entityFactory);
        this.abilitySystem = new AbilitySystem(scene, this.eventBus, this.entityManager, this.gameState);
        this.upgradeSystem = new UpgradeSystem(this.eventBus, this.gameState, this.entityManager);
        this.disasterSystem = new DisasterSystem(scene);
        
        // Initialize I/O systems
        this.renderSystem = new RenderSystem(scene, this.eventBus, this.entityManager);
        this.inputSystem = new InputSystem(scene, this.eventBus, this.entityManager, this.gameState);
        
        // Initialize managers
        this.audioManager = new AudioManager(this.eventBus);
        this.uiManager = new UIManager(this.eventBus, this.gameState);
    }
    
    initializeAllSystems() {
        // Initialize managers first
        this.audioManager.init();
        this.uiManager.init();
        
        // Initialize input
        this.inputSystem.init();
        
        // Initialize render system
        this.renderSystem.init();
        
        // Initialize physics
        this.physicsSystem.init(this.entityManager);
        
        // Initialize AI
        this.aiSystem.init(this.entityManager);
        
        // Initialize combat
        this.combatSystem.init();
        
        // Initialize abilities
        this.abilitySystem.init();
        
        // Initialize weapons
        this.weaponSystem.init();
        
        // Initialize wave system
        this.waveSystem.init();
        
        // Initialize boss system
        this.bossSystem.init();
        
        // Initialize upgrade system
        this.upgradeSystem.init();
        
        // Initialize disaster system with dependencies
        this.disasterSystem.eventBus = this.eventBus;
        this.disasterSystem.entityManager = this.entityManager;
        this.disasterSystem.renderSystem = this.renderSystem;
        this.disasterSystem.init();
        
        // Configure event handlers for system coordination
        this.setupSystemCommunication();
    }
    
    updateAllSystems(dt) {
        // Process systems in dependency order
        this.inputSystem.update(dt);
        
        // Update physics
        this.physicsSystem.update(dt, this.entityManager);
        
        // Update AI
        this.aiSystem.update(dt, this.entityManager);
        
        // Update weapons
        this.weaponSystem.update(dt);
        
        // Update combat
        this.combatSystem.update(dt, this.entityManager);
        
        // Update abilities
        this.abilitySystem.update(dt);
        
        // Update wave system
        this.waveSystem.update(dt);
        
        // Update boss system
        this.bossSystem.update(dt);
        
        // Update disaster system
        this.disasterSystem.update(dt);
        
        // Update rendering
        this.renderSystem.update(dt);
        
        // Update UI
        this.uiManager.update(dt);
    }
    
    setupSystemCommunication() {
        // Configure cross-system event handlers
        
        // Entity lifecycle coordination
        this.eventBus.on('ENTITY_DESTROYED', (data) => {
            this.renderSystem.destroySprite(data.entityId);
        });
        
        // Game state changes
        this.eventBus.on('GAME_OVER', () => {
            this.gameState.update('game.gameOver', true);
            this.uiManager.showGameOver();
        });
        
        // Score and credits
        this.eventBus.on('ENEMY_DESTROYED', (data) => {
            this.gameState.addScore(data.score || 100);
            this.gameState.addCredits(data.credits || 10);
        });
        
        // Player damage
        this.eventBus.on('PLAYER_HIT', (data) => {
            this.gameState.damagePlayer(data.damage);
            this.eventBus.emit('AUDIO_PLAY', { sound: 'hit' });
        });
        
        // Wave events
        this.eventBus.on('WAVE_COMPLETE', (data) => {
            if (data && data.waveNumber) {
                this.gameState.update('mission.currentWave', data.waveNumber);
                this.gameState.addCredits(data.waveNumber * 100);
            }
        });
        
        // Ability usage
        this.eventBus.on('USE_ABILITY', (data) => {
            this.abilitySystem.useAbility(data.abilityId, data.entityId);
        });
        
        // Audio events
        this.eventBus.on('PLAY_SOUND', (data) => {
            this.audioManager.playSound(data.sound);
        });
        
        this.eventBus.on('AUDIO_PLAY_MUSIC', () => {
            this.audioManager.playMusic('gameMusic');
        });
    }
    
    destroy() {
        // Clean up all systems in reverse order
        this.inputSystem.destroy();
        this.renderSystem.destroy();
        this.audioManager.destroy();
        this.entityManager.clear();
        this.eventBus.clear();
        this.gameState.reset();
    }
}

// Make GameInitializer available globally
window.GameInitializer = GameInitializer;