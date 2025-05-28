// UpgradeSystem.js - Handles player upgrades and purchases

class UpgradeSystem {
    constructor(eventBus, gameState, entityManager) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.entityManager = entityManager;
        
        // Upgrade levels
        this.upgradeLevels = {
            damage: 0,
            speed: 0,
            defense: 0,
            energy: 0
        };
        
        // Upgrade costs multiplier
        this.costMultiplier = 1.5;
    }
    
    init() {
        // Listen for upgrade requests
        this.eventBus.on('UPGRADE_REQUEST', (data) => {
            this.handleUpgradeRequest(data.upgradeType);
        });
    }
    
    handleUpgradeRequest(upgradeType) {
        // Process upgrade request
        
        const currentCredits = this.gameState.get('game.credits');
        const upgradeCost = this.getUpgradeCost(upgradeType);
        
        // Validate upgrade affordability
        
        if (currentCredits >= upgradeCost) {
            // Can afford upgrade
            this.applyUpgrade(upgradeType);
            
            // Deduct credits
            this.gameState.update('game.credits', currentCredits - upgradeCost);
            
            // Update upgrade level
            this.upgradeLevels[upgradeType]++;
            
            // Emit success event
            this.eventBus.emit('UPGRADE_SUCCESS', {
                upgradeType: upgradeType,
                level: this.upgradeLevels[upgradeType],
                cost: upgradeCost
            });
            
            // Play upgrade sound
            this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
            
            // Update UI with new costs
            this.updateUpgradeCosts();
            
            // Upgrade applied
        } else {
            // Not enough credits
            // Insufficient credits
            this.eventBus.emit('UPGRADE_FAILED', {
                upgradeType: upgradeType,
                reason: 'insufficient_credits'
            });
        }
    }
    
    applyUpgrade(upgradeType) {
        const playerId = this.gameState.getPlayerId();
        if (!playerId) return;
        
        switch (upgradeType) {
            case 'damage':
                // Increase weapon damage
                const weapon = this.entityManager.getComponent(playerId, 'weapon');
                if (weapon) {
                    weapon.damage = weapon.damage * 1.2;
                    weapon.maxChargeTime = weapon.maxChargeTime * 0.9; // Faster charging
                }
                
                // Update player stats
                const currentDamage = this.gameState.get('player.stats.damage') || GameConfig.player.baseDamage;
                this.gameState.update('player.stats.damage', currentDamage * 1.2);
                break;
                
            case 'speed':
                // Increase movement speed
                const physics = this.entityManager.getComponent(playerId, 'physics');
                if (physics) {
                    physics.maxSpeed = physics.maxSpeed * 1.15;
                }
                
                // Update player stats
                const currentSpeed = this.gameState.get('player.stats.speed') || GameConfig.player.baseSpeed;
                this.gameState.update('player.stats.speed', currentSpeed * 1.15);
                break;
                
            case 'defense':
                // Increase health and defense
                const health = this.entityManager.getComponent(playerId, 'health');
                if (health) {
                    const increase = 20;
                    health.max += increase;
                    health.current += increase;
                    
                    // Update game state
                    this.gameState.update('player.maxHealth', health.max);
                    this.gameState.update('player.health', health.current);
                }
                
                // Update player stats
                const currentDefense = this.gameState.get('player.stats.defense') || GameConfig.player.baseDefense;
                this.gameState.update('player.stats.defense', currentDefense * 1.1);
                break;
                
            case 'energy':
                // Increase energy capacity and regen
                const currentMaxEnergy = this.gameState.get('player.maxEnergy');
                const newMaxEnergy = currentMaxEnergy + 20;
                this.gameState.update('player.maxEnergy', newMaxEnergy);
                this.gameState.update('player.energy', this.gameState.get('player.energy') + 20);
                
                // Increase energy regen
                const currentRegen = this.gameState.get('player.stats.energyRegen') || GameConfig.player.energyRegen;
                this.gameState.update('player.stats.energyRegen', currentRegen * 1.2);
                break;
        }
    }
    
    getUpgradeCost(upgradeType) {
        const baseCosts = {
            damage: GameConfig.upgrades.damage.base,
            speed: GameConfig.upgrades.speed.base,
            defense: GameConfig.upgrades.defense.base,
            energy: GameConfig.upgrades.energy.base
        };
        
        const level = this.upgradeLevels[upgradeType];
        const multiplier = GameConfig.upgrades[upgradeType].multiplier;
        
        return Math.floor(baseCosts[upgradeType] * Math.pow(multiplier, level));
    }
    
    updateUpgradeCosts() {
        const costs = {
            damage: this.getUpgradeCost('damage'),
            speed: this.getUpgradeCost('speed'),
            defense: this.getUpgradeCost('defense'),
            energy: this.getUpgradeCost('energy')
        };
        
        // Send updated costs to UI
        window.dispatchEvent(new CustomEvent('gameStateUpdate', {
            detail: {
                upgrades: costs
            }
        }));
    }
    
    getCurrentLevels() {
        return { ...this.upgradeLevels };
    }
}

window.UpgradeSystem = UpgradeSystem;