// AbilitySystem.js - Handles player abilities, special powers, and upgrades
// REFACTORED: Now fully event-driven with no direct system references

class AbilitySystem {
    constructor(scene) {
        this.scene = scene;
        this.entityManager = null;
        this.gameState = null;
        this.playerId = null;
        
        // Request managers through events
        this.requestManagers();
        
        // Ability configurations
        this.abilities = {
            boost: {
                name: 'Speed Boost',
                energyCost: 20,
                cooldown: 5000,
                duration: 3000,
                icon: 'fa-bolt',
                execute: () => this.executeBoost()
            },
            shield: {
                name: 'Energy Shield',
                energyCost: 30,
                cooldown: 10000,
                duration: 5000,
                icon: 'fa-shield',
                execute: () => this.executeShield()
            },
            blast: {
                name: 'Nova Blast',
                energyCost: 50,
                cooldown: 15000,
                duration: 0,
                icon: 'fa-explosion',
                execute: () => this.executeNovaBlast()
            }
        };
        
        // Upgrade configurations
        this.upgradeConfigs = {
            damage: { 
                stat: 'damage',
                increase: 5, 
                baseCost: 50,
                multiplier: 1.5,
                description: 'Increase weapon damage'
            },
            speed: { 
                stat: 'speed',
                increase: 0.2, 
                baseCost: 40,
                multiplier: 1.4,
                description: 'Increase movement speed'
            },
            defense: { 
                stat: 'defense',
                increase: 3, 
                baseCost: 60,
                multiplier: 1.6,
                description: 'Reduce damage taken'
            },
            energy: {
                stat: 'maxEnergy',
                increase: 20,
                baseCost: 45,
                multiplier: 1.45,
                description: 'Increase energy capacity'
            },
            health: {
                stat: 'maxHealth',
                increase: 25,
                baseCost: 55,
                multiplier: 1.5,
                description: 'Increase health capacity'
            }
        };
        
        // Cooldown tracking
        this.cooldowns = new Map();
        
        // Active effects
        this.activeEffects = new Map();
        
        // Pending state requests
        this.pendingRequests = new Map();
    }
    
    requestManagers() {
        // Request entity manager
        const emRequestId = `ability_em_${Date.now()}`;
        this.pendingRequests.set(emRequestId, (manager) => {
            this.entityManager = manager;
        });
        window.EventBus.emit(window.GameEvents.GET_ENTITY_MANAGER, { requestId: emRequestId });
        
        // Request game state
        const gsRequestId = `ability_gs_${Date.now()}`;
        this.pendingRequests.set(gsRequestId, (manager) => {
            this.gameState = manager;
        });
        window.EventBus.emit(window.GameEvents.GET_GAME_STATE, { requestId: gsRequestId });
        
        // Listen for manager responses
        window.EventBus.on(window.GameEvents.MANAGER_RESPONSE, (data) => {
            if (this.pendingRequests.has(data.requestId)) {
                this.pendingRequests.get(data.requestId)(data.manager);
                this.pendingRequests.delete(data.requestId);
            }
        });
    }
    
    init() {
        // Initialize ability cooldowns
        Object.keys(this.abilities).forEach(abilityKey => {
            this.cooldowns.set(abilityKey, 0);
        });
        
        // Get player ID
        window.EventBus.on(window.GameEvents.PLAYER_ID_RESPONSE, (data) => {
            this.playerId = data.playerId;
        });
        
        // Request player ID
        window.EventBus.emit(window.GameEvents.GET_PLAYER_ID);
        
        // Listen for ability activation requests
        window.EventBus.on(window.GameEvents.PLAYER_ABILITY, (data) => {
            this.activateAbility(data.ability);
        });
        
        // Listen for upgrade requests
        window.EventBus.on(window.GameEvents.UPGRADE_REQUEST, (data) => {
            this.handleUpgrade(data.upgradeType);
        });
        
        // Listen for UI queries about upgrade costs
        window.EventBus.on(window.GameEvents.QUERY_UPGRADE_COST, (data) => {
            this.sendUpgradeInfo(data.upgradeType);
        });
        
        // Listen for titan shockwave events
        window.EventBus.on(window.GameEvents.TITAN_SHOCKWAVE, (data) => {
            // Request visual shockwave effect through event
            window.EventBus.emit(window.GameEvents.CREATE_SHOCKWAVE_EFFECT, {
                x: data.x,
                y: data.y,
                color: 0xff9966
            });
            // Physics system will handle the explosion force
            window.EventBus.emit(window.GameEvents.AUDIO_PLAY, { sound: 'explosion' });
        });
        
        // Listen for state responses
        window.EventBus.on(window.GameEvents.STATE_RESPONSE, (data) => {
            this.handleStateResponse(data);
        });
        
        // Listen for component responses
        window.EventBus.on('entity:get_component_result', (data) => {
            this.handleComponentResponse(data);
        });
    }
    
