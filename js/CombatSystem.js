// CombatSystem.js - Handles all combat-related logic including damage calculation and validation
// REFACTORED: Removed rendering, UI, and upgrade responsibilities. Now purely handles combat logic.

class CombatSystem {
    constructor(scene, eventBus, entityManager, gameState) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.gameState = gameState;
    }
    
    init() {
        // Listen for collision events from PhysicsSystem
        this.eventBus.on('COLLISION_DETECTED', (data) => {
            this.handleCollision(data);
        });
        
        // Listen for damage events
        this.eventBus.on('PROJECTILE_HIT', (data) => {
            this.handleProjectileHit(data);
        });
        
        // Listen for enemy shoot requests
        this.eventBus.on('ENEMY_SHOOT_REQUEST', (data) => {
            this.handleEnemyShootRequest(data);
        });
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
                this.eventBus.emit('COMBO_BREAK');
            }
        }
    }
    
    handleCollision(data) {
        const { entityA, entityB, type } = data;
        
        if (type === 'projectile') {
            // Validate projectile collision
            const projectileData = this.entityManager.getComponent(entityA, 'projectile');
            if (!projectileData) return;
            
            // Check if can damage target
            if (this.canDamageTarget(entityA, entityB)) {
                // Check if already hit (for penetrating projectiles)
                if (!projectileData.hitEntities.has(entityB)) {
                    projectileData.hitEntities.add(entityB);
                    
                    // Apply damage
                    this.applyDamage(entityB, projectileData.damage, entityA);
                    
                    // Destroy projectile if not penetrating
                    if (!projectileData.penetrating) {
                        this.eventBus.emit('DESTROY_ENTITY', {
                            entityId: entityA
                        });
                    }
                }
            }
        } else if (type === 'powerup') {
            // Handle powerup collection
            const powerupData = this.entityManager.getComponent(entityB, 'powerup');
            if (powerupData && !powerupData.collected) {
                powerupData.collected = true;
                this.collectPowerup(entityA, entityB, powerupData);
            }
        }
    }
    
    handleProjectileHit(data) {
        const targetEntity = this.entityManager.getEntity(data.targetId);
        if (!targetEntity) return;
        
        this.applyDamage(data.targetId, data.damage, data.projectileId);
    }
    
    handleEnemyShootRequest(data) {
        // Validate the shoot request
        const weapon = this.entityManager.getComponent(data.shooterId, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return;
        
        // Add some inaccuracy based on AI skill
        const ai = this.entityManager.getComponent(data.shooterId, 'ai');
        if (ai) {
            const accuracy = 1 - (ai.fearLevel * 0.3);
            const spread = (1 - accuracy) * 0.3;
            data.angle += (Math.random() - 0.5) * spread;
        }
        
        // Forward to weapon system
        this.eventBus.emit('ENEMY_SHOOT', data);
    }
    
    canDamageTarget(projectileId, targetId) {
        const projectileData = this.entityManager.getComponent(projectileId, 'projectile');
        const targetEntity = this.entityManager.getEntity(targetId);
        
        if (!projectileData || !targetEntity) return false;
        
        // Can't damage self
        if (projectileData.ownerId === targetId) return false;
        
        // Can't damage other projectiles or powerups
        if (targetEntity.type === 'projectile' || targetEntity.type === 'powerup') return false;
        
        // Can't damage planets
        if (targetEntity.type === 'planet') return false;
        
        // Check factions
        const targetFaction = this.entityManager.getComponent(targetId, 'faction');
        if (targetFaction && projectileData.ownerFaction) {
            if (targetFaction.name === projectileData.ownerFaction) return false;
            if (targetFaction.friendlyWith.has(projectileData.ownerFaction)) return false;
        }
        
        return true;
    }
    
    applyDamage(targetId, damage, sourceId = null) {
        const targetEntity = this.entityManager.getEntity(targetId);
        if (!targetEntity) return;
        
        if (targetEntity.type === 'player') {
            this.damagePlayer(damage);
        } else if (targetEntity.type === 'enemy') {
            this.damageEnemy(targetId, damage);
        }
    }
    
    damagePlayer(damage) {
        const playerId = this.gameState.getPlayerId();
        const health = this.entityManager.getComponent(playerId, 'health');
        if (!health || health.invulnerable) return;
        
        const actualDamage = this.gameState.damagePlayer(damage);
        
        if (actualDamage > 0) {
            // Only emit event for other systems to handle
            this.eventBus.emit('PLAYER_DAMAGED', { 
                damage: actualDamage 
            });
            
            // Play sound
            this.eventBus.emit('AUDIO_PLAY', { sound: 'hit' });
        }
    }
    
    damageEnemy(enemyId, damage) {
        const health = this.entityManager.getComponent(enemyId, 'health');
        const transform = this.entityManager.getComponent(enemyId, 'transform');
        
        if (!health) return;
        
        // Apply damage
        health.current -= damage;
        
        if (health.current <= 0) {
            // Enemy defeated
            this.handleEnemyDeath(enemyId, transform);
        } else {
            // Enemy damaged but alive
            this.eventBus.emit('ENEMY_DAMAGED', {
                entityId: enemyId,
                damage: damage,
                position: transform ? { x: transform.x, y: transform.y } : null
            });
            
            // Play sound
            this.eventBus.emit('AUDIO_PLAY', { sound: 'hit' });
        }
    }
    
    handleEnemyDeath(enemyId, transform) {
        console.log('[CombatSystem] Enemy death:', enemyId);
        // Update game state
        const combo = this.gameState.get('game.combo');
        const points = 100 * (combo + 1);
        
        this.gameState.addScore(points);
        this.gameState.addCredits(50);
        this.gameState.incrementCombo();
        
        const totalKills = this.gameState.get('game.totalKills') + 1;
        this.gameState.update('game.totalKills', totalKills);
        
        const remaining = this.gameState.get('waves.enemiesRemaining') - 1;
        console.log('[CombatSystem] Enemies remaining after death:', remaining);
        this.gameState.update('waves.enemiesRemaining', remaining);
        
        // Emit events for other systems
        this.eventBus.emit('ENEMY_KILLED', {
            entityId: enemyId,
            position: transform ? { x: transform.x, y: transform.y } : null,
            points: points,
            combo: combo + 1
        });
        
        // Spawn powerup chance
        if (Math.random() < 0.3 && transform) {
            const types = ['health', 'energy', 'credits'];
            const type = types[Math.floor(Math.random() * types.length)];
            this.eventBus.emit('SPAWN_POWERUP', {
                x: transform.x,
                y: transform.y,
                type: type
            });
        }
        
        // Check wave completion
        const spawnsRemaining = this.gameState.get('waves.spawnsRemaining');
        console.log('[CombatSystem] Wave check - Enemies:', remaining, 'Spawns:', spawnsRemaining);
        if (remaining <= 0 && spawnsRemaining <= 0) {
            console.log('[CombatSystem] Wave complete! Emitting WAVE_COMPLETE event');
            this.eventBus.emit('WAVE_COMPLETE');
        }
        
        // Destroy the entity
        this.eventBus.emit('DESTROY_ENTITY', {
            entityId: enemyId
        });
    }
    
    collectPowerup(playerId, powerupId, powerupData) {
        const transform = this.entityManager.getComponent(powerupId, 'transform');
        
        // Apply effect based on type
        switch (powerupData.type) {
            case 'health':
                this.gameState.healPlayer(powerupData.value);
                this.eventBus.emit('PLAYER_HEAL', { 
                    amount: powerupData.value 
                });
                break;
                
            case 'energy':
                const currentEnergy = this.gameState.get('player.energy');
                const maxEnergy = this.gameState.get('player.maxEnergy');
                this.gameState.update('player.energy', 
                    Math.min(maxEnergy, currentEnergy + powerupData.value)
                );
                break;
                
            case 'credits':
                this.gameState.addCredits(powerupData.value);
                break;
        }
        
        // Emit collection event
        this.eventBus.emit('POWERUP_COLLECTED', {
            powerupId: powerupId,
            type: powerupData.type,
            value: powerupData.value,
            position: transform ? { x: transform.x, y: transform.y } : null
        });
        
        // Play sound
        this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
        
        // Destroy the powerup
        this.eventBus.emit('DESTROY_ENTITY', {
            entityId: powerupId
        });
    }
    
    handlePlayerDeath() {
        const playerId = this.gameState.getPlayerId();
        const transform = this.entityManager.getComponent(playerId, 'transform');
        
        // Emit death event
        this.eventBus.emit('PLAYER_DIED', {
            position: transform ? { x: transform.x, y: transform.y } : null
        });
        
        // Update game state
        this.gameState.update('game.gameOver', true);
        
        // Delay before game over
        this.scene.time.delayedCall(2000, () => {
            this.eventBus.emit('GAME_OVER', {
                victory: false
            });
        });
    }
    
    processWaveRewards(waveNumber) {
        console.log('[CombatSystem] Processing wave rewards for wave', waveNumber);
        // Calculate and apply wave completion rewards
        const waveBonus = 1000 * waveNumber;
        this.gameState.addScore(waveBonus);
        this.gameState.addCredits(500 * waveNumber);
        
        console.log('[CombatSystem] Setting waveInProgress to false');
        this.gameState.update('waves.waveInProgress', false);
        
        // Emit reward event
        this.eventBus.emit('WAVE_REWARDS', {
            waveNumber: waveNumber,
            points: waveBonus,
            credits: 500 * waveNumber
        });
    }
}

// CombatSystem will be instantiated by GameInitializer
window.CombatSystem = CombatSystem;