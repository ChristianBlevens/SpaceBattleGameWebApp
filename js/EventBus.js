// EventBus.js - Central event system for decoupled communication

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

// Game event types
const GameEvents = {
    // Player events
    PLAYER_DAMAGE: 'player:damage',
    PLAYER_HEAL: 'player:heal',
    PLAYER_DEATH: 'player:death',
    PLAYER_SHOOT: 'player:shoot',
    PLAYER_UPGRADE: 'player:upgrade',
    PLAYER_ABILITY: 'player:ability',
    
    // Enemy events
    ENEMY_SPAWN: 'enemy:spawn',
    ENEMY_DEATH: 'enemy:death',
    ENEMY_DAMAGE: 'enemy:damage',
    ENEMY_SHOOT: 'enemy:shoot',
    
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
    
    // Mission events
    MISSION_START: 'mission:start',
    MISSION_COMPLETE: 'mission:complete',
    MISSION_OBJECTIVE: 'mission:objective',
    
    // Pickup events
    PICKUP_COLLECT: 'pickup:collect',
    PICKUP_SPAWN: 'pickup:spawn',
    
    // Combat events
    COLLISION: 'combat:collision',
    PROJECTILE_HIT: 'combat:projectile_hit',
    EXPLOSION: 'combat:explosion',
    COMBO_INCREASE: 'combat:combo_increase',
    COMBO_BREAK: 'combat:combo_break',
    
    // UI events
    UI_UPDATE: 'ui:update',
    UI_NOTIFICATION: 'ui:notification',
    UI_SHAKE: 'ui:shake',
    
    // Audio events
    AUDIO_PLAY: 'audio:play',
    AUDIO_STOP: 'audio:stop',
    AUDIO_VOLUME: 'audio:volume',
    
    // Physics events
    GRAVITY_WELL: 'physics:gravity_well',
    FORCE_APPLIED: 'physics:force_applied',
    BOUNDARY_WRAP: 'physics:boundary_wrap'
};

// Create singleton instance
const eventBus = new EventBus();

// Export for use in other modules
window.EventBus = eventBus;
window.GameEvents = GameEvents;