// BossSystem.js - Streamlined boss management system
// Handles boss spawning, orchestration, and defeat flow

class BossSystem {
    constructor(scene, eventBus, entityManager, entityFactory) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.entityFactory = entityFactory;
        this.gameState = null; // Will be set by GameInitializer
    }
    
    init() {
        // Core event listeners
        this.eventBus.on('START_BOSS_PHASE', (data) => this.startBossPhase(data));
        this.eventBus.on('ENTITY_DESTROYED', (data) => this.onEntityDestroyed(data));
        this.eventBus.on('BOSS_ABILITY_USED', (data) => this.onAbilityUsed(data));
        
        // Debug commands
        this.eventBus.on('SPAWN_DEBUG_BOSS', () => this.spawnDebugBoss());
    }
    
    getBossTypes() {
        return GameConstants.BOSSES.TYPES;
    }
    
    startBossPhase(data) {
        console.log('[BossSystem] Starting boss phase after wave', data.waveNumber);
        
        const bossNumber = this.gameState.get('boss.bossNumber') + 1;
        this.gameState.update('boss.afterWaveNumber', data.waveNumber);
        this.gameState.update('boss.bossNumber', bossNumber);
        
        // Announce boss incoming
        this.eventBus.emit('BOSS_ANNOUNCEMENT', {
            bossNumber: bossNumber,
            afterWave: data.waveNumber,
            message: 'BOSS INCOMING!'
        });
        
        // Spawn boss after delay
        this.scene.time.delayedCall(GameConstants.BOSSES.SPAWN_DELAY, () => {
            this.spawnBoss();
        });
    }
    
    spawnBoss() {
        // Select boss type based on sequential boss number
        const bossTypes = this.getBossTypes();
        const bossNumber = this.gameState.get('boss.bossNumber');
        const bossTypeIndex = (bossNumber - 1) % bossTypes.length;
        const bossType = bossTypes[bossTypeIndex];
        
        // Calculate boss stats using boss number for scaling
        const stats = this.calculateBossStats(bossType, bossNumber);
        
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
        
        this.gameState.update('boss.active', true);
        this.gameState.update('boss.currentBossId', bossId);
        
        // Create boss health bar
        this.createBossHealthBar(stats.name, stats.health);
        
        // Emit boss spawned event
        this.eventBus.emit('BOSS_SPAWNED', {
            bossId: bossId,
            name: stats.name,
            bossNumber: bossNumber,
            afterWave: this.gameState.get('boss.afterWaveNumber')
        });
        
        // Play boss music
        this.eventBus.emit('PLAY_BOSS_MUSIC');
    }
    
    calculateBossStats(bossType, bossNumber) {
        const baseHealth = GameConstants.BOSSES.BASE_HEALTH + (bossNumber * GameConstants.BOSSES.HEALTH_PER_WAVE);
        const baseDamage = GameConstants.BOSSES.BASE_DAMAGE + (bossNumber * GameConstants.BOSSES.DAMAGE_PER_WAVE);
        
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
        const active = this.gameState.get('boss.active');
        const currentBossId = this.gameState.get('boss.currentBossId');
        
        if (!active || !currentBossId) return;
        
        // Check if boss still exists
        const boss = this.entityManager.getEntity(currentBossId);
        if (!boss || !boss.active) {
            this.endBossPhase();
            return;
        }
        
        // Update health bar and state
        const health = this.entityManager.getComponent(currentBossId, 'health');
        if (health) {
            const healthPercent = health.current / health.max;
            this.updateBossHealthBar(healthPercent);
            this.gameState.update('boss.healthPercent', Math.round(healthPercent * 100));
        }
    }
    
    // Listen for ability events from AI system
    onAbilityUsed(data) {
        const currentBossId = this.gameState.get('boss.currentBossId');
        if (data.bossId === currentBossId) {
            console.log('[BossSystem] Boss used ability:', data.ability);
        }
    }
    
    onEntityDestroyed(data) {
        // Check if it's our boss
        const currentBossId = this.gameState.get('boss.currentBossId');
        if (data.id === currentBossId) {
            console.log('[BossSystem] Boss defeated!');
            this.endBossPhase();
        }
    }
    
    endBossPhase() {
        this.gameState.update('boss.active', false);
        this.gameState.update('boss.currentBossId', null);
        
        // Remove health bar
        this.removeBossHealthBar();
        
        // Calculate rewards
        const bossNumber = this.gameState.get('boss.bossNumber');
        const afterWaveNumber = this.gameState.get('boss.afterWaveNumber');
        const baseReward = GameConstants.BOSSES.REWARDS.BASE_CREDITS;
        const bossBonus = bossNumber * GameConstants.BOSSES.REWARDS.CREDITS_PER_BOSS;
        const totalCredits = baseReward + bossBonus;
        
        // Emit boss defeated event
        this.eventBus.emit('BOSS_DEFEATED', {
            bossNumber: bossNumber,
            afterWave: afterWaveNumber,
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
        const width = GameConstants.WORLD.WIDTH;
        const height = GameConstants.WORLD.HEIGHT;
        
        switch (edge) {
            case 0: // Top
                return { x: Math.random() * width, y: margin };
            case 1: // Right
                return { x: width - margin, y: Math.random() * height };
            case 2: // Bottom
                return { x: Math.random() * width, y: height - margin };
            case 3: // Left
                return { x: margin, y: Math.random() * height };
        }
    }
    
    // Debug methods
    spawnDebugBoss() {
        console.log('[BossSystem] Spawning debug boss');
        this.startBossPhase({ waveNumber: 1 });
    }
    
    getDebugInfo() {
        return {
            active: this.gameState.get('boss.active'),
            bossId: this.gameState.get('boss.currentBossId'),
            bossNumber: this.gameState.get('boss.bossNumber'),
            afterWave: this.gameState.get('boss.afterWaveNumber')
        };
    }
}

window.BossSystem = BossSystem;