    handleStateResponse(data) {
        if (this.pendingRequests.has(data.requestId)) {
            this.pendingRequests.get(data.requestId)(data.value);
            this.pendingRequests.delete(data.requestId);
        }
    }
    
    handleComponentResponse(data) {
        if (this.pendingRequests.has(data.requestId)) {
            this.pendingRequests.get(data.requestId)(data.component);
            this.pendingRequests.delete(data.requestId);
        }
    }
    
    getStateValue(path, callback) {
        const requestId = `ability_state_${Date.now()}_${Math.random()}`;
        this.pendingRequests.set(requestId, callback);
        window.EventBus.emit(window.GameEvents.STATE_GET, { path, requestId });
    }
    
    getComponent(entityId, componentType, callback) {
        const requestId = `ability_comp_${Date.now()}_${Math.random()}`;
        this.pendingRequests.set(requestId, callback);
        window.EventBus.emit('entity:get_component', { entityId, componentType, requestId });
    }
    
    update(deltaTime) {
        // Update cooldowns
        this.cooldowns.forEach((cooldown, abilityKey) => {
            if (cooldown > 0) {
                this.cooldowns.set(abilityKey, Math.max(0, cooldown - deltaTime * 1000));
            }
        });
        
        // Update active effects
        this.activeEffects.forEach((effect, effectId) => {
            effect.timeRemaining -= deltaTime * 1000;
            
            if (effect.timeRemaining <= 0) {
                // Effect expired
                if (effect.cleanup) {
                    effect.cleanup();
                }
                this.activeEffects.delete(effectId);
            }
        });
    }
    
    // ===== ABILITY METHODS =====
    
    canActivateAbility(abilityKey, callback) {
        const ability = this.abilities[abilityKey];
        if (!ability) {
            callback(false);
            return;
        }
        
        // Check cooldown
        if (this.cooldowns.get(abilityKey) > 0) {
            callback(false);
            return;
        }
        
        // Check energy and alive status
        this.getStateValue('player.energy', (currentEnergy) => {
            if (currentEnergy < ability.energyCost) {
                callback(false);
                return;
            }
            
            this.getStateValue('player.alive', (alive) => {
                callback(alive);
            });
        });
    }
    
