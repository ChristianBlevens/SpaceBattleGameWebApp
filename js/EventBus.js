// EventBus.js - Central event system for decoupled communication
// This is the ONLY module that should be exported to window

class EventBus {
    constructor() {
        this.events = new Map();
        this.eventQueue = [];
        this.processing = false;
    }
    
    // Subscribe to an event
    on(event, callback, context = null) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        const listener = { callback, context };
        this.events.get(event).push(listener);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.events.get(event);
            if (listeners) {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }
    
    // Subscribe to an event once
    once(event, callback, context = null) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe();
            callback.apply(context, args);
        });
        return unsubscribe;
    }
    
    // Emit an event immediately
    emit(event, ...args) {
        // Log all events
        console.log(`[EventBus] Event: ${event}`, args[0] || '');
        
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                listener.callback.apply(listener.context, args);
            });
        }
    }
    
    // Queue an event for batch processing
    queue(event, ...args) {
        this.eventQueue.push({ event, args });
    }
    
    // Process all queued events
    processQueue() {
        if (this.processing || this.eventQueue.length === 0) return;
        
        this.processing = true;
        const queue = [...this.eventQueue];
        this.eventQueue = [];
        
        queue.forEach(({ event, args }) => {
            this.emit(event, ...args);
        });
        
        this.processing = false;
    }
    
    // Clear all listeners for an event
    off(event) {
        this.events.delete(event);
    }
    
    // Clear all listeners
    clear() {
        this.events.clear();
        this.eventQueue = [];
    }
    
    // Get listener count for debugging
    getListenerCount(event) {
        const listeners = this.events.get(event);
        return listeners ? listeners.length : 0;
    }
}

