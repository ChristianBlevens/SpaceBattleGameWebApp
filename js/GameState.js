// GameState.js - Centralized game state management

class GameState {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.state = this.getInitialState();
        this.previousState = null;
        this.stateHistory = [];
        this.maxHistory = 10;
        this.listeners = new Set();
        this.playerId = null;
    }
    
    getInitialState() {
        return {
            // Player state
            player: {
                alive: true,
                health: GameConfig.player.initialHealth,
                maxHealth: GameConfig.player.initialHealth,
                energy: GameConfig.player.initialEnergy,
                maxEnergy: GameConfig.player.initialEnergy,
                position: { x: 0, y: 0 },
                velocity: { x: 0, y: 0 },
                rotation: 0,
                stats: {
                    speed: GameConfig.player.baseSpeed,
                    damage: GameConfig.player.baseDamage,
                    defense: GameConfig.player.baseDefense,
                    chargeSpeed: GameConfig.player.chargeRate,
                    energyRegen: GameConfig.player.energyRegen
                },
                upgrades: {
                    speed: 0,
                    damage: 0,
                    defense: 0,
                    energy: 0
                }
            },
            
            // Game progression
            game: {
                credits: 0,
                score: 0,
                combo: 0,
                comboTimer: 0,
                maxCombo: 0,
                totalKills: 0,
                totalDamageDealt: 0,
                totalDamageTaken: 0,
                playTime: 0,
                paused: false,
                gameOver: false,
                victory: false
            },
            
            // Wave system
            waves: {
                current: 0,
                enemiesRemaining: 0,
                totalEnemies: 0,
                waveInProgress: false,
                bossWave: false,
                spawnsRemaining: 0,
                nextSpawnTime: 0
            },
            
            // Mission system
            mission: {
                active: null,
                currentWave: 0,
                objectives: [],
                rewards: {},
                timeLimit: 0,
                elapsedTime: 0
            },
            
            // Active effects
            effects: {
                playerBuffs: [],
                playerDebuffs: [],
                globalModifiers: []
            },
            
            // Settings
            settings: {
                soundEnabled: true,
                musicEnabled: true,
                effectsVolume: 0.5,
                musicVolume: 0.3,
                screenShake: true,
                particles: true,
                quality: 'high'
            }
        };
    }
    
    // Subscribe to state changes
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    // Notify all listeners
    notify(changes) {
        this.listeners.forEach(callback => {
            callback(this.state, changes);
        });
        
        // Also emit to EventBus for game systems
        this.eventBus.emit('UI_UPDATE', this.state);
    }
    
    // Update state with immutability
    update(path, value) {
        // Save previous state
        this.previousState = this.deepClone(this.state);
        
        // Add to history
        this.addToHistory();
        
        // Parse path and update
        const keys = path.split('.');
        const newState = this.deepClone(this.state);
        let current = newState;
        
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        // Update state
        this.state = newState;
        
        // Notify with change details
        this.notify({
            path: path,
            oldValue: oldValue,
            newValue: value
        });
    }
    
    // Batch update multiple values
    batchUpdate(updates) {
        this.previousState = this.deepClone(this.state);
        this.addToHistory();
        
        const newState = this.deepClone(this.state);
        const changes = [];
        
        updates.forEach(({ path, value }) => {
            const keys = path.split('.');
            let current = newState;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            const lastKey = keys[keys.length - 1];
            const oldValue = current[lastKey];
            current[lastKey] = value;
            
            changes.push({ path, oldValue, newValue: value });
        });
        
        this.state = newState;
        this.notify(changes);
    }
    
    // Get value at path
    get(path) {
        const keys = path.split('.');
        let current = this.state;
        
        for (const key of keys) {
            if (current[key] === undefined) return undefined;
            current = current[key];
        }
        
        return current;
    }
    
    // Add current state to history
    addToHistory() {
        this.stateHistory.push(this.deepClone(this.state));
        if (this.stateHistory.length > this.maxHistory) {
            this.stateHistory.shift();
        }
    }
    
    // Revert to previous state
    undo() {
        if (this.stateHistory.length > 0) {
            this.state = this.stateHistory.pop();
            this.notify({ type: 'undo' });
        }
    }
    
    // Reset to initial state
    reset() {
        this.state = this.getInitialState();
        this.previousState = null;
        this.stateHistory = [];
        this.notify({ type: 'reset' });
    }
    
    // Deep clone utility
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }
    
    // Save state to localStorage
    save(slot = 'autosave') {
        try {
            const saveData = {
                state: this.state,
                timestamp: Date.now(),
                version: '1.0.0'
            };
            localStorage.setItem(`gravityWars_${slot}`, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }
    
    // Load state from localStorage
    load(slot = 'autosave') {
        try {
            const saveData = localStorage.getItem(`gravityWars_${slot}`);
            if (!saveData) return false;
            
            const parsed = JSON.parse(saveData);
            if (parsed.version === '1.0.0') {
                this.state = parsed.state;
                this.notify({ type: 'load' });
                return true;
            }
            return false;
        } catch (e) {
            console.error('Failed to load game:', e);
            return false;
        }
    }
    
    // Helper methods for common operations
    addCredits(amount) {
        const current = this.get('game.credits');
        this.update('game.credits', current + amount);
    }
    
    addScore(amount) {
        const current = this.get('game.score');
        this.update('game.score', current + amount);
    }
    
    incrementCombo() {
        const current = this.get('game.combo');
        const newCombo = current + 1;
        this.batchUpdate([
            { path: 'game.combo', value: newCombo },
            { path: 'game.comboTimer', value: 3000 },
            { path: 'game.maxCombo', value: Math.max(newCombo, this.get('game.maxCombo')) }
        ]);
    }
    
    breakCombo() {
        this.batchUpdate([
            { path: 'game.combo', value: 0 },
            { path: 'game.comboTimer', value: 0 }
        ]);
    }
    
    damagePlayer(amount) {
        const currentHealth = this.get('player.health');
        const defense = this.get('player.stats.defense');
        const actualDamage = Math.max(1, amount - defense * 0.5);
        const newHealth = Math.max(0, currentHealth - actualDamage);
        
        this.update('player.health', newHealth);
        this.update('game.totalDamageTaken', this.get('game.totalDamageTaken') + actualDamage);
        
        if (newHealth <= 0) {
            this.update('player.alive', false);
            this.update('game.gameOver', true);
            this.eventBus.emit('PLAYER_DEATH');
        }
        
        return actualDamage;
    }
    
    healPlayer(amount) {
        const currentHealth = this.get('player.health');
        const maxHealth = this.get('player.maxHealth');
        const newHealth = Math.min(maxHealth, currentHealth + amount);
        
        this.update('player.health', newHealth);
        return newHealth - currentHealth;
    }
    
    useEnergy(amount) {
        const currentEnergy = this.get('player.energy');
        if (currentEnergy >= amount) {
            this.update('player.energy', currentEnergy - amount);
            return true;
        }
        return false;
    }
    
    regenerateEnergy(deltaTime) {
        const current = this.get('player.energy');
        const max = this.get('player.maxEnergy');
        const regenRate = this.get('player.stats.energyRegen');
        
        if (current < max) {
            const newEnergy = Math.min(max, current + regenRate * deltaTime);
            this.update('player.energy', newEnergy);
        }
    }
    
    // Helper methods for managing player ID
    setPlayerId(id) {
        this.playerId = id;
    }
    
    getPlayerId() {
        return this.playerId;
    }
    
    // Simplified state setters/getters
    set(key, value) {
        this.update(key, value);
    }
}

// GameState will be instantiated by GameInitializer
window.GameState = GameState;