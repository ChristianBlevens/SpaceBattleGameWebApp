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
                // Increase weapon damage - 5% per level (was 25%)
                const weapon = this.entityManager.getComponent(playerId, 'weapon');
                if (weapon) {
                    weapon.damage = weapon.damage * 1.05;
                    weapon.maxChargeTime = weapon.maxChargeTime * 0.99; // Tiny charge speed increase
                }
                
                // Update player stats
                const currentDamage = this.gameState.get('player.stats.damage') || GameConfig.player.baseDamage;
                this.gameState.update('player.stats.damage', currentDamage * 1.05);
                break;
                
            case 'speed':
                // Increase movement speed - 4% per level (was 20%)
                const physics = this.entityManager.getComponent(playerId, 'physics');
                if (physics) {
                    physics.maxSpeed = physics.maxSpeed * 1.04;
                }
                
                // Update player stats
                const currentSpeed = this.gameState.get('player.stats.speed') || GameConfig.player.baseSpeed;
                this.gameState.update('player.stats.speed', currentSpeed * 1.04);
                break;
                
            case 'defense':
                // Increase health and defense - 10 HP per level (was 30)
                const health = this.entityManager.getComponent(playerId, 'health');
                if (health) {
                    const increase = 10;
                    health.max += increase;
                    health.current += increase;
                    
                    // Update game state
                    this.gameState.update('player.maxHealth', health.max);
                    this.gameState.update('player.health', health.current);
                }
                
                // Update player stats - 3% damage reduction (was 15%)
                const currentDefense = this.gameState.get('player.stats.defense') || GameConfig.player.baseDefense;
                this.gameState.update('player.stats.defense', currentDefense * 1.03);
                break;
                
            case 'energy':
                // Increase energy capacity and regen - 10 energy per level (was 30)
                const currentMaxEnergy = this.gameState.get('player.maxEnergy');
                const newMaxEnergy = currentMaxEnergy + 10;
                this.gameState.update('player.maxEnergy', newMaxEnergy);
                this.gameState.update('player.energy', this.gameState.get('player.energy') + 10);
                
                // Increase energy regen - 5% per level (was 25%)
                const currentRegen = this.gameState.get('player.stats.energyRegen') || GameConfig.player.energyRegen;
                this.gameState.update('player.stats.energyRegen', currentRegen * 1.05);
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