// Game event types - Comprehensive list
const GameEvents = {
    // System initialization
    SYSTEM_INIT: 'system:init',
    SYSTEM_READY: 'system:ready',
    
    // Player events
    PLAYER_DAMAGE: 'player:damage',
    PLAYER_DAMAGED: 'player:damaged',
    PLAYER_HEAL: 'player:heal',
    PLAYER_DEATH: 'player:death',
    PLAYER_DIED: 'player:died',
    PLAYER_SHOOT: 'player:shoot',
    PLAYER_SHOOT_REQUEST: 'player:shoot_request',
    PLAYER_UPGRADE: 'player:upgrade',
    PLAYER_ABILITY: 'player:ability',
    PLAYER_CHARGE_UPDATE: 'player:charge_update',
    PLAYER_BOOST_ACTIVATED: 'player:boost_activated',
    PLAYER_BOOST_DEACTIVATED: 'player:boost_deactivated',
    PLAYER_SHIELD_ACTIVATED: 'player:shield_activated',
    PLAYER_SHIELD_DEACTIVATED: 'player:shield_deactivated',
    PLAYER_NOVA_BLAST: 'player:nova_blast',
    GET_PLAYER_ID: 'get:player_id',
    PLAYER_ID_RESPONSE: 'player:id_response',
    
    // Enemy events
    ENEMY_SPAWN: 'enemy:spawn',
    ENEMY_SPAWNED: 'enemy:spawned',
    ENEMY_DEATH: 'enemy:death',
    ENEMY_KILLED: 'enemy:killed',
    ENEMY_DAMAGE: 'enemy:damage',
    ENEMY_DAMAGED: 'enemy:damaged',
    ENEMY_SHOOT: 'enemy:shoot',
    ENEMY_SHOOT_REQUEST: 'enemy:shoot_request',
    ENEMY_PHASE_CHANGE: 'enemy:phase_change',
    
    // Game state events
    GAME_START: 'game:start',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    GAME_OVER: 'game:over',
    GAME_VICTORY: 'game:victory',
    
    // Wave events
    WAVE_START: 'wave:start',
    WAVE_COMPLETE: 'wave:complete',
    WAVE_SPAWN: 'wave:spawn',
    WAVE_ANNOUNCED: 'wave:announced',
    WAVE_REWARDS: 'wave:rewards',
    
    // Mission events
    MISSION_START: 'mission:start',
    MISSION_COMPLETE: 'mission:complete',
    MISSION_OBJECTIVE: 'mission:objective',
    
    // Pickup events
    PICKUP_COLLECT: 'pickup:collect',
    PICKUP_SPAWN: 'pickup:spawn',
    POWERUP_CREATED: 'powerup:created',
    POWERUP_COLLECTED: 'powerup:collected',
    SPAWN_POWERUP: 'spawn:powerup',
    
    // Combat events
    COLLISION: 'combat:collision',
    COLLISION_DETECTED: 'collision:detected',
    PROJECTILE_HIT: 'combat:projectile_hit',
    PROJECTILE_CREATED: 'combat:projectile_created',
    PROJECTILE_DESTROYED: 'combat:projectile_destroyed',
    PROJECTILE_EXPIRED: 'projectile:expired',
    EXPLOSION: 'combat:explosion',
    COMBO_INCREASE: 'combat:combo_increase',
    COMBO_BREAK: 'combat:combo_break',
    
    // Effect events
    EFFECT_EXPLOSION: 'effect:explosion',
    EFFECT_SPAWN: 'effect:spawn',
    EFFECT_IMPACT: 'effect:impact',
    EFFECT_SHOCKWAVE: 'effect:shockwave',
    EFFECT_TRAIL: 'effect:trail',
    CREATE_TRAIL: 'create:trail',
    CREATE_SHOCKWAVE_EFFECT: 'create:shockwave_effect',
    CREATE_EXPLOSION_FORCE: 'create:explosion_force',
    TITAN_SHOCKWAVE: 'titan:shockwave',
    
    // UI events
    UI_UPDATE: 'ui:update',
    UI_NOTIFICATION: 'ui:notification',
    UI_SHAKE: 'ui:shake',
    UI_FLASH: 'ui:flash',
    UI_SHOW_MESSAGE: 'ui:show_message',
    UI_HIDE_MESSAGE: 'ui:hide_message',
    UI_UPDATE_CHARGE: 'ui:update_charge',
    SHOW_GAME_MESSAGE: 'show:game_message',
    DISMISS_GAME_MESSAGE: 'dismiss:game_message',
    
    // Audio events
    AUDIO_PLAY: 'audio:play',
    AUDIO_STOP: 'audio:stop',
    AUDIO_VOLUME: 'audio:volume',
    AUDIO_PLAY_MUSIC: 'audio:play_music',
    AUDIO_STOP_MUSIC: 'audio:stop_music',
    AUDIO_SET_MUTE: 'audio:set_mute',
    
    // Physics events
    GRAVITY_WELL: 'physics:gravity_well',
    FORCE_APPLIED: 'physics:force_applied',
    BOUNDARY_WRAP: 'physics:boundary_wrap',
    
    // Entity events
    ENTITY_CREATED: 'entity:created',
    ENTITY_DESTROYED: 'entity:destroyed',
    DESTROY_ENTITY: 'destroy:entity',
    CREATE_ENTITY: 'create:entity',
    
    // Camera events
    CAMERA_SHAKE: 'camera:shake',
    CAMERA_FLASH: 'camera:flash',
    
    // Upgrade events
    UPGRADE_REQUEST: 'upgrade:request',
    UPGRADE_APPLIED: 'upgrade:applied',
    QUERY_UPGRADE_COST: 'query:upgrade_cost',
    UPGRADE_INFO_RESPONSE: 'upgrade:info_response',
    
    // State management
    STATE_UPDATE: 'state:update',
    STATE_GET: 'state:get',
    STATE_RESPONSE: 'state:response',
    
    // Factory events
    CREATE_PLAYER: 'create:player',
    CREATE_ENEMY: 'create:enemy',
    CREATE_POWERUP: 'create:powerup',
    CREATE_PROJECTILE: 'create:projectile',
    
    // Manager events
    REGISTER_ENTITY_MANAGER: 'register:entity_manager',
    REGISTER_GAME_STATE: 'register:game_state',
    GET_ENTITY_MANAGER: 'get:entity_manager',
    GET_GAME_STATE: 'get:game_state',
    MANAGER_RESPONSE: 'manager:response',
    
    // Texture creation
    CREATE_TEXTURES: 'create:textures',
    TEXTURES_CREATED: 'textures:created'
};

// Create singleton instance
const eventBus = new EventBus();

// This is the ONLY export to window in the entire codebase
window.EventBus = eventBus;
window.GameEvents = GameEvents;