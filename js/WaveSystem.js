// WaveSystem.js - Manages enemy waves and spawning

class WaveSystem {
    constructor(scene) {
        this.scene = scene;
        this.currentWave = 0;
        this.waveConfigs = [];
        this.spawnTimer = 0;
        this.spawnsRemaining = 0;
        this.nextSpawnTime = 0;
        
        // Spawn points around the map edges
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
    
    startWave(waveNumber) {
        this.currentWave = waveNumber;
        
        // Generate wave configuration
        const waveConfig = this.generateWaveConfig(waveNumber);
        
        // Update game state
        window.GameState.update('waves.current', waveNumber);
        window.GameState.update('waves.waveInProgress', true);
        window.GameState.update('waves.enemiesRemaining', waveConfig.totalEnemies);
        window.GameState.update('waves.totalEnemies', waveConfig.totalEnemies);
        window.GameState.update('waves.spawnsRemaining', waveConfig.totalEnemies);
        
        // Store wave config
        this.waveConfigs[waveNumber] = waveConfig;
        this.spawnsRemaining = waveConfig.totalEnemies;
        this.nextSpawnTime = 0;
        
        // Show wave announcement
        this.announceWave(waveNumber, waveConfig);
        
        // Emit wave start event
        window.EventBus.emit(window.GameEvents.WAVE_START, {
            wave: waveNumber,
            enemies: waveConfig.totalEnemies
        });
    }
    
    generateWaveConfig(waveNumber) {
        const baseEnemies = GameConfig.waves.baseEnemyCount;
        const multiplier = Math.pow(GameConfig.waves.enemyMultiplier, waveNumber - 1);
        const totalEnemies = Math.floor(baseEnemies * multiplier);
        
        const config = {
            wave: waveNumber,
            totalEnemies: totalEnemies,
            spawns: [],
            spawnDelay: Math.max(500, 2000 - waveNumber * 100), // Faster spawns each wave
            isBossWave: waveNumber % GameConfig.waves.bossWaveInterval === 0
        };
        
        // Determine enemy composition
        if (config.isBossWave) {
            // Boss wave - fewer but stronger enemies
            const bosses = Math.floor(1 + waveNumber / 5);
            const elites = Math.floor(totalEnemies * 0.3);
            const regulars = totalEnemies - bosses - elites;
            
            // Add titans
            for (let i = 0; i < bosses; i++) {
                config.spawns.push({ type: 'titan', faction: 'titan' });
            }
            
            // Add phantoms and sentinels
            for (let i = 0; i < elites; i++) {
                config.spawns.push({
                    type: 'elite',
                    faction: Math.random() < 0.5 ? 'phantom' : 'sentinel'
                });
            }
            
            // Fill with swarm
            for (let i = 0; i < regulars; i++) {
                config.spawns.push({ type: 'regular', faction: 'swarm' });
            }
        } else {
            // Regular wave - mixed composition
            const distribution = this.getWaveDistribution(waveNumber);
            
            Object.entries(distribution).forEach(([faction, count]) => {
                for (let i = 0; i < count; i++) {
                    config.spawns.push({
                        type: faction === 'titan' ? 'elite' : 'regular',
                        faction: faction
                    });
                }
            });
        }
        
        // Shuffle spawn order
        config.spawns = this.shuffleArray(config.spawns);
        
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
        if (!window.GameState.get('waves.waveInProgress')) return;
        
        const waveConfig = this.waveConfigs[this.currentWave];
        if (!waveConfig) return;
        
        // Update spawn timer
        this.spawnTimer += deltaTime * 1000;
        
        if (this.spawnTimer >= this.nextSpawnTime && this.spawnsRemaining > 0) {
            // Spawn next enemy
            const spawnInfo = waveConfig.spawns[waveConfig.totalEnemies - this.spawnsRemaining];
            if (spawnInfo) {
                this.spawnEnemy(spawnInfo);
                this.spawnsRemaining--;
                window.GameState.update('waves.spawnsRemaining', this.spawnsRemaining);
            }
            
            // Set next spawn time
            this.nextSpawnTime = this.spawnTimer + waveConfig.spawnDelay;
        }
    }
    
    spawnEnemy(spawnInfo) {
		// Choose random spawn point
		const spawnPoint = Phaser.Math.Pick(this.spawnPoints);
		const x = spawnPoint.x();
		const y = spawnPoint.y();
		
		// Get faction config
		const factionConfig = GameConfig.factions[spawnInfo.faction];
		if (!factionConfig) return;
		
		// Calculate initial velocity toward center
		const centerX = GameConfig.world.centerX;
		const centerY = GameConfig.world.centerY;
		const angle = Math.atan2(centerY - y, centerX - x);
		const speed = factionConfig.speed * 0.5;
		
		const initialVelocity = {
			x: Math.cos(angle) * speed,
			y: Math.sin(angle) * speed
		};
		
		// Create enemy using factory
		const factory = new EntityFactory(this.scene);
		const enemyId = factory.createEnemy(spawnInfo.faction, x, y, initialVelocity);
		
		// Spawn effect
		window.EventBus.emit(window.GameEvents.EXPLOSION, {
			x: x,
			y: y,
			type: 'spawn',
			color: factionConfig.color,
			scale: 0.8
		});
		
		// Emit spawn event
		window.EventBus.emit(window.GameEvents.ENEMY_SPAWN, {
			entityId: enemyId,
			faction: spawnInfo.faction,
			position: { x, y }
		});
	}
    
    announceWave(waveNumber, waveConfig) {
        const messages = [];
        let messageType = 'wave-start';
        
        if (waveConfig.isBossWave) {
            messages.push(`BOSS WAVE ${waveNumber}`);
            messages.push('TITANS APPROACHING!');
            messageType = 'boss-warning';
        } else {
            messages.push(`WAVE ${waveNumber}`);
            messages.push(`${waveConfig.totalEnemies} ENEMIES INCOMING`);
        }
        
        // Use UIManager to show the announcement
        window.UIManager.showGameMessage(messages[0], messages[1], messageType);
        
        // Play wave start sound
        AudioManager.play('powerup');
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}