// main.js - Game Entry Point and Configuration
// Initializes Phaser game and Alpine.js UI bindings

document.addEventListener('alpine:init', () => {
    Alpine.data('gameUI', () => ({
        // Player state
        health: 100,
        maxHealth: 100,
        energy: 100,
        maxEnergy: 100,
        
        // Game state
        credits: 0,
        score: 0,
        combo: 0,
        comboTimer: 0,
        maxComboTimer: 3000,
        
        // Mission state
        activeMission: null,
        currentWave: 0,
        waveInProgress: false,
        enemiesDefeated: 0,
        totalEnemies: 0,
        
        // UI state
        charging: false,
        chargePercent: 0,
        comboAnimation: '',
        events: [],
        abilities: [],
        gameOver: false,
        victory: false,
        paused: false,
        soundEnabled: true,
        wavesCompleted: 0,
        totalKills: 0,
        maxCombo: 0,
        cheapestUpgrade: 8,
        upgradeCosts: {
            damage: 10,
            speed: 8,
            defense: 12,
            energy: 8
        },
        dashCooldown: 0,
        maxDashCooldown: 2000, // 2 seconds
        
        // Disaster state
        disasterWarning: false,
        activeDisaster: null,
        abilitiesDisabled: false,
        
        // Ability shop state
        abilityShopOpen: false,
        selectedSlot: null,
        availableAbilities: [],
        playerAbilities: [null, null, null, null],
        
        // Methods
        quickUpgrade(type) {
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { command: 'upgrade', upgradeType: type }
            }));
        },
        
        restartGame() {
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { command: 'restart' }
            }));
        },
        
        returnToMenu() {
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { command: 'menu' }
            }));
        },
        
        resumeGame() {
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { command: 'pause' }
            }));
        },
        
        toggleSound() {
            this.soundEnabled = !this.soundEnabled;
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { command: 'sound', value: this.soundEnabled }
            }));
        },
        
        quitToMenu() {
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { command: 'menu' }
            }));
        },
        
        selectSlot(index) {
            this.selectedSlot = index;
        },
        
        purchaseAbility(abilityId) {
            if (this.selectedSlot === null) return;
            
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { 
                    command: 'purchaseAbility',
                    abilityId: abilityId,
                    slot: this.selectedSlot
                }
            }));
        },
        
        closeAbilityShop() {
            this.abilityShopOpen = false;
            window.dispatchEvent(new CustomEvent('gameCommand', {
                detail: { command: 'closeAbilityShop' }
            }));
        },
        
        init() {
            // Listen for game state updates
            window.addEventListener('gameStateUpdate', (event) => {
                const state = event.detail;
                
                // Update player state
                if (state.player) {
                    this.health = state.player.health || 0;
                    this.maxHealth = state.player.maxHealth || 100;
                    this.energy = state.player.energy || 0;
                    this.maxEnergy = state.player.maxEnergy || 100;
                }
                
                // Update game state
                if (state.game) {
                    this.credits = state.game.credits || 0;
                    this.score = state.game.score || 0;
                    this.combo = state.game.combo || 0;
                    this.comboTimer = state.game.comboTimer || 0;
                    this.paused = state.game.paused || false;
                    this.gameOver = state.game.gameOver || false;
                }
                
                // Update mission state
                if (state.mission) {
                    this.currentWave = state.mission.currentWave || 0;
                    this.waveInProgress = state.mission.waveInProgress || false;
                    this.enemiesDefeated = state.mission.enemiesDefeated || 0;
                    this.totalEnemies = state.mission.totalEnemies || 0;
                }
                
                // Update upgrades
                if (state.upgrades) {
                    this.upgradeCosts = state.upgrades;
                    this.cheapestUpgrade = Math.min(...Object.values(state.upgrades));
                }
                
                // Update charging state
                if ('charging' in state) {
                    this.charging = state.charging;
                }
                if ('chargePercent' in state) {
                    this.chargePercent = state.chargePercent;
                }
                
                // Update dash cooldown
                if (state.player && 'dashCooldown' in state.player) {
                    this.dashCooldown = state.player.dashCooldown || 0;
                }
                
                // Update disaster state
                if ('disasterWarning' in state) {
                    this.disasterWarning = state.disasterWarning;
                }
                if ('activeDisaster' in state) {
                    this.activeDisaster = state.activeDisaster;
                }
                if ('abilitiesDisabled' in state) {
                    this.abilitiesDisabled = state.abilitiesDisabled;
                }
                
                // Update abilities from AbilityShopSystem
                if (state.abilities) {
                    this.abilities = state.abilities;
                }
            });
            
            // Listen for UI events
            window.addEventListener('uiEvent', (event) => {
                const { type, ...data } = event.detail;
                
                switch (type) {
                    case 'notification':
                        this.events.push(data);
                        setTimeout(() => {
                            const index = this.events.findIndex(e => e.id === data.id);
                            if (index !== -1) {
                                this.events.splice(index, 1);
                            }
                        }, 3000);
                        break;
                        
                    case 'missionUpdate':
                        this.activeMission = data.mission;
                        break;
                        
                    case 'gameOver':
                        this.gameOver = true;
                        this.victory = data.victory;
                        this.wavesCompleted = data.wavesCompleted || 0;
                        this.totalKills = data.totalKills || 0;
                        break;
                        
                    case 'abilityShopOpened':
                        this.abilityShopOpen = true;
                        this.availableAbilities = data.abilities || [];
                        this.playerAbilities = data.playerSlots || [null, null, null, null];
                        this.selectedSlot = null;
                        break;
                        
                    case 'abilityPurchased':
                        this.playerAbilities[data.slot] = data.ability;
                        break;
                }
            });
            
            // Listen for ability shop events
            window.addEventListener('abilityShopEvent', (event) => {
                const { type, ...data } = event.detail;
                
                switch (type) {
                    case 'open':
                        this.abilityShopOpen = true;
                        this.availableAbilities = data.abilities || [];
                        this.playerAbilities = data.playerSlots || [null, null, null, null];
                        this.selectedSlot = null;
                        break;
                        
                    case 'purchased':
                        this.playerAbilities[data.slot] = data.ability;
                        this.credits = data.credits;
                        break;
                        
                    case 'failed':
                        // Show error message
                        break;
                }
            });
        }
    }));
});

