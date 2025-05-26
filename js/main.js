// main.js - Game Entry Point and Configuration

// Global game configuration
const GameConfig = {
    // World settings
    world: {
        width: 16000,
        height: 12000,
        centerX: 8000,
        centerY: 6000
    },
    
    // Physics constants
    physics: {
        gravity: 0.01,
        spiralForce: 0.0003,
        damping: 0.999,
        maxVelocity: 15,
        gravitationFalloff: 1.5
    },
    
    // Player settings
    player: {
        initialHealth: 100,
        initialEnergy: 100,
        baseSpeed: 0.8,
        baseDamage: 10,
        baseDefense: 10,
        chargeRate: 2.0,
        energyRegen: 0.5
    },
    
    // Enemy factions
    factions: {
        swarm: {
            color: 0xff6666,
            behavior: 'aggressive',
            speed: 5.5,
            health: 30,
            damage: 8,
            size: 0.7,
            spawnCount: 15
        },
        sentinel: {
            color: 0x66ff66,
            behavior: 'defensive',
            speed: 4.0,
            health: 60,
            damage: 12,
            size: 1.2,
            spawnCount: 8
        },
        phantom: {
            color: 0x9966ff,
            behavior: 'stealth',
            speed: 6.0,
            health: 40,
            damage: 15,
            size: 0.9,
            spawnCount: 10
        },
        titan: {
            color: 0xff9966,
            behavior: 'boss',
            speed: 3.0,
            health: 200,
            damage: 25,
            size: 2.0,
            spawnCount: 3
        }
    },
    
    // Wave system
    waves: {
        baseEnemyCount: 10,
        enemyMultiplier: 1.3,
        bossWaveInterval: 5,
        waveDelay: 3000
    },
    
    // Upgrade costs
    upgrades: {
        damage: { base: 50, multiplier: 1.5 },
        speed: { base: 40, multiplier: 1.4 },
        defense: { base: 60, multiplier: 1.6 },
        energy: { base: 45, multiplier: 1.45 }
    },
    
    // Effects settings
    effects: {
        explosionParticles: 50,
        trailLength: 20,
        screenShakeIntensity: 10,
        glowIntensity: 1.5
    }
};

// Phaser game configuration
const phaserConfig = {
    type: Phaser.WEBGL,
    width: 1280,
    height: 720,
    backgroundColor: '#000033',
    parent: 'game-container',
    physics: {
        default: 'matter',
        matter: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [BootScene, MenuScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: false
    },
    audio: {
        disableWebAudio: false
    }
};

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the game
    const game = new Phaser.Game(phaserConfig);
    
    // Store game reference globally for debugging only
    window._game = game;
    
    // Handle window resize
    window.addEventListener('resize', () => {
        game.scale.refresh();
    });
    
    // Handle visibility change (pause when tab is not visible)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            game.scene.scenes.forEach(scene => {
                if (scene.scene.key === 'Game' && scene.scene.isActive()) {
                    scene.eventBus?.emit('GAME_PAUSE', { paused: true });
                }
            });
        }
    });
    
    // Log successful initialization
    console.log('Gravity Wars: Cosmic Arena initialized');
});

// Export configuration for use in other modules
window.GameConfig = GameConfig;