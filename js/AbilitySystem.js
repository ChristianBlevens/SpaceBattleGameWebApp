// AbilitySystem.js - Handles player abilities and special powers

class AbilitySystem {
    constructor(scene) {
        this.scene = scene;
        this.entityManager = window.EntityManager;
        this.gameState = window.GameState;
        
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
        
        // Cooldown tracking
        this.cooldowns = new Map();
        
        // Active effects
        this.activeEffects = new Map();
    }
    
    init() {
        // Initialize ability cooldowns
        Object.keys(this.abilities).forEach(abilityKey => {
            this.cooldowns.set(abilityKey, 0);
        });
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
    
    canActivateAbility(abilityKey) {
        const ability = this.abilities[abilityKey];
        if (!ability) return false;
        
        // Check cooldown
        if (this.cooldowns.get(abilityKey) > 0) {
            return false;
        }
        
        // Check energy
        const currentEnergy = this.gameState.get('player.energy');
        if (currentEnergy < ability.energyCost) {
            return false;
        }
        
        // Check if player is alive
        if (!this.gameState.get('player.alive')) {
            return false;
        }
        
        return true;
    }
    
    activateAbility(abilityKey) {
        if (!this.canActivateAbility(abilityKey)) {
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
        const currentEnergy = this.gameState.get('player.energy');
        this.gameState.update('player.energy', currentEnergy - ability.energyCost);
        
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
    }
    
    executeBoost() {
        const playerId = this.scene.player;
        const stats = this.gameState.get('player.stats');
        const originalSpeed = stats.speed;
        
        // Double speed
        stats.speed *= 2;
        this.gameState.update('player.stats', stats);
        
        // Visual effect
        this.scene.systems.render.setSpriteTint(playerId, 0xffff00);
        this.scene.systems.effects.createBoostEffect(playerId);
        
        // Create active effect
        const effectId = `boost_${Date.now()}`;
        this.activeEffects.set(effectId, {
            type: 'boost',
            timeRemaining: this.abilities.boost.duration,
            cleanup: () => {
                // Restore original speed
                const currentStats = this.gameState.get('player.stats');
                currentStats.speed = originalSpeed;
                this.gameState.update('player.stats', currentStats);
                
                // Clear visual effects
                this.scene.systems.render.clearSpriteTint(playerId);
            }
        });
        
        AudioManager.play('powerup');
    }
    
    executeShield() {
        const playerId = this.scene.player;
        const health = this.entityManager.getComponent(playerId, 'health');
        const transform = this.entityManager.getComponent(playerId, 'transform');
        
        if (!health || !transform) return;
        
        // Make invulnerable
        health.invulnerable = true;
        health.invulnerabilityTime = this.abilities.shield.duration;
        
        // Create shield visual
        const shield = this.scene.add.sprite(transform.x, transform.y, 'shockwave');
        shield.setScale(0.8);
        shield.setTint(0x00ffff);
        shield.setAlpha(0.5);
        shield.setBlendMode(Phaser.BlendModes.ADD);
        
        // Pulsing animation
        this.scene.tweens.add({
            targets: shield,
            scale: { from: 0.8, to: 1 },
            alpha: { from: 0.5, to: 0.3 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // Update shield position
        const updateEvent = this.scene.time.addEvent({
            delay: 16,
            callback: () => {
                const currentTransform = this.entityManager.getComponent(playerId, 'transform');
                if (currentTransform) {
                    shield.x = currentTransform.x;
                    shield.y = currentTransform.y;
                }
            },
            repeat: -1
        });
        
        // Create active effect
        const effectId = `shield_${Date.now()}`;
        this.activeEffects.set(effectId, {
            type: 'shield',
            timeRemaining: this.abilities.shield.duration,
            cleanup: () => {
                // Remove invulnerability
                health.invulnerable = false;
                
                // Remove shield visual
                updateEvent.remove();
                shield.destroy();
            }
        });
        
        AudioManager.play('powerup');
    }
    
    executeNovaBlast() {
        const playerId = this.scene.player;
        const transform = this.entityManager.getComponent(playerId, 'transform');
        
        if (!transform) return;
        
        const blastRadius = 500;
        const baseDamage = 100;
        
        // Visual effect
        this.scene.systems.effects.createShockwave(transform.x, transform.y, 0xff00ff);
        
        // Damage all enemies in radius
        const enemies = this.entityManager.getEntitiesByType('enemy');
        enemies.forEach(enemyId => {
            const enemyTransform = this.entityManager.getComponent(enemyId, 'transform');
            if (!enemyTransform) return;
            
            const dist = Phaser.Math.Distance.Between(
                transform.x, transform.y,
                enemyTransform.x, enemyTransform.y
            );
            
            if (dist <= blastRadius) {
                // Damage falls off with distance
                const damage = baseDamage * (1 - dist / blastRadius);
                this.scene.systems.combat.damageEnemy(enemyId, damage);
            }
        });
        
        // Physics explosion
        this.scene.systems.physics.createExplosionForce(
            transform.x, transform.y, 20, blastRadius
        );
        
        // Screen effects
        this.scene.systems.render.shake(500, 0.02);
        this.scene.systems.render.flash(200, 255, 0, 255);
        
        AudioManager.play('explosion');
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
            canActivate: this.canActivateAbility(abilityKey)
        };
    }
    
    getAllAbilities() {
        return Object.keys(this.abilities).map(key => ({
            key: key,
            ...this.getAbilityInfo(key)
        }));
    }
}

// Export for use
window.AbilitySystem = AbilitySystem;