// EventBus.js - Central event system for decoupled communication
// This is the ONLY module that should be exported to window

class EventBus {
    constructor() {
        this.events = new Map();
        this.eventQueue = [];
        this.processing = false;
        this.debug = false; // Enable/disable console logging
        this.eventHistory = []; // Track recent events for debugging
        this.maxHistorySize = 100;
    }
    
    // Subscribe to an event
    on(event, callback, context = null) {
        if (typeof event !== 'string') {
            console.error('[EventBus] Event name must be a string');
            return () => {};
        }
        
        if (typeof callback !== 'function') {
            console.error('[EventBus] Callback must be a function');
            return () => {};
        }
        
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        
        const listener = { callback, context, event };
        this.events.get(event).push(listener);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.events.get(event);
            if (listeners) {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                    if (listeners.length === 0) {
                        this.events.delete(event);
                    }
                }
            }
        };
    }
    
    // Subscribe to an event once
    once(event, callback, context = null) {
        const wrappedCallback = (...args) => {
            unsubscribe();
            callback.apply(context, args);
        };
        const unsubscribe = this.on(event, wrappedCallback, context);
        return unsubscribe;
    }
    
    // Emit an event immediately
    emit(event, ...args) {
        if (typeof event !== 'string') {
            console.error('[EventBus] Event name must be a string');
            return;
        }
        
        // Add to history for debugging (store first argument as data)
        this.addToHistory(event, args[0]);
        
        // Log if debug is enabled
        if (this.debug) {
            console.log(`[EventBus] Event: ${event}`, ...args);
        }
        
        const listeners = this.events.get(event);
        if (listeners && listeners.length > 0) {
            // Create a copy to avoid issues if listeners modify the array
            const listenersCopy = [...listeners];
            
            listenersCopy.forEach(listener => {
                try {
                    listener.callback.apply(listener.context, args);
                } catch (error) {
                    console.error(`[EventBus] Error in listener for event '${event}':`, error);
                }
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
        if (typeof event === 'string') {
            this.events.delete(event);
        } else if (typeof event === 'function') {
            // Remove specific callback from all events
            this.events.forEach((listeners, eventName) => {
                const filtered = listeners.filter(l => l.callback !== event);
                if (filtered.length > 0) {
                    this.events.set(eventName, filtered);
                } else {
                    this.events.delete(eventName);
                }
            });
        }
    }
    
    // Clear all listeners
    clear() {
        this.events.clear();
        this.eventQueue = [];
        this.eventHistory = [];
    }
    
    // Get listener count for debugging
    getListenerCount(event) {
        if (event) {
            const listeners = this.events.get(event);
            return listeners ? listeners.length : 0;
        } else {
            // Return total listener count
            let total = 0;
            this.events.forEach(listeners => {
                total += listeners.length;
            });
            return total;
        }
    }
    
    // Add event to history for debugging
    addToHistory(event, data) {
        this.eventHistory.push({
            event,
            data,
            timestamp: Date.now()
        });
        
        // Keep history size limited
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
    
    // Get recent event history for debugging
    getHistory(count = 10) {
        return this.eventHistory.slice(-count);
    }
    
    // Enable/disable debug logging
    setDebug(enabled) {
        this.debug = enabled;
    }
    
    // Get all registered events
    getRegisteredEvents() {
        return Array.from(this.events.keys());
    }
    
    // Check if an event has listeners
    hasListeners(event) {
        return this.events.has(event) && this.events.get(event).length > 0;
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
    REQUEST_PLAYER_ID: 'request:player_id',
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

// Export classes for use by GameInitializer
// EventBus will be instantiated by GameInitializer, not as a singleton

// Export to window
window.EventBus = EventBus;
window.GameEvents = GameEvents;

// Optional: Create a default instance for debugging in console
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    window._debugEventBus = new EventBus();
    window._debugEventBus.setDebug(true);
    console.log('[EventBus] Debug instance available at window._debugEventBus');
}