// Global game configuration
const GameConfig = {
    // World dimensions
    world: {
        width: 16000,
        height: 12000,
        centerX: 8000,
        centerY: 6000
    },
    
    // Physics simulation parameters
    physics: {
        gravity: 50.0,          // Gravitational constant
        spiralForce: 0.0003,    // Central spiral effect
        damping: 0.999,         // Velocity damping
        maxVelocity: 15,        // Speed limit
        gravitationFalloff: 1.8 // Gravity distance falloff
    },
    
    // Player initial stats
    player: {
        initialHealth: 100,
        initialEnergy: 100,
        baseSpeed: 0.8,
        baseDamage: 10,
        baseDefense: 10,
        chargeRate: 2.0,
        energyRegen: 2.0  // Increased from 0.5 to support ability usage
    },
    
    // Enemy faction definitions
    factions: {
        swarm: {
            color: 0xff69b4,     // Hot pink (matches texture)
            behavior: 'aggressive',
            speed: 8.0,          // Fast, weak units
            health: 10,
            damage: 10,
            size: 0.7,
            spawnCount: 15
        },
        sentinel: {
            color: 0x66ff66,
            behavior: 'defensive',
            speed: 5.0,      // Medium speed
            health: 100,     // High health
            damage: 12,      // Medium damage
            size: 1.2,
            spawnCount: 8
        },
        phantom: {
            color: 0x9966ff,
            behavior: 'stealth',
            speed: 9.0,      // High speed
            health: 50,      // Medium health
            damage: 20,      // High damage
            size: 0.9,
            spawnCount: 10
        },
        titan: {
            color: 0xff9966,
            behavior: 'boss',
            speed: 2.5,      // Low speed
            health: 500,     // Extremely high health
            damage: 30,      // High damage
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
    
    // Upgrade costs - very cheap for frequent upgrades
    upgrades: {
        damage: { base: 10, multiplier: 1.15 },    // Very cheap, slow scaling
        speed: { base: 8, multiplier: 1.12 },      // Cheapest base
        defense: { base: 12, multiplier: 1.18 },   // Slightly more expensive
        energy: { base: 8, multiplier: 1.12 }      // Same as speed
    },
    
    // Effects settings
    effects: {
        explosionParticles: 50,
        trailLength: 20,
        screenShakeIntensity: 10,
        glowIntensity: 1.5
    }
};

// Phaser 3 engine configuration
const phaserConfig = {
    type: Phaser.WEBGL,
    width: '100%',
    height: '100%',
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
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: '100%',
        height: '100%',
        parent: 'game-container'
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

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create Phaser game instance
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
    
    // Initialization complete
    console.log('Gravity Wars: Cosmic Arena initialized');
});

// Export configuration for use in other modules
window.GameConfig = GameConfig;