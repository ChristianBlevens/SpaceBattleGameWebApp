// CombatSystem.js - Combat mechanics and damage resolution
// Handles collision response, damage calculation, and combat events

class CombatSystem {
    constructor(scene, eventBus, entityManager, gameState) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.gameState = gameState;
    }
    
    init() {
        // Register collision handlers
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
        
        // Listen for titan slam attacks
        this.eventBus.on('TITAN_SLAM', (data) => {
            this.handleTitanSlam(data);
        });
        
        // Listen for debug enemy deaths
        this.eventBus.on('COMBAT_ENEMY_DEATH', (data) => {
            this.handleEnemyDeath(data.entityId, data.transform);
        });
        
        // Listen for direct damage events (e.g., from debug commands)
        this.eventBus.on('DAMAGE_ENTITY', (data) => {
            this.applyDamage(data.entityId, data.damage, data.sourceId);
        });
        
        // Listen for area damage events
        this.eventBus.on('AREA_DAMAGE', (data) => {
            this.applyAreaDamage(data.x, data.y, data.radius, data.damage, data.sourceId, data.options);
        });
    }
    
    update(deltaTime, entityManager) {
        // Process combat state updates
        const healthEntities = entityManager.query('health');
        
        healthEntities.forEach(entityId => {
            const health = entityManager.getComponent(entityId, 'health');
            
            if (health.invulnerabilityTime > 0) {
                health.invulnerabilityTime -= deltaTime * 1000;
                if (health.invulnerabilityTime <= 0) {
                    health.invulnerable = false;
                }
            }
            
            // Apply health regeneration
            if (health.regen > 0 && health.current < health.max) {
                health.current = Math.min(health.max, health.current + health.regen * deltaTime);
            }
        });
        
        // Manage combo system timing
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
            // Process projectile impact
            const projectileData = this.entityManager.getComponent(entityA, 'projectile');
            if (!projectileData) return;
            
            // Validate damage eligibility
            if (this.canDamageTarget(entityA, entityB)) {
                // Track penetrating projectile hits
                if (!projectileData.hitEntities.has(entityB)) {
                    projectileData.hitEntities.add(entityB);
                    
                    // Apply damage with sourceId being the projectile owner
                    //console.log(`[CombatSystem] Projectile hit: ${projectileData.damage} damage from ${projectileData.ownerId}`);
                    this.applyDamage(entityB, projectileData.damage, projectileData.ownerId);
                    
                    // Destroy projectile if not penetrating
                    if (!projectileData.penetrating) {
                        this.eventBus.emit('DESTROY_ENTITY', {
                            entityId: entityA
                        });
                    }
                }
            } else {
                // Check if target is a planet - planets block projectiles
                const targetEntity = this.entityManager.getEntity(entityB);
                if (targetEntity && targetEntity.type === 'planet') {
                    // Destroy projectile when it hits a planet
                    this.eventBus.emit('DESTROY_ENTITY', {
                        entityId: entityA
                    });
                    
                    // Create impact effect
                    const transform = this.entityManager.getComponent(entityA, 'transform');
                    if (transform) {
                        this.eventBus.emit('PROJECTILE_EXPIRED', {
                            projectileId: entityA,
                            position: { x: transform.x, y: transform.y }
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
        // Check if this is a minion spawn request
        if (data.spawnInfo) {
            // Forward minion spawn to wave system
            this.eventBus.emit('SPAWN_ENEMY', data.spawnInfo);
            return;
        }
        
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
        // Determine if projectile can damage target based on faction and type
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
        } else if (targetEntity.type === 'enemy' || targetEntity.type === 'boss') {
            this.damageEnemy(targetId, damage, sourceId);
        }
    }
    
    damagePlayer(damage) {
        const playerId = this.gameState.getPlayerId();
        const health = this.entityManager.getComponent(playerId, 'health');
        if (!health || health.invulnerable) return;
        
        // Calculate damage with defense
        const defense = this.gameState.get('player.stats.defense');
        const actualDamage = Math.max(1, damage - defense * 0.5);
        
        // Update health through GameState
        const currentHealth = this.gameState.get('player.health');
        const newHealth = Math.max(0, currentHealth - actualDamage);
        this.gameState.update('player.health', newHealth);
        this.gameState.update('game.totalDamageTaken', this.gameState.get('game.totalDamageTaken') + actualDamage);
        
        if (newHealth <= 0) {
            this.gameState.update('player.alive', false);
            this.gameState.update('game.gameOver', true);
            this.handlePlayerDeath();
        } else if (actualDamage > 0) {
            // Only emit event for other systems to handle
            this.eventBus.emit('PLAYER_DAMAGED', { 
                damage: actualDamage 
            });
            
            // Play sound
            this.eventBus.emit('AUDIO_PLAY', { sound: 'hit' });
        }
    }
    
    damageEnemy(enemyId, damage, sourceId = null) {
        // Apply damage to enemy with boss modifiers
        const health = this.entityManager.getComponent(enemyId, 'health');
        const transform = this.entityManager.getComponent(enemyId, 'transform');
        const entity = this.entityManager.getEntity(enemyId);
        
        if (!health) return;
        
        // Check for boss special properties
        let actualDamage = damage;
        if (entity && entity.type === 'boss') {
            const bossComponent = this.entityManager.getComponent(enemyId, 'boss');
            if (bossComponent) {
                // Apply damage reduction from tank trait
                const damageReduction = this.getBossDamageReduction(enemyId);
                actualDamage = Math.floor(damage * (1 - damageReduction));
                
                // Check phantom dodge chance
                if (this.checkBossDodge(enemyId)) {
                    this.eventBus.emit('BOSS_DODGED', {
                        entityId: enemyId,
                        position: transform ? { x: transform.x, y: transform.y } : null
                    });
                    return; // Attack missed
                }
            }
        }
        
        //console.log(`[CombatSystem] Damaging enemy ${enemyId}: ${actualDamage} damage, current health: ${health.current}/${health.max}`);
        
        // Apply damage
        health.current -= actualDamage;
        
        if (health.current <= 0) {
            // Enemy defeated - pass sourceId to handleEnemyDeath
            this.handleEnemyDeath(enemyId, transform, sourceId);
        } else {
            // Enemy damaged but alive
            this.eventBus.emit('ENEMY_DAMAGED', {
                entityId: enemyId,
                damage: actualDamage,
                position: transform ? { x: transform.x, y: transform.y } : null
            });
            
            // Play sound
            this.eventBus.emit('AUDIO_PLAY', { sound: 'hit' });
        }
    }
    
    handleEnemyDeath(enemyId, transform, sourceId = null) {
        //console.log('[CombatSystem] Enemy death:', enemyId, 'killed by:', sourceId);
        // Update game state
        const combo = this.gameState.get('game.combo');
        const points = 100 * (combo + 1);
        
        // Always add score for any kill
        this.gameState.addScore(points);
        
        // Only give credits if the player killed the enemy
        const playerId = this.gameState.getPlayerId();
        if (sourceId === playerId) {
            // Different credit rewards based on enemy type
            const entity = this.entityManager.getEntity(enemyId);
            let creditReward = 5; // Default for basic enemies
            
            if (entity) {
                const ai = this.entityManager.getComponent(enemyId, 'ai');
                if (ai && ai.faction) {
                    // Different rewards for different factions
                    switch (ai.faction) {
                        case 'swarm':
                            creditReward = 3; // Weakest enemies
                            break;
                        case 'sentinel':
                            creditReward = 5; // Medium enemies
                            break;
                        case 'phantom':
                            creditReward = 7; // Harder enemies
                            break;
                        case 'titan':
                            creditReward = 15; // Toughest regular enemies
                            break;
                    }
                }
                
                // Boss gives more
                if (entity.type === 'boss') {
                    creditReward = 100; // Boss kill bonus
                }
            }
            
            this.gameState.addCredits(creditReward);
            this.gameState.incrementCombo();
        }
        
        const totalKills = this.gameState.get('game.totalKills') + 1;
        this.gameState.update('game.totalKills', totalKills);
        
        // Emit events for other systems
        this.eventBus.emit('ENEMY_KILLED', {
            entityId: enemyId,
            position: transform ? { x: transform.x, y: transform.y } : null,
            points: points,
            combo: combo + 1,
            killedByPlayer: sourceId === playerId
        });
        
        // Spawn powerup chance - only if player killed it
        if (sourceId === playerId && Math.random() < 0.3 && transform) {
            const types = ['health', 'energy', 'credits'];
            const type = types[Math.floor(Math.random() * types.length)];
            this.eventBus.emit('SPAWN_POWERUP', {
                x: transform.x,
                y: transform.y,
                type: type
            });
        }
        
        // The WaveSystem will handle wave completion detection
        // Just emit the enemy killed event and let WaveSystem check if wave is complete
        
        // Destroy the entity
        this.eventBus.emit('DESTROY_ENTITY', {
            entityId: enemyId
        });
    }
    
    collectPowerup(playerId, powerupId, powerupData) {
        const transform = this.entityManager.getComponent(powerupId, 'transform');
        
        // Apply powerup effect by type
        switch (powerupData.type) {
            case 'health':
                const currentHealth = this.gameState.get('player.health');
                const maxHealth = this.gameState.get('player.maxHealth');
                const actualHeal = Math.min(powerupData.value, maxHealth - currentHealth);
                this.gameState.update('player.health', currentHealth + actualHeal);
                this.eventBus.emit('PLAYER_HEAL', { 
                    amount: actualHeal 
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
        // Award wave completion bonuses - significantly reduced
        const waveBonus = 1000 * waveNumber; // Score stays the same
        const creditBonus = 50 + (waveNumber * 10); // Was 500 * waveNumber
        
        this.gameState.addScore(waveBonus);
        this.gameState.addCredits(creditBonus);
        
        //console.log('[CombatSystem] Setting waveInProgress to false');
        this.gameState.update('waves.waveInProgress', false);
        
        // Emit reward event
        this.eventBus.emit('WAVE_REWARDS', {
            waveNumber: waveNumber,
            points: waveBonus,
            credits: creditBonus
        });
    }
    
    handleTitanSlam(data) {
        // Use the general area damage method
        this.applyAreaDamage(data.x, data.y, data.radius, data.damage, data.attackerId, {
            knockback: data.knockback,
            falloff: true,
            friendlyFire: false,
            damageType: 'slam'
        });
        
        // Visual effect
        this.eventBus.emit('TITAN_SHOCKWAVE_VISUAL', {
            x: data.x,
            y: data.y,
            radius: data.radius
        });
        
        // Sound effect
        this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
    }
    
    // Boss-specific damage calculation helpers
    getBossDamageReduction(bossId) {
        // Get boss special properties through event system
        const bossData = this.getBossData(bossId);
        if (!bossData || !bossData.specialProperties) return 0;
        
        return bossData.specialProperties.damageReduction || 0;
    }
    
    checkBossDodge(bossId) {
        const bossData = this.getBossData(bossId);
        if (!bossData || !bossData.specialProperties) return false;
        
        const dodgeChance = bossData.specialProperties.dodgeChance || 0;
        return Math.random() < dodgeChance;
    }
    
    getBossData(bossId) {
        // Request boss data from BossSystem via event
        let bossData = null;
        this.eventBus.emit('REQUEST_BOSS_DATA', {
            bossId: bossId,
            callback: (data) => { bossData = data; }
        });
        return bossData;
    }
    
    // General area damage method for explosions, meteor impacts, etc.
    applyAreaDamage(x, y, radius, damage, sourceId = null, options = {}) {
        const {
            falloff = true,           // Damage decreases with distance
            knockback = 0,            // Knockback force
            damageType = 'explosion', // For special resistances
            excludeSelf = true,       // Don't damage source
            friendlyFire = false      // Can damage allies
        } = options;
        
        const entities = this.entityManager.query('transform', 'health');
        const sourceEntity = sourceId ? this.entityManager.getEntity(sourceId) : null;
        const sourceFaction = sourceEntity ? this.entityManager.getComponent(sourceId, 'faction') : null;
        
        entities.forEach(entityId => {
            // Skip self if excluded
            if (excludeSelf && entityId === sourceId) return;
            
            const transform = this.entityManager.getComponent(entityId, 'transform');
            const entity = this.entityManager.getEntity(entityId);
            
            if (!transform || !entity) return;
            
            // Skip non-damageable entities
            if (entity.type === 'planet' || entity.type === 'catastrophe' || entity.type === 'projectile') return;
            
            // Calculate distance
            const dx = transform.x - x;
            const dy = transform.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > radius) return;
            
            // Check friendly fire
            if (!friendlyFire && sourceFaction) {
                const targetFaction = this.entityManager.getComponent(entityId, 'faction');
                if (targetFaction && targetFaction.name === sourceFaction.name) return;
            }
            
            // Calculate damage with falloff
            let finalDamage = damage;
            if (falloff && dist > 0) {
                const damageFalloff = 1 - (dist / radius);
                finalDamage = Math.floor(damage * damageFalloff);
            }
            
            if (finalDamage > 0) {
                this.applyDamage(entityId, finalDamage, sourceId);
                
                // Apply knockback
                if (knockback > 0 && dist > 0) {
                    const physics = this.entityManager.getComponent(entityId, 'physics');
                    if (physics) {
                        const knockbackForce = knockback * (falloff ? (1 - dist / radius) : 1);
                        physics.velocity.x += (dx / dist) * knockbackForce / physics.mass;
                        physics.velocity.y += (dy / dist) * knockbackForce / physics.mass;
                    }
                }
            }
        });
    }
}

// CombatSystem will be instantiated by GameInitializer
window.CombatSystem = CombatSystem;