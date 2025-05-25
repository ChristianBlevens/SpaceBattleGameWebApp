// CombatSystem.js - Handles all combat-related logic including damage, death, and pickups

class CombatSystem {
    constructor(scene) {
        this.scene = scene;
        this.entityManager = window.EntityManager;
        this.gameState = window.GameState;
    }
    
    init() {
        // Initialize combat system
    }
    
    update(deltaTime, entityManager) {
        // Update invulnerability timers
        const healthEntities = entityManager.query('health');
        
        healthEntities.forEach(entityId => {
            const health = entityManager.getComponent(entityId, 'health');
            
            if (health.invulnerabilityTime > 0) {
                health.invulnerabilityTime -= deltaTime * 1000;
                if (health.invulnerabilityTime <= 0) {
                    health.invulnerable = false;
                }
            }
            
            // Health regeneration
            if (health.regen > 0 && health.current < health.max) {
                health.current = Math.min(health.max, health.current + health.regen * deltaTime);
            }
        });
        
        // Update combo timer
        const comboTimer = this.gameState.get('game.comboTimer');
        if (comboTimer > 0) {
            const newTimer = Math.max(0, comboTimer - deltaTime * 1000);
            this.gameState.update('game.comboTimer', newTimer);
            
            if (newTimer === 0) {
                this.gameState.breakCombo();
            }
        }
    }
    
    handleProjectileHit(data) {
        const targetEntity = this.entityManager.getEntity(data.targetId);
        if (!targetEntity) return;
        
        if (targetEntity.type === 'player') {
            this.damagePlayer(data.damage);
        } else if (targetEntity.type === 'enemy') {
            this.damageEnemy(data.targetId, data.damage);
        }
    }
    
    damagePlayer(damage) {
        const health = this.entityManager.getComponent(this.scene.player, 'health');
        if (!health || health.invulnerable) return;
        
        const actualDamage = this.gameState.damagePlayer(damage);
        
        if (actualDamage > 0) {
            // Visual feedback
            this.scene.systems.render.shake(200, 0.01);
            this.scene.systems.render.flash(100, 255, 0, 0, true);
            AudioManager.play('hit');
            
            // UI feedback
            window.EventBus.emit(window.GameEvents.PLAYER_DAMAGE, { damage: actualDamage });
        }
    }
    
    damageEnemy(enemyId, damage) {
        const health = this.entityManager.getComponent(enemyId, 'health');
        const transform = this.entityManager.getComponent(enemyId, 'transform');
        
        if (!health) return;
        
        // Apply damage
        health.current -= damage;
        
        // Visual feedback
        this.scene.systems.render.flashSprite(enemyId, 0xff0000);
        
        if (health.current <= 0) {
            // Enemy defeated
            window.EventBus.emit(window.GameEvents.ENEMY_DEATH, {
                entityId: enemyId,
                position: { x: transform.x, y: transform.y }
            });
            
            // Destroy enemy
            this.scene.systems.render.destroySprite(enemyId);
            this.entityManager.destroyEntity(enemyId);
        } else {
            // Still alive
            AudioManager.play('hit');
            this.scene.systems.effects.createDamageNumber(transform.x, transform.y, damage);
        }
    }
    
    handleEnemyDeath(data) {
        // Update game state
        const combo = this.gameState.get('game.combo');
        const points = 100 * (combo + 1);
        
        this.gameState.addScore(points);
        this.gameState.addCredits(50);
        this.gameState.incrementCombo();
        
        const totalKills = this.gameState.get('game.totalKills') + 1;
        this.gameState.update('game.totalKills', totalKills);
        
        const remaining = this.gameState.get('waves.enemiesRemaining') - 1;
        this.gameState.update('waves.enemiesRemaining', remaining);
        
        // Effects
        this.scene.systems.effects.createExplosion(data.position.x, data.position.y);
        this.scene.systems.effects.createDamageNumber(
            data.position.x, 
            data.position.y, 
            points, 
            combo > 5
        );
        
        // Spawn powerup chance
        if (Math.random() < 0.3) {
            const factory = new EntityFactory(this.scene);
            const type = Phaser.Math.Pick(['health', 'energy', 'credits']);
            factory.createPowerup(data.position.x, data.position.y, type);
        }
        
        // Check wave completion
        if (remaining <= 0 && this.gameState.get('waves.spawnsRemaining') <= 0) {
            window.EventBus.emit(window.GameEvents.WAVE_COMPLETE);
        }
    }
    
