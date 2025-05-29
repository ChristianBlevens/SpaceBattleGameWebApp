// WaveSystem.js - Complete wave management and progression system
// Handles wave spawning, completion, and boss phase transitions

class WaveSystem {
    constructor(scene, eventBus, gameState, entityFactory) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.entityFactory = entityFactory;
        
        // Core wave state
        this.state = {
            currentWave: 0,
            phase: 'IDLE', // IDLE, SPAWNING, ACTIVE, COMPLETE, BOSS_TRANSITION, BOSS_ACTIVE, POST_BOSS
            enemiesSpawned: 0,
            totalEnemies: 0,
            initialEnemyCount: 0,  // Track initial count at wave start
            enemiesAlive: 0,       // Track currently alive enemies
            spawnQueue: [],
            spawnTimer: 0,
            spawnDelay: 100
        };
        
        // Configuration
        this.config = {
            baseEnemyCount: 10,
            waveMultiplier: 1.3,
            spawnDelay: 100,
            waveStartDelay: 3000,
            bossTransitionDelay: 2000
        };
        
        // World boundaries for spawning
        this.worldBounds = {
            width: 16000,
            height: 12000,
            margin: 100
        };
    }
    
    init() {
        // Core event listeners
        this.eventBus.on('GAME_START', () => this.startGame());
        this.eventBus.on('START_WAVE', (data) => this.startWave(data.waveNumber));
        this.eventBus.on('ENEMY_KILLED', () => this.onEnemyKilled());
        this.eventBus.on('BOSS_DEFEATED', () => this.onBossDefeated());
        this.eventBus.on('ABILITY_SHOP_CLOSED', () => this.onAbilityShopClosed());
        
        // Debug commands
        this.eventBus.on('KILL_ALL_ENEMIES', () => this.killAllEnemies());
    }
    
    startGame() {
        console.log('[WaveSystem] Game started, preparing first wave');
        this.state.currentWave = 0;
        this.state.phase = 'IDLE';
        
        // Initialize wave state in game state
        this.gameState.update('waves.current', 0);
        this.gameState.update('waves.totalEnemies', 0);
        this.gameState.update('waves.enemiesRemaining', 0);
        this.gameState.update('waves.enemiesKilled', 0);
        this.gameState.update('waves.initialEnemyCount', 0);
        this.gameState.update('waves.phase', 'IDLE');
        
        // Start first wave after delay
        this.scene.time.delayedCall(this.config.waveStartDelay, () => {
            this.startWave(1);
        });
    }
    
    startWave(waveNumber) {
        console.log(`[WaveSystem] Starting wave ${waveNumber}`);
        
        // Update state
        this.state.currentWave = waveNumber;
        this.state.phase = 'SPAWNING';
        this.state.enemiesSpawned = 0;
        this.state.spawnTimer = 0;
        
        // Generate wave configuration
        const waveConfig = this.generateWaveConfig(waveNumber);
        this.state.totalEnemies = waveConfig.enemies.length;
        this.state.initialEnemyCount = waveConfig.enemies.length;  // Save initial count
        this.state.enemiesAlive = 0;  // Reset alive count
        this.state.spawnQueue = [...waveConfig.enemies];
        
        // Update game state
        this.gameState.update('waves.current', waveNumber);
        this.gameState.update('waves.totalEnemies', this.state.totalEnemies);
        this.gameState.update('waves.initialEnemyCount', this.state.initialEnemyCount);
        this.gameState.update('waves.enemiesRemaining', this.state.totalEnemies);
        this.gameState.update('waves.enemiesKilled', 0);
        this.gameState.update('waves.phase', 'SPAWNING');
        
        // Emit wave start event
        this.eventBus.emit('WAVE_STARTED', {
            waveNumber: waveNumber,
            totalEnemies: this.state.totalEnemies
        });
        
        console.log(`[WaveSystem] Wave ${waveNumber} config:`, {
            totalEnemies: this.state.totalEnemies
        });
    }
    
    generateWaveConfig(waveNumber) {
        // Calculate enemy counts with scaling
        const totalEnemies = Math.floor(
            this.config.baseEnemyCount * Math.pow(this.config.waveMultiplier, waveNumber - 1)
        );
        
        // Enemy type distribution
        const distribution = this.getWaveDistribution(waveNumber);
        const enemies = [];
        
        // Generate swarm enemies (clustered spawning)
        const swarmCount = Math.floor(totalEnemies * distribution.swarm);
        const swarmCenter = this.getRandomEdgePosition();
        for (let i = 0; i < swarmCount; i++) {
            const offset = this.getClusterOffset(i, 50);
            enemies.push({
                type: 'swarm',
                position: {
                    x: swarmCenter.x + offset.x,
                    y: swarmCenter.y + offset.y
                }
            });
        }
        
        // Generate sentinel enemies (defensive line)
        const sentinelCount = Math.floor(totalEnemies * distribution.sentinel);
        const sentinelPositions = this.getLineFormation(sentinelCount);
        sentinelPositions.forEach(pos => {
            enemies.push({
                type: 'sentinel',
                position: pos
            });
        });
        
        // Generate phantom enemies (scattered)
        const phantomCount = Math.floor(totalEnemies * distribution.phantom);
        for (let i = 0; i < phantomCount; i++) {
            enemies.push({
                type: 'phantom',
                position: this.getRandomEdgePosition()
            });
        }
        
        // Generate titan enemies (distributed)
        const titanCount = Math.floor(totalEnemies * distribution.titan);
        const titanPositions = this.getDistributedPositions(titanCount);
        titanPositions.forEach(pos => {
            enemies.push({
                type: 'titan',
                position: pos
            });
        });
        
        // Shuffle spawn order for variety
        return {
            enemies: this.shuffleArray(enemies),
            strengthMultiplier: 1 + (waveNumber - 1) * 0.1
        };
    }
    
    getWaveDistribution(waveNumber) {
        // Adjust distribution based on wave progression
        const swarmBase = 0.5;
        const sentinelBase = 0.2;
        const phantomBase = 0.2;
        const titanBase = 0.1;
        
        // Gradually shift distribution
        const progression = Math.min(waveNumber / 20, 1);
        
        return {
            swarm: swarmBase - (progression * 0.2),
            sentinel: sentinelBase + (progression * 0.05),
            phantom: phantomBase + (progression * 0.1),
            titan: titanBase + (progression * 0.05)
        };
    }
    
    update(deltaTime) {
        // Convert deltaTime to milliseconds
        const dt = deltaTime * 1000;
        
        switch (this.state.phase) {
            case 'SPAWNING':
                this.updateSpawning(dt);
                break;
            case 'ACTIVE':
                // Wave is active, waiting for enemies to be defeated
                break;
            case 'BOSS_TRANSITION':
            case 'BOSS_ACTIVE':
            case 'POST_BOSS':
                // Boss phases handled by BossSystem
                break;
        }
    }
    
    updateSpawning(dt) {
        this.state.spawnTimer += dt;
        
        // Check if it's time to spawn next enemy
        if (this.state.spawnTimer >= this.config.spawnDelay && this.state.spawnQueue.length > 0) {
            const enemyConfig = this.state.spawnQueue.shift();
            this.spawnEnemy(enemyConfig);
            this.state.enemiesSpawned++;
            this.state.spawnTimer = 0;
            
            // Check if all enemies spawned
            if (this.state.spawnQueue.length === 0) {
                this.state.phase = 'ACTIVE';
                this.gameState.update('waves.phase', 'ACTIVE');
                console.log('[WaveSystem] All enemies spawned, wave is now active');
            }
        }
    }
    
    spawnEnemy(config) {
        const { type, position } = config;
        
        // Calculate initial velocity toward center
        const centerX = this.worldBounds.width / 2;
        const centerY = this.worldBounds.height / 2;
        const angle = Math.atan2(centerY - position.y, centerX - position.x);
        const speed = 5;
        
        const velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        
        // Get strength multiplier for current wave
        const strengthMultiplier = 1 + (this.state.currentWave - 1) * 0.1;
        
        // Create enemy through factory
        const enemyId = this.entityFactory.createEnemy(
            type,
            position.x,
            position.y,
            velocity,
            strengthMultiplier
        );
        
        // Increment alive count
        this.state.enemiesAlive++;
        this.updateEnemyCounts();
        
        // Emit spawn event
        this.eventBus.emit('ENEMY_SPAWNED', {
            id: enemyId,
            type: type,
            faction: type, // faction and type are the same for enemies
            position: position,
            wave: this.state.currentWave
        });
    }
    
    onEnemyKilled() {
        // Decrement alive count
        if (this.state.enemiesAlive > 0) {
            this.state.enemiesAlive--;
            this.updateEnemyCounts();
            
            console.log(`[WaveSystem] Enemy killed, ${this.state.enemiesAlive} alive`);
            
            // Check wave completion
            if (this.state.enemiesAlive === 0 && this.state.phase === 'ACTIVE') {
                this.onWaveComplete();
            }
        }
    }
    
    updateEnemyCounts() {
        // Calculate killed count from initial count - alive count
        const killed = this.state.initialEnemyCount - this.state.enemiesAlive;
        
        // Update game state with accurate counts
        this.gameState.update('waves.enemiesRemaining', this.state.enemiesAlive);
        this.gameState.update('waves.enemiesKilled', killed);
    }
    
    onWaveComplete() {
        console.log(`[WaveSystem] Wave ${this.state.currentWave} completed!`);
        this.state.phase = 'COMPLETE';
        this.gameState.update('waves.phase', 'COMPLETE');
        
        // Emit wave complete event
        this.eventBus.emit('WAVE_COMPLETED', {
            waveNumber: this.state.currentWave
        });
        
        // Always transition to boss phase after every wave
        this.scene.time.delayedCall(this.config.bossTransitionDelay, () => {
            this.startBossTransition();
        });
    }
    
    startBossTransition() {
        console.log('[WaveSystem] Starting boss transition');
        this.state.phase = 'BOSS_TRANSITION';
        this.gameState.update('waves.phase', 'BOSS_TRANSITION');
        
        // Clear remaining enemies
        this.clearAllEnemies();
        
        // Notify boss system
        this.eventBus.emit('START_BOSS_PHASE', {
            waveNumber: this.state.currentWave
        });
        
        // Update phase after boss spawns
        this.scene.time.delayedCall(500, () => {
            this.state.phase = 'BOSS_ACTIVE';
            this.gameState.update('waves.phase', 'BOSS_ACTIVE');
        });
    }
    
    onBossDefeated() {
        console.log('[WaveSystem] Boss defeated');
        this.state.phase = 'POST_BOSS';
        this.gameState.update('waves.phase', 'POST_BOSS');
        
        // Ability shop will open automatically via BossSystem events
    }
    
    onAbilityShopClosed() {
        console.log('[WaveSystem] Ability shop closed, starting next wave');
        
        // Start next wave
        this.scene.time.delayedCall(this.config.waveStartDelay, () => {
            this.startWave(this.state.currentWave + 1);
        });
    }
    
    clearAllEnemies() {
        console.log('[WaveSystem] Clearing all enemies');
        
        // Get all enemy entities
        const enemies = this.entityFactory.entityManager.getEntitiesByType('enemy');
        let cleared = 0;
        
        enemies.forEach(enemyId => {
            // Skip boss minions if needed
            const ai = this.entityFactory.entityManager.getComponent(enemyId, 'ai');
            if (ai && ai.isBossMinion) {
                return;
            }
            
            // Destroy enemy without rewards
            this.entityFactory.entityManager.destroyEntity(enemyId);
            cleared++;
        });
        
        console.log(`[WaveSystem] Cleared ${cleared} enemies`);
        this.state.enemiesAlive = 0;
        this.updateEnemyCounts();
    }
    
    
    // Helper methods for spawn positions
    getRandomEdgePosition() {
        const edge = Math.floor(Math.random() * 4);
        const { width, height, margin } = this.worldBounds;
        
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
    
    getClusterOffset(index, spacing) {
        const angle = (index / 6) * Math.PI * 2;
        const radius = Math.floor(index / 6) * spacing;
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius
        };
    }
    
    getLineFormation(count) {
        const positions = [];
        const edge = Math.floor(Math.random() * 4);
        const spacing = 150;
        
        for (let i = 0; i < count; i++) {
            const offset = (i - count / 2) * spacing;
            let x, y;
            
            switch (edge) {
                case 0: // Top
                    x = this.worldBounds.width / 2 + offset;
                    y = this.worldBounds.margin;
                    break;
                case 1: // Right
                    x = this.worldBounds.width - this.worldBounds.margin;
                    y = this.worldBounds.height / 2 + offset;
                    break;
                case 2: // Bottom
                    x = this.worldBounds.width / 2 + offset;
                    y = this.worldBounds.height - this.worldBounds.margin;
                    break;
                case 3: // Left
                    x = this.worldBounds.margin;
                    y = this.worldBounds.height / 2 + offset;
                    break;
            }
            
            positions.push({ x, y });
        }
        
        return positions;
    }
    
    getDistributedPositions(count) {
        const positions = [];
        const sections = Math.ceil(Math.sqrt(count));
        const sectionWidth = this.worldBounds.width / sections;
        const sectionHeight = this.worldBounds.height / sections;
        
        for (let i = 0; i < count; i++) {
            const sx = i % sections;
            const sy = Math.floor(i / sections);
            
            positions.push({
                x: (sx + 0.5) * sectionWidth + (Math.random() - 0.5) * sectionWidth * 0.5,
                y: (sy + 0.5) * sectionHeight + (Math.random() - 0.5) * sectionHeight * 0.5
            });
        }
        
        return positions;
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    
    killAllEnemies() {
        console.log('[WaveSystem] Debug: Killing all enemies');
        const enemies = this.entityFactory.entityManager.getEntitiesByType('enemy');
        const playerId = this.gameState.getPlayerId();
        enemies.forEach(enemyId => {
            // Use the CombatSystem's damage handling
            this.eventBus.emit('DAMAGE_ENTITY', {
                entityId: enemyId,
                damage: 99999,
                sourceId: playerId  // Set player as source so kills are properly credited
            });
        });
    }
    
    getDebugInfo() {
        return {
            currentWave: this.state.currentWave,
            phase: this.state.phase,
            initialEnemyCount: this.state.initialEnemyCount,
            enemiesAlive: this.state.enemiesAlive,
            enemiesKilled: this.state.initialEnemyCount - this.state.enemiesAlive,
            enemiesRemaining: this.gameState.get('waves.enemiesRemaining'),
            spawnQueue: this.state.spawnQueue.length
        };
    }
}

window.WaveSystem = WaveSystem;