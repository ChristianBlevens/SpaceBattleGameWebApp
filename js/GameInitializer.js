// GameInitializer.js - Handles system initialization and dependency injection
// This file sets up all systems without direct references between them

class GameInitializer {
    constructor() {
        // Core singletons
        this.entityManager = null;
        this.gameState = null;
        this.audioManager = null;
        
        // Track initialization
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        // Create core singletons
        this.entityManager = new EntityManager();
        this.gameState = new GameState();
        this.audioManager = new AudioManagerClass();
        
        // Initialize audio
        this.audioManager.init();
        
        // Set up event-based access to singletons
        this.setupSingletonAccess();
        
        // Set up audio event handlers
        this.setupAudioEvents();
        
        // Set up state event handlers
        this.setupStateEvents();
        
        // Set up entity manager events
        this.setupEntityManagerEvents();
        
        // Set up factory events
        this.setupFactoryEvents();
        
        this.initialized = true;
        
        // Notify that initialization is complete
        window.EventBus.emit(window.GameEvents.SYSTEM_READY);
    }
    
    setupSingletonAccess() {
        // Entity Manager access
        window.EventBus.on(window.GameEvents.GET_ENTITY_MANAGER, (data) => {
            window.EventBus.emit(window.GameEvents.MANAGER_RESPONSE, {
                requestId: data.requestId,
                type: 'entityManager',
                manager: this.entityManager
            });
        });
        
        // Game State access
        window.EventBus.on(window.GameEvents.GET_GAME_STATE, (data) => {
            window.EventBus.emit(window.GameEvents.MANAGER_RESPONSE, {
                requestId: data.requestId,
                type: 'gameState',
                manager: this.gameState
            });
        });
    }
    
    setupAudioEvents() {
        // Play sound effect
        window.EventBus.on(window.GameEvents.AUDIO_PLAY, (data) => {
            this.audioManager.play(data.sound, data.volume);
        });
        
        // Stop sound
        window.EventBus.on(window.GameEvents.AUDIO_STOP, (data) => {
            this.audioManager.stop(data.sound);
        });
        
        // Play music
        window.EventBus.on(window.GameEvents.AUDIO_PLAY_MUSIC, () => {
            this.audioManager.playMusic();
        });
        
        // Stop music
        window.EventBus.on(window.GameEvents.AUDIO_STOP_MUSIC, () => {
            this.audioManager.stopMusic();
        });
        
        // Set volume
        window.EventBus.on(window.GameEvents.AUDIO_VOLUME, (data) => {
            this.audioManager.setVolume(data.type, data.volume);
        });
        
        // Set mute
        window.EventBus.on(window.GameEvents.AUDIO_SET_MUTE, (data) => {
            this.audioManager.setMute(data.muted);
        });
    }
    
    setupStateEvents() {
        // Update state
        window.EventBus.on(window.GameEvents.STATE_UPDATE, (data) => {
            this.gameState.update(data.path, data.value);
        });
        
        // Get state value
        window.EventBus.on(window.GameEvents.STATE_GET, (data) => {
            const value = this.gameState.get(data.path);
            window.EventBus.emit(window.GameEvents.STATE_RESPONSE, {
                requestId: data.requestId,
                path: data.path,
                value: value
            });
        });
        
        // State methods
        window.EventBus.on('state:add_credits', (data) => {
            this.gameState.addCredits(data.amount);
        });
        
        window.EventBus.on('state:add_score', (data) => {
            this.gameState.addScore(data.amount);
        });
        
        window.EventBus.on('state:increment_combo', () => {
            this.gameState.incrementCombo();
        });
        
        window.EventBus.on('state:break_combo', () => {
            this.gameState.breakCombo();
        });
        
        window.EventBus.on('state:damage_player', (data) => {
            const damage = this.gameState.damagePlayer(data.amount);
            window.EventBus.emit('state:damage_player_result', { damage });
        });
        
        window.EventBus.on('state:heal_player', (data) => {
            const healed = this.gameState.healPlayer(data.amount);
            window.EventBus.emit('state:heal_player_result', { healed });
        });
        
        window.EventBus.on('state:reset', () => {
            this.gameState.reset();
        });
        
        window.EventBus.on('state:save', (data) => {
            const success = this.gameState.save(data.slot);
            window.EventBus.emit('state:save_result', { success });
        });
        
        window.EventBus.on('state:load', (data) => {
            const success = this.gameState.load(data.slot);
            window.EventBus.emit('state:load_result', { success });
        });
    }
    
