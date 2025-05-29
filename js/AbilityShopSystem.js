// AbilityShopSystem.js - Post-boss ability purchasing system
// Manages the ability shop that appears after defeating bosses

class AbilityShopSystem {
    constructor(scene, eventBus, gameState) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.shopOpen = false;
        this.selectedSlot = null;
        this.availableAbilities = [];
        this.playerAbilitySlots = [null, null, null, null]; // 4 slots for abilities
        
        // Define all possible abilities
        this.defineAbilities();
    }
    
    defineAbilities() {
        this.allAbilities = {
            // Offensive abilities
            rapidFire: {
                id: 'rapidFire',
                name: 'Rapid Fire',
                description: 'Triple your fire rate for 5 seconds',
                cost: 400,
                energyCost: 20,
                cooldown: 10000,
                duration: 5000,
                icon: 'fa-bolt',
                type: 'offensive',
                effect: 'fireRateMultiplier',
                value: 3
            },
            
            pierceShot: {
                id: 'pierceShot',
                name: 'Pierce Shot',
                description: 'Your shots penetrate through enemies for 8 seconds',
                cost: 600,
                energyCost: 30,
                cooldown: 15000,
                duration: 8000,
                icon: 'fa-crosshairs',
                type: 'offensive',
                effect: 'penetrating',
                value: true
            },
            
            spreadShot: {
                id: 'spreadShot',
                name: 'Spread Shot',
                description: 'Fire 5 projectiles in a spread pattern',
                cost: 500,
                energyCost: 25,
                cooldown: 8000,
                icon: 'fa-expand',
                type: 'offensive',
                effect: 'multiShot',
                value: 5
            },
            
            homingMissiles: {
                id: 'homingMissiles',
                name: 'Homing Missiles',
                description: 'Launch 3 homing missiles that track enemies',
                cost: 800,
                energyCost: 40,
                cooldown: 12000,
                icon: 'fa-rocket',
                type: 'offensive',
                effect: 'homingMissiles',
                value: 3
            },
            
            // Defensive abilities
            energyShield: {
                id: 'energyShield',
                name: 'Energy Shield',
                description: 'Create a shield that absorbs 200 damage',
                cost: 700,
                energyCost: 35,
                cooldown: 20000,
                icon: 'fa-shield-alt',
                type: 'defensive',
                effect: 'shield',
                value: 200
            },
            
            timeWarp: {
                id: 'timeWarp',
                name: 'Time Warp',
                description: 'Slow down time for everything except you',
                cost: 1000,
                energyCost: 50,
                cooldown: 25000,
                duration: 3000,
                icon: 'fa-clock',
                type: 'defensive',
                effect: 'timeWarp',
                value: 0.3
            },
            
            invisibility: {
                id: 'invisibility',
                name: 'Invisibility',
                description: 'Become invisible to enemies for 4 seconds',
                cost: 600,
                energyCost: 30,
                cooldown: 18000,
                duration: 4000,
                icon: 'fa-eye-slash',
                type: 'defensive',
                effect: 'invisible',
                value: true
            },
            
            heal: {
                id: 'heal',
                name: 'Emergency Repair',
                description: 'Instantly restore 50% of your max health',
                cost: 400,
                energyCost: 20,
                cooldown: 30000,
                icon: 'fa-heart',
                type: 'defensive',
                effect: 'heal',
                value: 0.5
            },
            
            // Utility abilities
            teleport: {
                id: 'teleport',
                name: 'Teleport',
                description: 'Instantly teleport to your cursor position',
                cost: 500,
                energyCost: 25,
                cooldown: 10000,
                icon: 'fa-portal-enter',
                type: 'utility',
                effect: 'teleport',
                value: true
            },
            
            magnetField: {
                id: 'magnetField',
                name: 'Magnet Field',
                description: 'Pull all nearby pickups towards you',
                cost: 300,
                energyCost: 15,
                cooldown: 15000,
                duration: 5000,
                icon: 'fa-magnet',
                type: 'utility',
                effect: 'magnetField',
                value: 300
            },
            
            overcharge: {
                id: 'overcharge',
                name: 'Overcharge',
                description: 'Double damage and speed for 6 seconds',
                cost: 900,
                energyCost: 45,
                cooldown: 30000,
                duration: 6000,
                icon: 'fa-fire',
                type: 'utility',
                effect: 'overcharge',
                value: 2
            },
            
            blackHole: {
                id: 'blackHole',
                name: 'Black Hole',
                description: 'Create a black hole that pulls enemies',
                cost: 1200,
                energyCost: 60,
                cooldown: 35000,
                duration: 5000,
                icon: 'fa-circle',
                type: 'utility',
                effect: 'blackHole',
                value: 800
            },
            
            // Ultimate abilities
            orbitalStrike: {
                id: 'orbitalStrike',
                name: 'Orbital Strike',
                description: 'Call down a devastating orbital bombardment',
                cost: 1600,
                energyCost: 80,
                cooldown: 60000,
                icon: 'fa-satellite',
                type: 'ultimate',
                effect: 'orbitalStrike',
                value: 500
            },
            
            timeFracture: {
                id: 'timeFracture',
                name: 'Time Fracture',
                description: 'Rewind time by 5 seconds, restoring health and position',
                cost: 1400,
                energyCost: 70,
                cooldown: 90000,
                icon: 'fa-history',
                type: 'ultimate',
                effect: 'timeFracture',
                value: 5000
            },
            
            nova: {
                id: 'nova',
                name: 'Nova Blast',
                description: 'Unleash a massive explosion around you',
                cost: 1200,
                energyCost: 60,
                cooldown: 45000,
                icon: 'fa-burst',
                type: 'ultimate',
                effect: 'nova',
                value: 1000
            },
            
            droneSwarm: {
                id: 'droneSwarm',
                name: 'Drone Swarm',
                description: 'Deploy 6 combat drones that fight alongside you',
                cost: 1500,
                energyCost: 75,
                cooldown: 60000,
                duration: 30000,
                icon: 'fa-helicopter',
                type: 'ultimate',
                effect: 'droneSwarm',
                value: 6
            }
        };
    }
    
    init() {
        // Listen for boss defeat to show shop
        this.eventBus.on('BOSS_DEFEATED', () => {
            this.scene.time.delayedCall(2000, () => {
                this.openShop();
            });
        });
        
        // Listen for ability purchase
        this.eventBus.on('PURCHASE_ABILITY', (data) => {
            this.purchaseAbility(data.abilityId, data.slot);
        });
        
        // Listen for shop close
        this.eventBus.on('CLOSE_ABILITY_SHOP', () => {
            this.closeShop();
        });
        
        // Listen for ability use
        this.eventBus.on('USE_ABILITY', (data) => {
            this.useAbility(data.slot);
        });
    }
    
    openShop() {
        this.shopOpen = true;
        this.gameState.update('game.paused', true);
        
        // Generate 4 random abilities
        this.availableAbilities = this.generateRandomAbilities(4);
        
        // Send shop data to UI
        window.dispatchEvent(new CustomEvent('uiEvent', {
            detail: {
                type: 'abilityShopOpened',
                abilities: this.availableAbilities,
                playerSlots: this.playerAbilitySlots,
                credits: this.gameState.get('game.credits')
            }
        }));
    }
    
    generateRandomAbilities(count) {
        const allAbilityKeys = Object.keys(this.allAbilities);
        const selected = [];
        const used = new Set();
        
        // Don't offer abilities the player already has
        this.playerAbilitySlots.forEach(slot => {
            if (slot) used.add(slot.id);
        });
        
        while (selected.length < count && selected.length < allAbilityKeys.length - used.size) {
            const randomKey = allAbilityKeys[Math.floor(Math.random() * allAbilityKeys.length)];
            if (!used.has(randomKey)) {
                used.add(randomKey);
                selected.push(this.allAbilities[randomKey]);
            }
        }
        
        return selected;
    }
    
    purchaseAbility(abilityId, slot) {
        const ability = this.allAbilities[abilityId];
        const credits = this.gameState.get('game.credits');
        
        if (!ability || credits < ability.cost) {
            this.eventBus.emit('ABILITY_PURCHASE_FAILED', {
                reason: credits < ability.cost ? 'insufficient_credits' : 'invalid_ability'
            });
            return;
        }
        
        // Deduct cost
        this.gameState.addCredits(-ability.cost);
        
        // Assign to slot
        this.playerAbilitySlots[slot] = {
            ...ability,
            currentCooldown: 0,
            energyCost: ability.energyCost || 20
        };
        
        // Update UI
        this.updateAbilityUI();
        
        // Emit success
        this.eventBus.emit('ABILITY_PURCHASED', {
            ability: ability,
            slot: slot
        });
    }
    
    closeShop() {
        this.shopOpen = false;
        this.gameState.update('game.paused', false);
        
        // Continue to next wave
        this.eventBus.emit('CONTINUE_TO_NEXT_WAVE');
    }
    
    useAbility(slot) {
        const ability = this.playerAbilitySlots[slot];
        if (!ability || ability.currentCooldown > 0) return;
        
        const energy = this.gameState.get('player.energy');
        const energyCost = ability.energyCost || 20; // Use defined energy cost
        
        if (energy < energyCost) {
            this.eventBus.emit('ABILITY_USE_FAILED', {
                reason: 'insufficient_energy'
            });
            return;
        }
        
        // Deduct energy
        this.gameState.update('player.energy', energy - energyCost);
        
        // Start cooldown
        ability.currentCooldown = ability.cooldown;
        
        // Apply ability effect
        this.applyAbilityEffect(ability);
        
        // Update UI
        this.updateAbilityUI();
    }
    
    applyAbilityEffect(ability) {
        const playerId = this.gameState.getPlayerId();
        
        switch (ability.effect) {
            case 'fireRateMultiplier':
                this.eventBus.emit('APPLY_FIRE_RATE_BONUS', {
                    multiplier: ability.value,
                    duration: ability.duration
                });
                break;
                
            case 'penetrating':
                this.eventBus.emit('ENABLE_PENETRATING_SHOTS', {
                    duration: ability.duration
                });
                break;
                
            case 'multiShot':
                this.eventBus.emit('FIRE_SPREAD_SHOT', {
                    count: ability.value
                });
                break;
                
            case 'homingMissiles':
                this.eventBus.emit('LAUNCH_HOMING_MISSILES', {
                    count: ability.value
                });
                break;
                
            case 'shield':
                this.eventBus.emit('ACTIVATE_SHIELD', {
                    strength: ability.value
                });
                break;
                
            case 'timeWarp':
                this.eventBus.emit('ACTIVATE_TIME_WARP', {
                    slowFactor: ability.value,
                    duration: ability.duration
                });
                break;
                
            case 'invisible':
                this.eventBus.emit('ACTIVATE_INVISIBILITY', {
                    duration: ability.duration
                });
                break;
                
            case 'heal':
                const maxHealth = this.gameState.get('player.maxHealth');
                this.gameState.healPlayer(maxHealth * ability.value);
                break;
                
            case 'teleport':
                this.eventBus.emit('TELEPORT_TO_CURSOR');
                break;
                
            case 'magnetField':
                this.eventBus.emit('ACTIVATE_MAGNET_FIELD', {
                    radius: ability.value,
                    duration: ability.duration
                });
                break;
                
            case 'overcharge':
                this.eventBus.emit('ACTIVATE_OVERCHARGE', {
                    multiplier: ability.value,
                    duration: ability.duration
                });
                break;
                
            case 'blackHole':
                this.eventBus.emit('CREATE_BLACK_HOLE_ABILITY', {
                    force: ability.value,
                    duration: ability.duration
                });
                break;
                
            case 'orbitalStrike':
                this.eventBus.emit('CALL_ORBITAL_STRIKE', {
                    damage: ability.value
                });
                break;
                
            case 'timeFracture':
                this.eventBus.emit('ACTIVATE_TIME_FRACTURE', {
                    rewindTime: ability.value
                });
                break;
                
            case 'nova':
                this.eventBus.emit('ACTIVATE_NOVA_BLAST', {
                    damage: ability.value
                });
                break;
                
            case 'droneSwarm':
                this.eventBus.emit('DEPLOY_DRONE_SWARM', {
                    count: ability.value,
                    duration: ability.duration
                });
                break;
        }
        
        // Play ability sound
        this.eventBus.emit('AUDIO_PLAY', { sound: 'powerup' });
    }
    
    update(deltaTime) {
        // Update cooldowns
        this.playerAbilitySlots.forEach((ability, index) => {
            if (ability && ability.currentCooldown > 0) {
                ability.currentCooldown -= deltaTime * 1000;
                if (ability.currentCooldown <= 0) {
                    ability.currentCooldown = 0;
                }
            }
        });
        
        // Update UI periodically
        if (this.scene.time.now % 100 < 20) {
            this.updateAbilityUI();
        }
    }
    
    updateAbilityUI() {
        const abilities = this.playerAbilitySlots.map((ability, index) => {
            if (!ability) return null;
            
            return {
                id: ability.id,
                name: ability.name,
                icon: ability.icon,
                cost: ability.energyCost || 20,
                cooldown: ability.cooldown,
                cooldownRemaining: ability.currentCooldown,
                slot: index
            };
        }).filter(a => a !== null);
        
        // Send to UI
        window.dispatchEvent(new CustomEvent('gameStateUpdate', {
            detail: {
                abilities: abilities
            }
        }));
    }
    
    getPlayerAbilities() {
        return this.playerAbilitySlots;
    }
}

// Export for use in GameInitializer
window.AbilityShopSystem = AbilityShopSystem;