    handlePlayerDeath() {
        const transform = this.entityManager.getComponent(this.scene.player, 'transform');
        if (!transform) return;
        
        // Death explosion
        this.scene.systems.effects.createExplosion(
            transform.x,
            transform.y,
            2.0,
            0x00ffff
        );
        
        // Visual effects
        this.scene.systems.render.setSpriteVisible(this.scene.player, false);
        this.scene.systems.render.shake(1000, 0.03);
        this.scene.systems.render.flash(1000, 255, 0, 0);
        
        // Delay before game over
        this.scene.time.delayedCall(2000, () => {
            this.scene.handleGameOver();
        });
    }
    
    handlePickupCollect(data) {
        const powerup = this.entityManager.getComponent(data.powerupId, 'powerup');
        const transform = this.entityManager.getComponent(data.powerupId, 'transform');
        
        if (!powerup || !transform || powerup.collected) return;
        
        powerup.collected = true;
        
        // Apply effect based on type
        switch (data.type) {
            case 'health':
                this.gameState.healPlayer(data.value);
                window.EventBus.emit(window.GameEvents.PLAYER_HEAL, { amount: data.value });
                break;
                
            case 'energy':
                const currentEnergy = this.gameState.get('player.energy');
                const maxEnergy = this.gameState.get('player.maxEnergy');
                this.gameState.update('player.energy', Math.min(maxEnergy, currentEnergy + data.value));
                break;
                
            case 'credits':
                this.gameState.addCredits(data.value);
                break;
        }
        
        // Effects and cleanup
        this.scene.systems.effects.createPowerupCollect(transform.x, transform.y, data.type);
        this.scene.systems.render.destroySprite(data.powerupId);
        this.entityManager.destroyEntity(data.powerupId);
        
        AudioManager.play('powerup');
    }
    
    processWaveRewards(waveNumber) {
        // Calculate and apply wave completion rewards
        const waveBonus = 1000 * waveNumber;
        this.gameState.addScore(waveBonus);
        this.gameState.addCredits(500 * waveNumber);
        
        this.gameState.update('waves.waveInProgress', false);
        
        // Notification
        window.EventBus.emit(window.GameEvents.UI_NOTIFICATION, {
            message: `Wave ${waveNumber} Complete! +${waveBonus} points`,
            type: 'success',
            icon: 'fa-trophy'
        });
    }
    
    handleUpgrade(stat) {
        const stats = this.gameState.get('player.stats');
        const upgrades = this.gameState.get('player.upgrades');
        const credits = this.gameState.get('game.credits');
        
        const upgradeValues = {
            damage: { stat: 5, key: 'damage', cost: 50 },
            speed: { stat: 0.2, key: 'speed', cost: 40 },
            defense: { stat: 3, key: 'defense', cost: 60 }
        };
        
        const upgrade = upgradeValues[stat];
        if (!upgrade) return;
        
        // Calculate cost
        const currentLevel = upgrades[stat] || 0;
        const cost = Math.floor(upgrade.cost * Math.pow(1.5, currentLevel));
        
        if (credits >= cost) {
            // Apply upgrade
            stats[upgrade.key] += upgrade.stat;
            upgrades[stat] = currentLevel + 1;
            
            this.gameState.update('player.stats', stats);
            this.gameState.update('player.upgrades', upgrades);
            this.gameState.update('game.credits', credits - cost);
            
            AudioManager.play('powerup');
            
            window.EventBus.emit(window.GameEvents.PLAYER_UPGRADE, {
                stat: stat,
                level: currentLevel + 1
            });
        } else {
            window.EventBus.emit(window.GameEvents.UI_NOTIFICATION, {
                message: 'Not enough credits!',
                type: 'error',
                icon: 'fa-coins'
            });
        }
    }
}

// Export for use
window.CombatSystem = CombatSystem;