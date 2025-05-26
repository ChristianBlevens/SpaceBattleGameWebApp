// AbilitySystem.js - Handles player abilities, special powers, and upgrades
// REFACTORED: Now fully event-driven with no direct system references

class AbilitySystem {
    constructor(scene, eventBus, entityManager, gameState) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.gameState = gameState;
        this.playerId = null;
        
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
    
    
    init() {
        // Initialize ability cooldowns
        Object.keys(this.abilities).forEach(abilityKey => {
            this.cooldowns.set(abilityKey, 0);
        });
        
        // Get player ID from game state
        this.playerId = this.gameState.getPlayerId();
        
        // Listen for ability activation requests
        this.eventBus.on('PLAYER_ABILITY', (data) => {
            this.activateAbility(data.ability);
        });
        
        // Listen for upgrade requests
        this.eventBus.on('UPGRADE_REQUEST', (data) => {
            this.handleUpgrade(data.upgradeType);
        });
        
        // Listen for UI queries about upgrade costs
        this.eventBus.on('QUERY_UPGRADE_COST', (data) => {
            this.sendUpgradeInfo(data.upgradeType);
        });
        
        // Listen for titan shockwave events
        this.eventBus.on('TITAN_SHOCKWAVE', (data) => {
            // Request visual shockwave effect through event
            this.eventBus.emit('CREATE_SHOCKWAVE_EFFECT', {
                x: data.x,
                y: data.y,
                color: 0xff9966
            });
            // Physics system will handle the explosion force
            this.eventBus.emit('AUDIO_PLAY', { sound: 'explosion' });
        });
    }
    
    getStateValue(path, callback) {
        const value = this.gameState.get(path);
        callback(value);
    }
    
    getComponent(entityId, componentType, callback) {
        const component = this.entityManager.getComponent(entityId, componentType);
        callback(component);
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
                    this.eventBus.emit('UI_NOTIFICATION', {
                        message: `${ability.name} on cooldown (${Math.ceil(cooldown / 1000)}s)`,
                        type: 'warning',
                        icon: 'fa-clock'
                    });
                } else {
                    this.eventBus.emit('UI_NOTIFICATION', {
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
                this.eventBus.emit('STATE_UPDATE', {
                    path: 'player.energy',
                    value: currentEnergy - ability.energyCost
                });
            });
            
            // Set cooldown
            this.cooldowns.set(abilityKey, ability.cooldown);
            
            // Execute ability
            ability.execute();
            
            // Notification
            this.eventBus.emit('UI_NOTIFICATION', {
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
            this.eventBus.emit('STATE_UPDATE', {
                path: 'player.stats',
                value: stats
            });
            
            // Request visual effects
            this.eventBus.emit('PLAYER_BOOST_ACTIVATED', {
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
                        this.eventBus.emit('STATE_UPDATE', {
                            path: 'player.stats',
                            value: currentStats
                        });
                    });
                    
                    // Clear visual effects
                    this.eventBus.emit('PLAYER_BOOST_DEACTIVATED', {
                        entityId: this.playerId
                    });
                }
            });
            
            this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
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
            this.eventBus.emit('PLAYER_SHIELD_ACTIVATED', {
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
                    this.eventBus.emit('PLAYER_SHIELD_DEACTIVATED', {
                        entityId: this.playerId
                    });
                }
            });
            
            this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
        });
    }
    
    executeNovaBlast() {
        if (!this.playerId) return;
        
        this.getComponent(this.playerId, 'transform', (transform) => {
            if (!transform) return;
            
            const blastRadius = 500;
            const baseDamage = 100;
            
            // Request visual effect
            this.eventBus.emit('PLAYER_NOVA_BLAST', {
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
                            this.eventBus.emit('PROJECTILE_HIT', {
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
            this.eventBus.emit('CREATE_EXPLOSION_FORCE', {
                x: transform.x,
                y: transform.y,
                force: 20,
                radius: blastRadius
            });
            
            // Screen effects
            this.eventBus.emit('CAMERA_SHAKE', {
                duration: 500,
                intensity: 0.02
            });
            
            this.eventBus.emit('CAMERA_FLASH', {
                duration: 200,
                color: { r: 255, g: 0, b: 255 }
            });
            
            this.eventBus.emit('AUDIO_PLAY', { sound: 'explosion' });
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
                    this.eventBus.emit('UI_NOTIFICATION', {
                        message: 'Not enough credits!',
                        type: 'error',
                        icon: 'fa-coins'
                    });
                    this.eventBus.emit('AUDIO_PLAY', { sound: 'error' });
                    return;
                }
                
                // Apply upgrade
                this.applyUpgrade(upgradeType, config, currentLevel);
                
                // Deduct credits
                this.eventBus.emit('STATE_UPDATE', {
                    path: 'game.credits',
                    value: credits - cost
                });
                
                // Update upgrade level
                upgrades[upgradeType] = currentLevel + 1;
                this.eventBus.emit('STATE_UPDATE', {
                    path: 'player.upgrades',
                    value: upgrades
                });
                
                // Play sound
                this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
                
                // Emit success event
                this.eventBus.emit('UPGRADE_APPLIED', {
                    upgradeType: upgradeType,
                    newLevel: currentLevel + 1,
                    cost: cost,
                    newValue: this.getUpgradedValue(upgradeType, currentLevel + 1)
                });
                
                // UI notification
                this.eventBus.emit('UI_NOTIFICATION', {
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
                    this.eventBus.emit('STATE_UPDATE', {
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
                        
                        this.eventBus.emit('STATE_UPDATE', {
                            path: 'player.maxEnergy',
                            value: newMaxEnergy
                        });
                        
                        this.eventBus.emit('STATE_UPDATE', {
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
                        
                        this.eventBus.emit('STATE_UPDATE', {
                            path: 'player.maxHealth',
                            value: newMaxHealth
                        });
                        
                        this.eventBus.emit('STATE_UPDATE', {
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
                
                this.eventBus.emit('UPGRADE_INFO_RESPONSE', {
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
        
        this.eventBus.emit('STATE_UPDATE', {
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
        
        this.eventBus.emit('STATE_UPDATE', {
            path: 'player.stats',
            value: baseStats
        });
        
        this.eventBus.emit('STATE_UPDATE', {
            path: 'player.maxHealth',
            value: GameConfig.player.initialHealth
        });
        
        this.eventBus.emit('STATE_UPDATE', {
            path: 'player.maxEnergy',
            value: GameConfig.player.initialEnergy
        });
    }
}