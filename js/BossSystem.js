// BossSystem.js - Streamlined boss management system
// Handles boss spawning, abilities, and defeat flow

class BossSystem {
    constructor(scene, eventBus, entityManager, entityFactory) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.entityFactory = entityFactory;
        
        // Core boss state
        this.state = {
            active: false,
            currentBossId: null,
            bossNumber: 0,  // Track sequential boss number (1st boss, 2nd boss, etc.)
            afterWaveNumber: 0,  // Track which wave just completed
            abilityTimer: 0,
            nextAbilityTime: 3000
        };
        
        // Boss configuration
        this.config = {
            spawnDelay: 1000,
            baseHealth: 800,
            healthPerWave: 200,
            baseDamage: 30,
            damagePerWave: 10,
            abilityInterval: 3000,
            worldCenter: { x: 8000, y: 6000 }
        };
        
        // Define simple boss types
        this.bossTypes = this.defineBossTypes();
    }
    
    init() {
        // Core event listeners
        this.eventBus.on('START_BOSS_PHASE', (data) => this.startBossPhase(data));
        this.eventBus.on('ENTITY_DESTROYED', (data) => this.onEntityDestroyed(data));
        
        // Debug commands
        this.eventBus.on('SPAWN_DEBUG_BOSS', () => this.spawnDebugBoss());
    }
    
    defineBossTypes() {
        return [
            {
                name: 'Titan Destroyer',
                color: 0xff6666,
                scale: 2.5,
                healthMultiplier: 3.0,
                damageMultiplier: 2.0,
                speedMultiplier: 0.5,
                abilities: ['shockwave', 'summon'],
                behavior: 'aggressive'
            },
            {
                name: 'Phantom Lord',
                color: 0x9966ff,
                scale: 1.8,
                healthMultiplier: 1.5,
                damageMultiplier: 1.8,
                speedMultiplier: 1.5,
                abilities: ['teleport', 'multishot'],
                behavior: 'tactical'
            },
            {
                name: 'Void Reaper',
                color: 0x6666ff,
                scale: 2.0,
                healthMultiplier: 2.0,
                damageMultiplier: 1.5,
                speedMultiplier: 1.0,
                abilities: ['blackhole', 'beam'],
                behavior: 'tactical'
            },
            {
                name: 'Swarm Queen',
                color: 0xff66ff,
                scale: 2.2,
                healthMultiplier: 2.5,
                damageMultiplier: 1.2,
                speedMultiplier: 0.8,
                abilities: ['summon', 'heal'],
                behavior: 'defensive'
            },
            {
                name: 'Storm Bringer',
                color: 0x66ffff,
                scale: 2.0,
                healthMultiplier: 2.0,
                damageMultiplier: 2.0,
                speedMultiplier: 1.2,
                abilities: ['lightning', 'shockwave'],
                behavior: 'aggressive'
            }
        ];
    }
    
    startBossPhase(data) {
        console.log('[BossSystem] Starting boss phase after wave', data.waveNumber);
        
        this.state.afterWaveNumber = data.waveNumber;
        this.state.bossNumber++;  // Increment boss count
        this.state.abilityTimer = 0;
        this.state.nextAbilityTime = this.config.abilityInterval;
        
        // Announce boss incoming
        this.eventBus.emit('BOSS_ANNOUNCEMENT', {
            bossNumber: this.state.bossNumber,
            afterWave: data.waveNumber,
            message: 'BOSS INCOMING!'
        });
        
        // Spawn boss after delay
        this.scene.time.delayedCall(this.config.spawnDelay, () => {
            this.spawnBoss();
        });
    }
    
    spawnBoss() {
        // Select boss type based on sequential boss number
        const bossTypeIndex = (this.state.bossNumber - 1) % this.bossTypes.length;
        const bossType = this.bossTypes[bossTypeIndex];
        
        // Calculate boss stats using boss number for scaling
        const stats = this.calculateBossStats(bossType, this.state.bossNumber);
        
        // Spawn position (random edge)
        const spawnPos = this.getRandomEdgePosition();
        
        console.log('[BossSystem] Spawning boss:', {
            type: bossType.name,
            position: spawnPos,
            health: stats.health
        });
        
        // Create boss entity
        const bossId = this.entityFactory.createBoss(
            spawnPos.x,
            spawnPos.y,
            stats
        );
        
        if (!bossId) {
            console.error('[BossSystem] Failed to create boss!');
            return;
        }
        
        this.state.active = true;
        this.state.currentBossId = bossId;
        
        // Create boss health bar
        this.createBossHealthBar(stats.name, stats.health);
        
        // Emit boss spawned event
        this.eventBus.emit('BOSS_SPAWNED', {
            bossId: bossId,
            name: stats.name,
            bossNumber: this.state.bossNumber,
            afterWave: this.state.afterWaveNumber
        });
        
        // Play boss music
        this.eventBus.emit('PLAY_BOSS_MUSIC');
    }
    
    calculateBossStats(bossType, bossNumber) {
        const baseHealth = this.config.baseHealth + (bossNumber * this.config.healthPerWave);
        const baseDamage = this.config.baseDamage + (bossNumber * this.config.damagePerWave);
        
        return {
            name: bossType.name,
            health: Math.floor(baseHealth * bossType.healthMultiplier),
            maxHealth: Math.floor(baseHealth * bossType.healthMultiplier),
            damage: Math.floor(baseDamage * bossType.damageMultiplier),
            speed: 100 * bossType.speedMultiplier,
            scale: bossType.scale,
            mass: 50 * bossType.scale,
            color: bossType.color,
            abilities: bossType.abilities,
            behavior: bossType.behavior
        };
    }
    
    update(deltaTime) {
        if (!this.state.active || !this.state.currentBossId) return;
        
        // Check if boss still exists
        const boss = this.entityManager.getEntity(this.state.currentBossId);
        if (!boss || !boss.active) {
            this.endBossPhase();
            return;
        }
        
        // Update health bar
        const health = this.entityManager.getComponent(this.state.currentBossId, 'health');
        if (health) {
            this.updateBossHealthBar(health.current / health.max);
        }
        
        // Update ability timer
        this.state.abilityTimer += deltaTime * 1000;
        if (this.state.abilityTimer >= this.state.nextAbilityTime) {
            this.useRandomAbility();
            this.state.abilityTimer = 0;
            this.state.nextAbilityTime = this.config.abilityInterval + Math.random() * 2000;
        }
    }
    
    useRandomAbility() {
        const boss = this.entityManager.getEntity(this.state.currentBossId);
        if (!boss) return;
        
        const bossComponent = this.entityManager.getComponent(this.state.currentBossId, 'boss');
        if (!bossComponent || !bossComponent.abilities) return;
        
        // Pick random ability
        const ability = bossComponent.abilities[Math.floor(Math.random() * bossComponent.abilities.length)];
        
        console.log('[BossSystem] Boss using ability:', ability);
        
        // Execute ability
        switch (ability) {
            case 'shockwave':
                this.executeShockwave();
                break;
            case 'summon':
                this.executeSummon();
                break;
            case 'teleport':
                this.executeTeleport();
                break;
            case 'multishot':
                this.executeMultishot();
                break;
            case 'blackhole':
                this.executeBlackhole();
                break;
            case 'beam':
                this.executeBeam();
                break;
            case 'lightning':
                this.executeLightning();
                break;
            case 'heal':
                this.executeHeal();
                break;
        }
        
        // Emit ability event for effects
        this.eventBus.emit('BOSS_ABILITY_USED', {
            bossId: this.state.currentBossId,
            ability: ability
        });
    }
    
    // Ability implementations
    executeShockwave() {
        const transform = this.entityManager.getComponent(this.state.currentBossId, 'transform');
        if (!transform) return;
        
        this.eventBus.emit('CREATE_SHOCKWAVE', {
            x: transform.x,
            y: transform.y,
            radius: 400,
            damage: 50,
            force: 1000
        });
    }
    
    executeSummon() {
        const transform = this.entityManager.getComponent(this.state.currentBossId, 'transform');
        if (!transform) return;
        
        // Summon 3-5 minions
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const distance = 150;
            const x = transform.x + Math.cos(angle) * distance;
            const y = transform.y + Math.sin(angle) * distance;
            
            // Create minion
            const minionId = this.entityFactory.createEnemy('swarm', x, y, { x: 0, y: 0 }, 0.5);
            
            // Mark as boss minion
            const ai = this.entityManager.getComponent(minionId, 'ai');
            if (ai) {
                ai.isBossMinion = true;
            }
        }
    }
    
    executeTeleport() {
        const newPos = this.getRandomPosition();
        
        this.eventBus.emit('TELEPORT_ENTITY', {
            entityId: this.state.currentBossId,
            x: newPos.x,
            y: newPos.y
        });
        
        // Update transform
        const transform = this.entityManager.getComponent(this.state.currentBossId, 'transform');
        if (transform) {
            transform.x = newPos.x;
            transform.y = newPos.y;
        }
        
        // Update sprite
        const sprite = this.scene.sprites.get(this.state.currentBossId);
        if (sprite) {
            sprite.setPosition(newPos.x, newPos.y);
        }
    }
    
    executeMultishot() {
        const transform = this.entityManager.getComponent(this.state.currentBossId, 'transform');
        if (!transform) return;
        
        // Fire 8 projectiles in all directions
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            
            this.eventBus.emit('ENEMY_SHOOT', {
                enemyId: this.state.currentBossId,
                targetPosition: {
                    x: transform.x + Math.cos(angle) * 1000,
                    y: transform.y + Math.sin(angle) * 1000
                },
                projectileSpeed: 15,
                projectileDamage: 30
            });
        }
    }
    
    executeBlackhole() {
        const transform = this.entityManager.getComponent(this.state.currentBossId, 'transform');
        if (!transform) return;
        
        this.eventBus.emit('CREATE_BLACK_HOLE', {
            x: transform.x,
            y: transform.y,
            radius: 600,
            force: 800,
            duration: 5000
        });
    }
    
    executeBeam() {
        const player = this.entityManager.getEntitiesByType('player')[0];
        if (!player) return;
        
        this.eventBus.emit('CREATE_BEAM', {
            sourceId: this.state.currentBossId,
            targetId: player,
            damage: 5,
            duration: 2000
        });
    }
    
    executeLightning() {
        const player = this.entityManager.getEntitiesByType('player')[0];
        if (!player) return;
        
        this.eventBus.emit('CREATE_LIGHTNING', {
            sourceId: this.state.currentBossId,
            targetId: player,
            damage: 40,
            chains: 2
        });
    }
    
    executeHeal() {
        const health = this.entityManager.getComponent(this.state.currentBossId, 'health');
        if (!health) return;
        
        const healAmount = Math.floor(health.max * 0.1);
        health.current = Math.min(health.current + healAmount, health.max);
        
        this.eventBus.emit('BOSS_HEALED', {
            bossId: this.state.currentBossId,
            amount: healAmount
        });
    }
    
    onEntityDestroyed(data) {
        // Check if it's our boss
        if (data.id === this.state.currentBossId) {
            console.log('[BossSystem] Boss defeated!');
            this.endBossPhase();
        }
    }
    
    endBossPhase() {
        this.state.active = false;
        this.state.currentBossId = null;
        
        // Remove health bar
        this.removeBossHealthBar();
        
        // Calculate rewards
        const baseReward = 100;
        const bossBonus = this.state.bossNumber * 50;
        const totalCredits = baseReward + bossBonus;
        
        // Emit boss defeated event
        this.eventBus.emit('BOSS_DEFEATED', {
            bossNumber: this.state.bossNumber,
            afterWave: this.state.afterWaveNumber,
            rewards: {
                credits: totalCredits
            }
        });
        
        // Give rewards
        this.eventBus.emit('ADD_CREDITS', { amount: totalCredits });
        
        // Return to normal music
        this.eventBus.emit('PLAY_NORMAL_MUSIC');
        
        // Open ability shop after delay
        this.scene.time.delayedCall(2000, () => {
            this.eventBus.emit('OPEN_ABILITY_SHOP');
        });
    }
    
    // UI methods
    createBossHealthBar(name, maxHealth) {
        this.eventBus.emit('CREATE_BOSS_HEALTH_BAR', {
            name: name,
            maxHealth: maxHealth
        });
    }
    
    updateBossHealthBar(percent) {
        this.eventBus.emit('UPDATE_BOSS_HEALTH_BAR', {
            percent: percent
        });
    }
    
    removeBossHealthBar() {
        this.eventBus.emit('REMOVE_BOSS_HEALTH_BAR');
    }
    
    // Helper methods
    getRandomEdgePosition() {
        const edge = Math.floor(Math.random() * 4);
        const margin = 200;
        
        switch (edge) {
            case 0: // Top
                return { x: Math.random() * 16000, y: margin };
            case 1: // Right
                return { x: 16000 - margin, y: Math.random() * 12000 };
            case 2: // Bottom
                return { x: Math.random() * 16000, y: 12000 - margin };
            case 3: // Left
                return { x: margin, y: Math.random() * 12000 };
        }
    }
    
    getRandomPosition() {
        return {
            x: 1000 + Math.random() * 14000,
            y: 1000 + Math.random() * 10000
        };
    }
    
    // Debug methods
    spawnDebugBoss() {
        console.log('[BossSystem] Spawning debug boss');
        this.startBossPhase({ waveNumber: 1 });
    }
    
    getDebugInfo() {
        return {
            active: this.state.active,
            bossId: this.state.currentBossId,
            bossNumber: this.state.bossNumber,
            afterWave: this.state.afterWaveNumber,
            abilityTimer: this.state.abilityTimer
        };
    }
}

window.BossSystem = BossSystem;