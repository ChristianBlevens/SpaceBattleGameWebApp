// WaveSystem.js - Enemy wave management and progression
// Handles wave generation, enemy spawning patterns, and progression logic

class WaveSystem {
    constructor(scene, eventBus, gameState, entityFactory) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.entityFactory = entityFactory;
        this.currentWave = 0;
        this.waveConfigs = [];
        this.spawnTimer = 0;
        this.spawnsRemaining = 0;
        this.nextSpawnTime = 0;
        this.bossPhase = false;
        this.awaitingBossDefeat = false;
        
        // Dynamic spawn points for edge spawning
        this.spawnPoints = [
            // Top edge
            { x: () => Phaser.Math.Between(1000, GameConfig.world.width - 1000), y: () => 100 },
            // Bottom edge
            { x: () => Phaser.Math.Between(1000, GameConfig.world.width - 1000), y: () => GameConfig.world.height - 100 },
            // Left edge
            { x: () => 100, y: () => Phaser.Math.Between(1000, GameConfig.world.height - 1000) },
            // Right edge
            { x: () => GameConfig.world.width - 100, y: () => Phaser.Math.Between(1000, GameConfig.world.height - 1000) }
        ];
    }
    
    init() {
        // Initialize event handlers
        this.eventBus.on('GAME_START', () => {
            this.reset();
        });
        
        // Listen for enemy deaths to check wave completion
        this.eventBus.on('ENEMY_KILLED', () => {
            this.checkWaveComplete();
        });
        
        // Listen for boss defeat
        this.eventBus.on('BOSS_DEFEATED', () => {
            this.onBossDefeated();
        });
        
        // Listen for continue after boss
        this.eventBus.on('CONTINUE_TO_NEXT_WAVE', () => {
            this.continueToNextWave();
        });
        
        // Listen for enemy spawn requests
        this.eventBus.on('SPAWN_ENEMY', (data) => {
            this.spawnEnemy(data);
        });
    }
    
    reset() {
        this.currentWave = 0;
        this.waveConfigs = [];
        this.spawnTimer = 0;
        this.spawnsRemaining = 0;
        this.nextSpawnTime = 0;
        this.bossPhase = false;
        this.awaitingBossDefeat = false;
    }
    
    startWave(waveNumber) {
        this.currentWave = waveNumber;
        
        // Generate wave configuration
        const waveConfig = this.generateWaveConfig(waveNumber);
        
        // Update game state
        this.gameState.update('waves.current', waveNumber);
        this.gameState.update('waves.waveInProgress', true);
        this.gameState.update('waves.enemiesRemaining', waveConfig.totalEnemies);
        this.gameState.update('waves.totalEnemies', waveConfig.totalEnemies);
        this.gameState.update('waves.spawnsRemaining', waveConfig.totalEnemies);
        
        //console.log('[WaveSystem] Wave started:', {
            //waveNumber,
            //totalEnemies: waveConfig.totalEnemies,
            //waveInProgress: true
        //});
        
        // Store wave config
        this.waveConfigs[waveNumber] = waveConfig;
        this.spawnsRemaining = waveConfig.totalEnemies;
        this.nextSpawnTime = 0;
        
        //console.log('[WaveSystem] Wave config generated:', {
            //wave: waveNumber,
            //totalEnemies: waveConfig.totalEnemies,
            //spawnsRemaining: this.spawnsRemaining,
            //spawnDelay: waveConfig.spawnDelay,
            //spawns: waveConfig.spawns
        //});
        
        // Emit wave announcement event
        this.eventBus.emit('WAVE_ANNOUNCED', {
            waveNumber: waveNumber,
            isBossWave: waveConfig.isBossWave,
            enemyCount: waveConfig.totalEnemies
        });
        
        // Emit wave start event
        this.eventBus.emit('WAVE_START', {
            wave: waveNumber,
            enemies: waveConfig.totalEnemies
        });
        
        // Play wave start sound
        this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
    }
    
    generateWaveConfig(waveNumber) {
        // Base enemy counts scaled by wave
        const baseSwarm = 20;
        const baseSentinel = 10;
        const basePhantom = 10;
        const baseTitan = 3;
        
        // Apply exponential scaling per wave
        const swarmCount = Math.floor(baseSwarm * Math.pow(1.2, waveNumber - 1));
        const sentinelCount = Math.floor(baseSentinel * Math.pow(1.15, waveNumber - 1));
        const phantomCount = Math.floor(basePhantom * Math.pow(1.15, waveNumber - 1));
        const titanCount = Math.floor(baseTitan * Math.pow(1.1, waveNumber - 1));
        
        const totalEnemies = swarmCount + sentinelCount + phantomCount + titanCount;
        
        const config = {
            wave: waveNumber,
            totalEnemies: totalEnemies,
            spawns: [],
            spawnDelay: 100, // Fast spawning for groups
            isBossWave: waveNumber % GameConfig.waves.bossWaveInterval === 0,
            // Store spawn patterns
            swarmPositions: [],
            sentinelPositions: [],
            titanPositions: []
        };
        
        // Generate tactical spawn patterns
        
        // Swarm formation - clustered group spawn
        const swarmCenter = this.getRandomMapPosition();
        for (let i = 0; i < swarmCount; i++) {
            const offset = this.getClusterOffset(i, 50); // Small spacing
            config.spawns.push({ 
                type: 'swarm', 
                faction: 'swarm',
                position: {
                    x: swarmCenter.x + offset.x,
                    y: swarmCenter.y + offset.y
                }
            });
        }
        
        // Sentinel formation - defensive line
        const sentinelLine = this.getLinePositions(sentinelCount, 450);
        for (let i = 0; i < sentinelCount; i++) {
            config.spawns.push({
                type: 'sentinel',
                faction: 'sentinel',
                position: sentinelLine[i]
            });
        }
        
        // Phantom distribution - scattered stealth units
        for (let i = 0; i < phantomCount; i++) {
            config.spawns.push({
                type: 'phantom',
                faction: 'phantom',
                position: this.getRandomMapPosition()
            });
        }
        
        // Titan placement - widely separated heavy units
        const titanPositions = this.getDistributedPositions(titanCount);
        for (let i = 0; i < titanCount; i++) {
            config.spawns.push({
                type: 'titan',
                faction: 'titan',
                position: titanPositions[i]
            });
        }
        
        // Increase enemy strength each wave
        config.strengthMultiplier = 1 + (waveNumber - 1) * 0.1;
        
        return config;
    }
    
    getWaveDistribution(waveNumber) {
        const total = Math.floor(GameConfig.waves.baseEnemyCount * Math.pow(GameConfig.waves.enemyMultiplier, waveNumber - 1));
        
        // Faction distribution changes with waves
        let swarmPercent = 0.5 - (waveNumber * 0.02);
        let sentinelPercent = 0.2 + (waveNumber * 0.01);
        let phantomPercent = 0.2 + (waveNumber * 0.01);
        let titanPercent = Math.min(0.1, waveNumber * 0.02);
        
        // Normalize
        const totalPercent = swarmPercent + sentinelPercent + phantomPercent + titanPercent;
        swarmPercent /= totalPercent;
        sentinelPercent /= totalPercent;
        phantomPercent /= totalPercent;
        titanPercent /= totalPercent;
        
        return {
            swarm: Math.floor(total * swarmPercent),
            sentinel: Math.floor(total * sentinelPercent),
            phantom: Math.floor(total * phantomPercent),
            titan: Math.floor(total * titanPercent)
        };
    }
    
    update(deltaTime) {
        // Skip if no active wave
        if (!this.gameState.get('waves.waveInProgress')) {
            return;
        }
        
        const waveConfig = this.waveConfigs[this.currentWave];
        if (!waveConfig) {
            //console.log('[WaveSystem] update: No wave config for wave', this.currentWave);
            return;
        }
        
        // Update spawn timer
        this.spawnTimer += deltaTime * 1000;
        
        if (this.spawnTimer >= this.nextSpawnTime && this.spawnsRemaining > 0) {
            // Spawn next enemy
            const spawnInfo = waveConfig.spawns[waveConfig.totalEnemies - this.spawnsRemaining];
            if (spawnInfo) {
                //console.log('[WaveSystem] Spawning enemy:', spawnInfo);
                this.spawnEnemy(spawnInfo);
                this.spawnsRemaining--;
                this.gameState.update('waves.spawnsRemaining', this.spawnsRemaining);
            }
            
            // Set next spawn time
            this.nextSpawnTime = this.spawnTimer + waveConfig.spawnDelay;
        }
    }
    
    spawnEnemy(spawnInfo) {
        //console.log('[WaveSystem] spawnEnemy called with:', spawnInfo);
        
        let x, y;
        
        // Use predefined position if available
        if (spawnInfo.position) {
            x = spawnInfo.position.x;
            y = spawnInfo.position.y;
        } else {
            // Fallback to random spawn point
            const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
            x = spawnPoint.x();
            y = spawnPoint.y();
        }
        
        // Ensure position is within bounds
        x = Math.max(100, Math.min(GameConfig.world.width - 100, x));
        y = Math.max(100, Math.min(GameConfig.world.height - 100, y));
        
        //console.log('[WaveSystem] Spawn position:', { x, y });
        
        // Get faction config
        const factionConfig = GameConfig.factions[spawnInfo.faction];
        if (!factionConfig) {
            console.error('[WaveSystem] No faction config for:', spawnInfo.faction);
            return;
        }
        
        // Calculate initial velocity toward center
        const centerX = GameConfig.world.centerX;
        const centerY = GameConfig.world.centerY;
        const angle = Math.atan2(centerY - y, centerX - x);
        const speed = factionConfig.speed * 0.5;
        
        const initialVelocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        
        //console.log('[WaveSystem] Creating enemy with velocity:', initialVelocity);
        
        // Create enemy using factory with strength multiplier
        const waveConfig = this.waveConfigs[this.currentWave];
        const strengthMultiplier = waveConfig ? waveConfig.strengthMultiplier : 1;
        
        const enemyId = this.entityFactory.createEnemy(
            spawnInfo.faction, 
            x, 
            y, 
            initialVelocity,
            strengthMultiplier,
            spawnInfo.isNecromancerMinion // Pass necromancer minion flag
        );
        
        //console.log('[WaveSystem] Enemy created with ID:', enemyId);
        
        // Emit spawn event for other systems
        this.eventBus.emit('ENEMY_SPAWNED', {
            entityId: enemyId,
            faction: spawnInfo.faction,
            position: { x, y }
        });
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    checkWaveComplete() {
        const enemiesRemaining = this.gameState.get('waves.enemiesRemaining');
        const waveInProgress = this.gameState.get('waves.waveInProgress');
        
        //console.log('[WaveSystem] Checking wave complete:', {
            //enemiesRemaining,
            //waveInProgress,
            //spawnsRemaining: this.spawnsRemaining
        //});
        
        if (waveInProgress && enemiesRemaining <= 0 && this.spawnsRemaining <= 0) {
            // Wave complete!
            const waveNumber = this.currentWave;
            const waveConfig = this.waveConfigs[waveNumber];
            
            // Update state
            this.gameState.update('waves.waveInProgress', false);
            
            // Don't give rewards here - CombatSystem handles wave rewards
            // Just emit the wave complete event
            this.eventBus.emit('WAVE_COMPLETE', {
                waveNumber: waveNumber,
                isBossWave: waveConfig.isBossWave
            });
            
            // Play victory sound
            this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
            
            // Start boss phase after delay
            this.scene.time.delayedCall(3000, () => {
                this.startBossPhase();
            });
        }
    }
    
    getCurrentWaveInfo() {
        const waveConfig = this.waveConfigs[this.currentWave];
        if (!waveConfig) return null;
        
        return {
            waveNumber: this.currentWave,
            totalEnemies: waveConfig.totalEnemies,
            enemiesRemaining: this.gameState.get('waves.enemiesRemaining'),
            spawnsRemaining: this.spawnsRemaining,
            isBossWave: waveConfig.isBossWave,
            inProgress: this.gameState.get('waves.waveInProgress')
        };
    }
    
    // Helper methods for spawn positioning
    getRandomMapPosition() {
        const margin = 200;
        return {
            x: Phaser.Math.Between(margin, GameConfig.world.width - margin),
            y: Phaser.Math.Between(margin, GameConfig.world.height - margin)
        };
    }
    
    getClusterOffset(index, spacing) {
        // Generate hexagonal formation positions
        const ring = Math.floor((Math.sqrt(1 + 8 * index) - 1) / 2);
        const indexInRing = index - (ring * (ring + 1)) / 2;
        const angle = (indexInRing / Math.max(1, ring * 6)) * Math.PI * 2;
        
        return {
            x: Math.cos(angle) * ring * spacing,
            y: Math.sin(angle) * ring * spacing
        };
    }
    
    getLinePositions(count, spacing) {
        // Create linear formation along map edge
        const positions = [];
        const edge = Math.floor(Math.random() * 4);
        
        const margin = 200;
        const totalLength = (count - 1) * spacing;
        
        for (let i = 0; i < count; i++) {
            let x, y;
            const offset = i * spacing - totalLength / 2;
            
            switch (edge) {
                case 0: // Top edge
                    x = GameConfig.world.centerX + offset;
                    y = margin;
                    break;
                case 1: // Right edge
                    x = GameConfig.world.width - margin;
                    y = GameConfig.world.centerY + offset;
                    break;
                case 2: // Bottom edge
                    x = GameConfig.world.centerX + offset;
                    y = GameConfig.world.height - margin;
                    break;
                case 3: // Left edge
                    x = margin;
                    y = GameConfig.world.centerY + offset;
                    break;
            }
            
            positions.push({ x, y });
        }
        
        return positions;
    }
    
    getDistributedPositions(count) {
        // Distribute entities across map sectors
        const positions = [];
        const sections = [];
        
        // Create grid-based sectors
        const sectionWidth = GameConfig.world.width / Math.ceil(Math.sqrt(count));
        const sectionHeight = GameConfig.world.height / Math.ceil(Math.sqrt(count));
        
        // Create all possible sections
        for (let x = 0; x < Math.ceil(Math.sqrt(count)); x++) {
            for (let y = 0; y < Math.ceil(Math.sqrt(count)); y++) {
                sections.push({
                    x: x * sectionWidth + sectionWidth / 2,
                    y: y * sectionHeight + sectionHeight / 2
                });
            }
        }
        
        // Shuffle sections and pick positions
        const shuffledSections = this.shuffleArray(sections);
        for (let i = 0; i < count && i < shuffledSections.length; i++) {
            const section = shuffledSections[i];
            positions.push({
                x: section.x + Phaser.Math.Between(-sectionWidth/4, sectionWidth/4),
                y: section.y + Phaser.Math.Between(-sectionHeight/4, sectionHeight/4)
            });
        }
        
        return positions;
    }
    
    startBossPhase() {
        this.bossPhase = true;
        this.awaitingBossDefeat = true;
        this.gameState.update('waves.bossPhase', true);
        
        // Announce boss phase
        this.eventBus.emit('BOSS_PHASE_ANNOUNCEMENT', {
            waveNumber: this.currentWave
        });
        
        // Start boss phase after announcement
        this.scene.time.delayedCall(2000, () => {
            this.eventBus.emit('START_BOSS_PHASE', {
                waveNumber: this.currentWave
            });
        });
    }
    
    onBossDefeated() {
        if (!this.awaitingBossDefeat) return;
        
        this.bossPhase = false;
        this.awaitingBossDefeat = false;
        this.gameState.update('waves.bossPhase', false);
        
        // Boss defeated announcement will be handled by BossSystem
    }
    
    continueToNextWave() {
        const nextWave = this.currentWave + 1;
        
        if (nextWave <= 20) { // Campaign length
            this.scene.time.delayedCall(3000, () => {
                this.startWave(nextWave);
            });
        } else {
            // Victory condition reached
            this.eventBus.emit('GAME_VICTORY');
        }
    }
}

window.WaveSystem = WaveSystem;