    activateAbility(abilityKey) {
        this.canActivateAbility(abilityKey, (canActivate) => {
            if (!canActivate) {
                // Show feedback
                const ability = this.abilities[abilityKey];
                const cooldown = this.cooldowns.get(abilityKey);
                
                if (cooldown > 0) {
                    window.EventBus.emit(window.GameEvents.UI_NOTIFICATION, {
                        message: `${ability.name} on cooldown (${Math.ceil(cooldown / 1000)}s)`,
                        type: 'warning',
                        icon: 'fa-clock'
                    });
                } else {
                    window.EventBus.emit(window.GameEvents.UI_NOTIFICATION, {
                        message: 'Not enough energy!',
                        type: 'warning',
                        icon: 'fa-battery-empty'
                    });
                }
                return;
            }
            
            const ability = this.abilities[abilityKey];
            
            // Consume energy
            this.getStateValue('player.energy', (currentEnergy) => {
                window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                    path: 'player.energy',
                    value: currentEnergy - ability.energyCost
                });
            });
            
            // Set cooldown
            this.cooldowns.set(abilityKey, ability.cooldown);
            
            // Execute ability
            ability.execute();
            
            // Notification
            window.EventBus.emit(window.GameEvents.UI_NOTIFICATION, {
                message: `${ability.name} activated!`,
                type: 'success',
                icon: ability.icon
            });
        });
    }
    
    executeBoost() {
        if (!this.playerId) return;
        
        this.getStateValue('player.stats', (stats) => {
            const originalSpeed = stats.speed;
            
            // Double speed
            stats.speed *= 2;
            window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                path: 'player.stats',
                value: stats
            });
            
            // Request visual effects
            window.EventBus.emit(window.GameEvents.PLAYER_BOOST_ACTIVATED, {
                entityId: this.playerId,
                duration: this.abilities.boost.duration
            });
            
            // Create active effect
            const effectId = `boost_${Date.now()}`;
            this.activeEffects.set(effectId, {
                type: 'boost',
                timeRemaining: this.abilities.boost.duration,
                cleanup: () => {
                    // Restore original speed
                    this.getStateValue('player.stats', (currentStats) => {
                        currentStats.speed = originalSpeed;
                        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                            path: 'player.stats',
                            value: currentStats
                        });
                    });
                    
                    // Clear visual effects
                    window.EventBus.emit(window.GameEvents.PLAYER_BOOST_DEACTIVATED, {
                        entityId: this.playerId
                    });
                }
            });
            
            window.EventBus.emit(window.GameEvents.AUDIO_PLAY, { sound: 'powerup' });
        });
    }
    
    executeShield() {
        if (!this.playerId) return;
        
        this.getComponent(this.playerId, 'health', (health) => {
            if (!health) return;
            
            // Make invulnerable
            health.invulnerable = true;
            health.invulnerabilityTime = this.abilities.shield.duration;
            
            // Update component
            window.EventBus.emit('entity:update_component', {
                entityId: this.playerId,
                componentType: 'health',
                updates: health
            });
            
            // Request shield visual
            window.EventBus.emit(window.GameEvents.PLAYER_SHIELD_ACTIVATED, {
                entityId: this.playerId,
                duration: this.abilities.shield.duration
            });
            
            // Create active effect
            const effectId = `shield_${Date.now()}`;
            this.activeEffects.set(effectId, {
                type: 'shield',
                timeRemaining: this.abilities.shield.duration,
                cleanup: () => {
                    // Remove invulnerability
                    this.getComponent(this.playerId, 'health', (currentHealth) => {
                        if (currentHealth) {
                            currentHealth.invulnerable = false;
                            window.EventBus.emit('entity:update_component', {
                                entityId: this.playerId,
                                componentType: 'health',
                                updates: currentHealth
                            });
                        }
                    });
                    
                    // Remove shield visual
                    window.EventBus.emit(window.GameEvents.PLAYER_SHIELD_DEACTIVATED, {
                        entityId: this.playerId
                    });
                }
            });
            
            window.EventBus.emit(window.GameEvents.AUDIO_PLAY, { sound: 'powerup' });
        });
    }
    
    executeNovaBlast() {
        if (!this.playerId) return;
        
        this.getComponent(this.playerId, 'transform', (transform) => {
            if (!transform) return;
            
            const blastRadius = 500;
            const baseDamage = 100;
            
            // Request visual effect
            window.EventBus.emit(window.GameEvents.PLAYER_NOVA_BLAST, {
                x: transform.x,
                y: transform.y
            });
            
            // Get all enemies
            const requestId = `nova_enemies_${Date.now()}`;
            this.pendingRequests.set(requestId, (enemies) => {
                enemies.forEach(enemyId => {
                    this.getComponent(enemyId, 'transform', (enemyTransform) => {
                        if (!enemyTransform) return;
                        
                        const dist = Phaser.Math.Distance.Between(
                            transform.x, transform.y,
                            enemyTransform.x, enemyTransform.y
                        );
                        
                        if (dist <= blastRadius) {
                            // Damage falls off with distance
                            const damage = baseDamage * (1 - dist / blastRadius);
                            
                            // Emit damage event
                            window.EventBus.emit(window.GameEvents.PROJECTILE_HIT, {
                                targetId: enemyId,
                                damage: damage,
                                projectileId: null // No projectile for blast damage
                            });
                        }
                    });
                });
            });
            
            window.EventBus.emit('entity:get_by_type', {
                type: 'enemy',
                requestId: requestId
            });
            
            // Request physics explosion
            window.EventBus.emit(window.GameEvents.CREATE_EXPLOSION_FORCE, {
                x: transform.x,
                y: transform.y,
                force: 20,
                radius: blastRadius
            });
            
            // Screen effects
            window.EventBus.emit(window.GameEvents.CAMERA_SHAKE, {
                duration: 500,
                intensity: 0.02
            });
            
            window.EventBus.emit(window.GameEvents.CAMERA_FLASH, {
                duration: 200,
                color: { r: 255, g: 0, b: 255 }
            });
            
            window.EventBus.emit(window.GameEvents.AUDIO_PLAY, { sound: 'explosion' });
        });
    }
    
    getAbilityCooldown(abilityKey) {
        return this.cooldowns.get(abilityKey) || 0;
    }
    
    getAbilityInfo(abilityKey) {
        const ability = this.abilities[abilityKey];
        if (!ability) return null;
        
        return {
            name: ability.name,
            energyCost: ability.energyCost,
            cooldown: ability.cooldown,
            currentCooldown: this.cooldowns.get(abilityKey) || 0,
            icon: ability.icon,
            canActivate: false // Will be updated asynchronously
        };
    }
    
    getAllAbilities() {
        return Object.keys(this.abilities).map(key => ({
            key: key,
            ...this.getAbilityInfo(key)
        }));
    }
    
    // ===== UPGRADE METHODS =====
    
    handleUpgrade(upgradeType) {
        const config = this.upgradeConfigs[upgradeType];
        if (!config) {
            console.error(`Unknown upgrade type: ${upgradeType}`);
            return;
        }
        
        // Get current values
        this.getStateValue('game.credits', (credits) => {
            this.getStateValue('player.upgrades', (upgrades) => {
                const currentLevel = upgrades[upgradeType] || 0;
                const cost = this.calculateUpgradeCost(upgradeType, currentLevel);
                
                if (credits < cost) {
                    // Not enough credits
                    window.EventBus.emit(window.GameEvents.UI_NOTIFICATION, {
                        message: 'Not enough credits!',
                        type: 'error',
                        icon: 'fa-coins'
                    });
                    window.EventBus.emit(window.GameEvents.AUDIO_PLAY, { sound: 'error' });
                    return;
                }
                
                // Apply upgrade
                this.applyUpgrade(upgradeType, config, currentLevel);
                
                // Deduct credits
                window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                    path: 'game.credits',
                    value: credits - cost
                });
                
                // Update upgrade level
                upgrades[upgradeType] = currentLevel + 1;
                window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                    path: 'player.upgrades',
                    value: upgrades
                });
                
                // Play sound
                window.EventBus.emit(window.GameEvents.AUDIO_PLAY, { sound: 'powerup' });
                
                // Emit success event
                window.EventBus.emit(window.GameEvents.UPGRADE_APPLIED, {
                    upgradeType: upgradeType,
                    newLevel: currentLevel + 1,
                    cost: cost,
                    newValue: this.getUpgradedValue(upgradeType, currentLevel + 1)
                });
                
                // UI notification
                window.EventBus.emit(window.GameEvents.UI_NOTIFICATION, {
                    message: `${config.description} upgraded to level ${currentLevel + 1}!`,
                    type: 'success',
                    icon: 'fa-arrow-up'
                });
            });
        });
    }
    
    applyUpgrade(upgradeType, config, currentLevel) {
        switch (upgradeType) {
            case 'damage':
            case 'speed':
            case 'defense':
                // Update player stats
                this.getStateValue('player.stats', (stats) => {
                    stats[config.stat] += config.increase;
                    window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                        path: 'player.stats',
                        value: stats
                    });
                    
                    // Also update weapon damage if applicable
                    if (upgradeType === 'damage' && this.playerId) {
                        this.getComponent(this.playerId, 'weapon', (weapon) => {
                            if (weapon) {
                                weapon.damage += config.increase;
                                window.EventBus.emit('entity:update_component', {
                                    entityId: this.playerId,
                                    componentType: 'weapon',
                                    updates: weapon
                                });
                            }
                        });
                    }
                });
                break;
                
            case 'energy':
                this.getStateValue('player.maxEnergy', (currentMaxEnergy) => {
                    this.getStateValue('player.energy', (currentEnergy) => {
                        const newMaxEnergy = currentMaxEnergy + config.increase;
                        
                        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                            path: 'player.maxEnergy',
                            value: newMaxEnergy
                        });
                        
                        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                            path: 'player.energy',
                            value: currentEnergy + config.increase
                        });
                    });
                });
                break;
                
            case 'health':
                this.getStateValue('player.maxHealth', (currentMaxHealth) => {
                    this.getStateValue('player.health', (currentHealth) => {
                        const newMaxHealth = currentMaxHealth + config.increase;
                        
                        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                            path: 'player.maxHealth',
                            value: newMaxHealth
                        });
                        
                        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
                            path: 'player.health',
                            value: Math.min(newMaxHealth, currentHealth + config.increase)
                        });
                        
                        // Update entity component
                        if (this.playerId) {
                            this.getComponent(this.playerId, 'health', (health) => {
                                if (health) {
                                    health.max = newMaxHealth;
                                    health.current = Math.min(health.current + config.increase, health.max);
                                    window.EventBus.emit('entity:update_component', {
                                        entityId: this.playerId,
                                        componentType: 'health',
                                        updates: health
                                    });
                                }
                            });
                        }
                    });
                });
                break;
        }
    }
    
    calculateUpgradeCost(upgradeType, currentLevel) {
        const config = this.upgradeConfigs[upgradeType];
        return Math.floor(config.baseCost * Math.pow(config.multiplier, currentLevel));
    }
    
    getUpgradedValue(upgradeType, level) {
        const config = this.upgradeConfigs[upgradeType];
        const baseValue = this.getBaseValue(upgradeType);
        return baseValue + (config.increase * level);
    }
    
    getBaseValue(upgradeType) {
        switch (upgradeType) {
            case 'damage':
                return GameConfig.player.baseDamage;
            case 'speed':
                return GameConfig.player.baseSpeed;
            case 'defense':
                return GameConfig.player.baseDefense;
            case 'energy':
                return GameConfig.player.initialEnergy;
            case 'health':
                return GameConfig.player.initialHealth;
            default:
                return 0;
        }
    }
    
    sendUpgradeInfo(upgradeType) {
        const config = this.upgradeConfigs[upgradeType];
        if (!config) return;
        
        this.getStateValue('player.upgrades', (upgrades) => {
            const currentLevel = upgrades[upgradeType] || 0;
            const cost = this.calculateUpgradeCost(upgradeType, currentLevel);
            const currentValue = this.getUpgradedValue(upgradeType, currentLevel);
            const nextValue = this.getUpgradedValue(upgradeType, currentLevel + 1);
            
            this.getStateValue('game.credits', (credits) => {
                const canAfford = credits >= cost;
                
                window.EventBus.emit(window.GameEvents.UPGRADE_INFO_RESPONSE, {
                    upgradeType: upgradeType,
                    currentLevel: currentLevel,
                    cost: cost,
                    currentValue: currentValue,
                    nextValue: nextValue,
                    increase: config.increase,
                    description: config.description,
                    canAfford: canAfford
                });
            });
        });
    }
    
    getAllUpgradeInfo(callback) {
        const upgradeInfo = {};
        const upgradeTypes = Object.keys(this.upgradeConfigs);
        let processed = 0;
        
        this.getStateValue('game.credits', (credits) => {
            this.getStateValue('player.upgrades', (upgrades) => {
                upgradeTypes.forEach(upgradeType => {
                    const config = this.upgradeConfigs[upgradeType];
                    const currentLevel = upgrades[upgradeType] || 0;
                    const cost = this.calculateUpgradeCost(upgradeType, currentLevel);
                    
                    upgradeInfo[upgradeType] = {
                        currentLevel: currentLevel,
                        cost: cost,
                        currentValue: this.getUpgradedValue(upgradeType, currentLevel),
                        nextValue: this.getUpgradedValue(upgradeType, currentLevel + 1),
                        increase: config.increase,
                        description: config.description,
                        canAfford: credits >= cost
                    };
                    
                    processed++;
                    if (processed === upgradeTypes.length && callback) {
                        callback(upgradeInfo);
                    }
                });
            });
        });
    }
    
    resetUpgrades() {
        // Reset all upgrades to level 0
        const upgrades = {
            damage: 0,
            speed: 0,
            defense: 0,
            energy: 0,
            health: 0
        };
        
        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
            path: 'player.upgrades',
            value: upgrades
        });
        
        // Reset stats to base values
        const baseStats = {
            speed: GameConfig.player.baseSpeed,
            damage: GameConfig.player.baseDamage,
            defense: GameConfig.player.baseDefense,
            chargeSpeed: GameConfig.player.chargeRate,
            energyRegen: GameConfig.player.energyRegen
        };
        
        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
            path: 'player.stats',
            value: baseStats
        });
        
        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
            path: 'player.maxHealth',
            value: GameConfig.player.initialHealth
        });
        
        window.EventBus.emit(window.GameEvents.STATE_UPDATE, {
            path: 'player.maxEnergy',
            value: GameConfig.player.initialEnergy
        });
    }
}