    setupEntityManagerEvents() {
        // Create entity
        window.EventBus.on(window.GameEvents.CREATE_ENTITY, (data) => {
            const entityId = this.entityManager.createEntity(data.type, data.components);
            window.EventBus.emit(window.GameEvents.ENTITY_CREATED, {
                requestId: data.requestId,
                entityId: entityId,
                type: data.type
            });
        });
        
        // Query entities
        window.EventBus.on('entity:query', (data) => {
            const entities = this.entityManager.query(...data.components);
            window.EventBus.emit('entity:query_result', {
                requestId: data.requestId,
                entities: entities
            });
        });
        
        // Get entities by type
        window.EventBus.on('entity:get_by_type', (data) => {
            const entities = this.entityManager.getEntitiesByType(data.type);
            window.EventBus.emit('entity:get_by_type_result', {
                requestId: data.requestId,
                entities: entities
            });
        });
        
        // Get component
        window.EventBus.on('entity:get_component', (data) => {
            const component = this.entityManager.getComponent(data.entityId, data.componentType);
            window.EventBus.emit('entity:get_component_result', {
                requestId: data.requestId,
                component: component
            });
        });
        
        // Update component
        window.EventBus.on('entity:update_component', (data) => {
            this.entityManager.updateComponent(data.entityId, data.componentType, data.updates);
        });
        
        // Add component
        window.EventBus.on('entity:add_component', (data) => {
            this.entityManager.addComponent(data.entityId, data.componentType, data.data);
        });
        
        // Clear entities
        window.EventBus.on('entity:clear', () => {
            this.entityManager.clear();
        });
    }
    
    setupFactoryEvents() {
        // Factory needs access to entity manager for each creation
        window.EventBus.on(window.GameEvents.CREATE_PLAYER, (data) => {
            const factory = new EntityFactory(data.scene);
            factory.entityManager = this.entityManager;
            const playerId = factory.createPlayer(data.x, data.y);
            window.EventBus.emit('player:created', {
                requestId: data.requestId,
                playerId: playerId
            });
        });
        
        window.EventBus.on(window.GameEvents.CREATE_ENEMY, (data) => {
            const factory = new EntityFactory(data.scene);
            factory.entityManager = this.entityManager;
            const enemyId = factory.createEnemy(data.faction, data.x, data.y, data.initialVelocity);
            window.EventBus.emit('enemy:created', {
                requestId: data.requestId,
                enemyId: enemyId
            });
        });
        
        window.EventBus.on(window.GameEvents.CREATE_PROJECTILE, (data) => {
            const factory = new EntityFactory(data.scene);
            factory.entityManager = this.entityManager;
            const projectileId = factory.createProjectile(
                data.ownerId, data.x, data.y, data.angle, 
                data.speed, data.damage, data.size, data.isCharged
            );
            window.EventBus.emit('projectile:created', {
                requestId: data.requestId,
                projectileId: projectileId
            });
        });
    }
    
    // Clean up on game end
    destroy() {
        // Clear all event listeners
        window.EventBus.clear();
        
        // Reset state
        this.gameState.reset();
        
        // Clear entities
        this.entityManager.clear();
        
        this.initialized = false;
    }
}

// Create and initialize the game initializer
const gameInitializer = new GameInitializer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        gameInitializer.init();
    });
} else {
    gameInitializer.init();
}

// Note: This file does NOT export anything to window
// All communication happens through EventBus