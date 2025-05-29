// BossSystem.js - Dynamic boss generation with trait-based abilities
// Creates unique boss encounters using randomized trait combinations

class BossSystem {
    constructor(scene, eventBus, entityManager, entityFactory) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.entityFactory = entityFactory;
        this.currentBoss = null;
        this.bossAbilityTimer = 0;
        this.bossHealthBar = null;
        this.bossPhase = false;
        this.bossNumber = 0;
        
        // Initialize boss trait definitions
        this.defineBossTraits();
    }
    
    defineBossTraits() {
        // Define 10 unique boss traits for dynamic combinations
        this.bossTraits = {
            // GIANT - Massive size with area attacks
            giant: {
                name: 'Giant',
                statModifiers: {
                    healthMultiplier: 3.0,
                    damageMultiplier: 2.0,
                    speedMultiplier: 0.4,
                    sizeMultiplier: 2.5
                },
                abilities: ['smash', 'earthquake', 'gravityPull'],
                behaviors: ['aggressive'],
                color: 0x8B4513 // Brown
            },
            
            // NECROMANCER - Summons minions, health drain mechanic
            necromancer: {
                name: 'Necromancer',
                statModifiers: {
                    healthMultiplier: 1.5,
                    damageMultiplier: 0.8,
                    speedMultiplier: 0.8,
                    sizeMultiplier: 1.0
                },
                abilities: ['summonUndead', 'deathAura', 'soulDrain'],
                behaviors: ['tactical'],
                color: 0x4B0082, // Indigo
                special: {
                    healthDrainPerSecond: 5, // Loses 5 HP per second
                    minionSpawnRate: 3000 // Spawns minion every 3 seconds
                }
            },
            
            // BERSERKER - Rage scaling with damage taken
            berserker: {
                name: 'Berserker',
                statModifiers: {
                    healthMultiplier: 2.0,
                    damageMultiplier: 1.5,
                    speedMultiplier: 1.2,
                    sizeMultiplier: 1.3
                },
                abilities: ['rage', 'whirlwind', 'bloodlust'],
                behaviors: ['berserker'],
                color: 0xFF0000, // Red
                special: {
                    damageScaling: 2.0 // Damage doubles at low health
                }
            },
            
            // PHANTOM - Evasive with teleportation abilities
            phantom: {
                name: 'Phantom',
                statModifiers: {
                    healthMultiplier: 0.8,
                    damageMultiplier: 1.3,
                    speedMultiplier: 1.8,
                    sizeMultiplier: 0.8
                },
                abilities: ['phaseShift', 'teleport', 'shadowStrike'],
                behaviors: ['tactical'],
                color: 0x9932CC, // Purple
                special: {
                    dodgeChance: 0.3 // 30% chance to dodge attacks
                }
            },
            
            // TANK - Maximum defense and durability
            tank: {
                name: 'Tank',
                statModifiers: {
                    healthMultiplier: 4.0,
                    damageMultiplier: 1.0,
                    speedMultiplier: 0.5,
                    sizeMultiplier: 1.8
                },
                abilities: ['fortify', 'ramCharge', 'armorPlating'],
                behaviors: ['defensive'],
                color: 0x708090, // Slate Gray
                special: {
                    damageReduction: 0.5 // Takes 50% less damage
                }
            },
            
            // ASSASSIN - Fast, high damage, low health
            assassin: {
                name: 'Assassin',
                statModifiers: {
                    healthMultiplier: 0.6,
                    damageMultiplier: 2.5,
                    speedMultiplier: 2.0,
                    sizeMultiplier: 0.7
                },
                abilities: ['shadowDash', 'criticalStrike', 'smokeBomb'],
                behaviors: ['aggressive'],
                color: 0x2F4F4F, // Dark Slate Gray
                special: {
                    critChance: 0.4, // 40% chance for double damage
                    firstStrikeBonus: 3.0 // First hit does 3x damage
                }
            },
            
            // ELEMENTALIST - Uses elemental attacks
            elementalist: {
                name: 'Elementalist',
                statModifiers: {
                    healthMultiplier: 1.2,
                    damageMultiplier: 1.8,
                    speedMultiplier: 1.0,
                    sizeMultiplier: 1.0
                },
                abilities: ['fireStorm', 'iceBarrage', 'lightningBolt'],
                behaviors: ['sniper'],
                color: 0xFF69B4, // Hot Pink
                special: {
                    elementalRotation: true // Cycles through elements
                }
            },
            
            // JUGGERNAUT - Unstoppable force, charges constantly
            juggernaut: {
                name: 'Juggernaut',
                statModifiers: {
                    healthMultiplier: 2.5,
                    damageMultiplier: 1.8,
                    speedMultiplier: 1.5,
                    sizeMultiplier: 1.6
                },
                abilities: ['unstoppableCharge', 'momentum', 'bulldoze'],
                behaviors: ['aggressive'],
                color: 0xFF8C00, // Dark Orange
                special: {
                    chargeBuildup: true, // Gets faster over time
                    knockbackImmune: true
                }
            },
            
            // ARCHITECT - Creates barriers and turrets
            architect: {
                name: 'Architect',
                statModifiers: {
                    healthMultiplier: 1.5,
                    damageMultiplier: 1.0,
                    speedMultiplier: 0.7,
                    sizeMultiplier: 1.2
                },
                abilities: ['buildTurret', 'constructBarrier', 'repairDrones'],
                behaviors: ['defensive'],
                color: 0x4682B4, // Steel Blue
                special: {
                    maxConstructs: 5,
                    constructHealth: 200
                }
            },
            
            // VOIDWALKER - Manipulates space, creates black holes
            voidwalker: {
                name: 'Voidwalker',
                statModifiers: {
                    healthMultiplier: 1.8,
                    damageMultiplier: 1.5,
                    speedMultiplier: 0.9,
                    sizeMultiplier: 1.4
                },
                abilities: ['voidRift', 'spatialDistortion', 'blackHole'],
                behaviors: ['tactical'],
                color: 0x191970, // Midnight Blue
                special: {
                    gravityAura: true, // Pulls entities toward it
                    voidDamage: true // Damage ignores shields
                }
            }
        };
    }
    
    init() {
        // Listen for boss phase events
        this.eventBus.on('START_BOSS_PHASE', (data) => {
            this.startBossPhase(data.waveNumber);
        });
        
        this.eventBus.on('BOSS_DEFEATED', () => {
            this.endBossPhase();
        });
        
        // Listen for entity destruction
        this.eventBus.on('ENTITY_DESTROYED', (data) => {
            if (this.currentBoss && data.id === this.currentBoss.id) {
                this.eventBus.emit('BOSS_DEFEATED');
            }
        });
        
        // Listen for boss data requests from other systems
        this.eventBus.on('REQUEST_BOSS_DATA', (data) => {
            if (this.currentBoss && data.bossId === this.currentBoss.id && data.callback) {
                data.callback(this.currentBoss.stats);
            }
        });
    }
    
    generateTraitBasedBoss(waveNumber) {
        // Select 5 random traits
        const allTraitKeys = Object.keys(this.bossTraits);
        const selectedTraitKeys = [];
        
        // Shuffle and pick 5 traits
        const shuffled = [...allTraitKeys].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 5 && i < shuffled.length; i++) {
            selectedTraitKeys.push(shuffled[i]);
        }
        
        // Initialize base stats
        const baseHealth = 800 + (waveNumber * 200);
        const baseDamage = 30 + (waveNumber * 10);
        const baseSpeed = 100;
        const baseSize = 1.5;
        
        // Aggregate stats from traits
        let totalHealthMultiplier = 0;
        let totalDamageMultiplier = 0;
        let totalSpeedMultiplier = 0;
        let totalSizeMultiplier = 0;
        let allAbilities = [];
        let behaviors = [];
        let colors = [];
        let specialProperties = {};
        let traitNames = [];
        
        // Collect modifiers from each trait
        selectedTraitKeys.forEach(traitKey => {
            const trait = this.bossTraits[traitKey];
            totalHealthMultiplier += trait.statModifiers.healthMultiplier;
            totalDamageMultiplier += trait.statModifiers.damageMultiplier;
            totalSpeedMultiplier += trait.statModifiers.speedMultiplier;
            totalSizeMultiplier += trait.statModifiers.sizeMultiplier;
            
            allAbilities.push(...trait.abilities);
            behaviors.push(...trait.behaviors);
            colors.push(trait.color);
            traitNames.push(trait.name);
            
            if (trait.special) {
                Object.assign(specialProperties, trait.special);
            }
        });
        
        // Average the multipliers
        const numTraits = selectedTraitKeys.length;
        const avgHealthMultiplier = totalHealthMultiplier / numTraits;
        const avgDamageMultiplier = totalDamageMultiplier / numTraits;
        const avgSpeedMultiplier = totalSpeedMultiplier / numTraits;
        const avgSizeMultiplier = totalSizeMultiplier / numTraits;
        
        // Calculate final stats with difficulty scaling
        const difficultyMultiplier = 1 + (waveNumber * 0.15);
        
        const finalStats = {
            health: Math.floor(baseHealth * avgHealthMultiplier * difficultyMultiplier),
            maxHealth: Math.floor(baseHealth * avgHealthMultiplier * difficultyMultiplier),
            damage: Math.floor(baseDamage * avgDamageMultiplier * difficultyMultiplier),
            speed: Math.floor(baseSpeed * avgSpeedMultiplier),
            scale: baseSize * avgSizeMultiplier,
            mass: 50 * avgSizeMultiplier * avgSizeMultiplier, // Mass scales with size squared
            abilities: this.selectBestAbilities(allAbilities, 6), // Pick up to 6 abilities
            behavior: this.selectDominantBehavior(behaviors),
            color: this.blendColors(colors),
            name: this.generateBossNameFromTraits(traitNames),
            traits: selectedTraitKeys,
            specialProperties: specialProperties
        };
        
        return finalStats;
    }
    
    selectBestAbilities(allAbilities, maxCount) {
        // Remove duplicates and select up to maxCount abilities
        const uniqueAbilities = [...new Set(allAbilities)];
        
        // Prioritize certain ability combinations
        const priorityGroups = {
            offensive: ['rage', 'bloodlust', 'criticalStrike', 'fireStorm', 'lightningBolt'],
            defensive: ['fortify', 'armorPlating', 'phaseShift', 'constructBarrier'],
            utility: ['teleport', 'shadowDash', 'smokeBomb', 'repairDrones'],
            aoe: ['smash', 'earthquake', 'whirlwind', 'deathAura', 'voidRift']
        };
        
        const selected = [];
        
        // Try to get at least one from each category if available
        Object.values(priorityGroups).forEach(group => {
            const available = uniqueAbilities.filter(ability => group.includes(ability));
            if (available.length > 0 && selected.length < maxCount) {
                selected.push(available[0]);
            }
        });
        
        // Fill remaining slots with other abilities
        uniqueAbilities.forEach(ability => {
            if (!selected.includes(ability) && selected.length < maxCount) {
                selected.push(ability);
            }
        });
        
        return selected.map(abilityType => ({
            type: abilityType,
            cooldown: this.getAbilityCooldown(abilityType),
            currentCooldown: 0
        }));
    }
    
    selectDominantBehavior(behaviors) {
        // Count occurrences
        const behaviorCounts = {};
        behaviors.forEach(behavior => {
            behaviorCounts[behavior] = (behaviorCounts[behavior] || 0) + 1;
        });
        
        // Return most common behavior
        let dominantBehavior = 'tactical'; // default
        let maxCount = 0;
        
        Object.entries(behaviorCounts).forEach(([behavior, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantBehavior = behavior;
            }
        });
        
        return dominantBehavior;
    }
    
    blendColors(colors) {
        if (colors.length === 0) return 0xFFFFFF;
        if (colors.length === 1) return colors[0];
        
        // Average the RGB components
        let totalR = 0, totalG = 0, totalB = 0;
        
        colors.forEach(color => {
            totalR += (color >> 16) & 0xFF;
            totalG += (color >> 8) & 0xFF;
            totalB += color & 0xFF;
        });
        
        const avgR = Math.floor(totalR / colors.length);
        const avgG = Math.floor(totalG / colors.length);
        const avgB = Math.floor(totalB / colors.length);
        
        return (avgR << 16) | (avgG << 8) | avgB;
    }
    
    generateBossNameFromTraits(traitNames) {
        // Create epic names by combining traits
        const prefixes = {
            'Giant': 'Colossal',
            'Necromancer': 'Undying',
            'Berserker': 'Bloodthirsty',
            'Phantom': 'Ethereal',
            'Tank': 'Ironclad',
            'Assassin': 'Shadow',
            'Elementalist': 'Prismatic',
            'Juggernaut': 'Unstoppable',
            'Architect': 'Master',
            'Voidwalker': 'Abyssal'
        };
        
        const suffixes = {
            'Giant': 'Titan',
            'Necromancer': 'Lich',
            'Berserker': 'Ravager',
            'Phantom': 'Specter',
            'Tank': 'Fortress',
            'Assassin': 'Reaper',
            'Elementalist': 'Archon',
            'Juggernaut': 'Destroyer',
            'Architect': 'Constructor',
            'Voidwalker': 'Devourer'
        };
        
        // Pick the two most interesting traits for the name
        const selectedTraits = traitNames.slice(0, 2);
        const prefix = prefixes[selectedTraits[0]] || 'Omega';
        const suffix = suffixes[selectedTraits[1] || selectedTraits[0]] || 'Overlord';
        
        return `${prefix} ${suffix}`;
    }
    
    getAbilityCooldown(abilityType) {
        const cooldowns = {
            // Giant abilities
            smash: 3000,
            earthquake: 5000,
            gravityPull: 4000,
            
            // Necromancer abilities
            summonUndead: 2000,
            deathAura: 6000,
            soulDrain: 4000,
            
            // Berserker abilities
            rage: 8000,
            whirlwind: 3000,
            bloodlust: 10000,
            
            // Phantom abilities
            phaseShift: 3000,
            teleport: 2500,
            shadowStrike: 3500,
            
            // Tank abilities
            fortify: 8000,
            ramCharge: 4000,
            armorPlating: 10000,
            
            // Assassin abilities
            shadowDash: 2000,
            criticalStrike: 3000,
            smokeBomb: 5000,
            
            // Elementalist abilities
            fireStorm: 4000,
            iceBarrage: 3500,
            lightningBolt: 3000,
            
            // Juggernaut abilities
            unstoppableCharge: 5000,
            momentum: 6000,
            bulldoze: 4000,
            
            // Architect abilities
            buildTurret: 5000,
            constructBarrier: 4000,
            repairDrones: 8000,
            
            // Voidwalker abilities
            voidRift: 5000,
            spatialDistortion: 4000,
            blackHole: 10000
        };
        return cooldowns[abilityType] || 3000;
    }
    
    startBossPhase(waveNumber) {
        // Boss phase initialization
        this.bossPhase = true;
        this.bossNumber = waveNumber;
        
        // Generate trait-based boss
        const bossStats = this.generateTraitBasedBoss(waveNumber);
        const spawnPosition = this.getRandomSpawnPosition();
        
        // Generate boss at calculated position
        
        // Create boss entity
        const bossEntity = this.entityFactory.createBoss(
            spawnPosition.x,
            spawnPosition.y,
            bossStats
        );
        
        if (!bossEntity) {
            console.error('[BossSystem] Failed to create boss entity!');
            return;
        }
        
        this.currentBoss = {
            id: bossEntity,
            stats: bossStats,
            entity: this.entityManager.getEntity(bossEntity),
            firstStrike: true // For assassin trait
        };
        
        // Boss entity created successfully
        
        // Create boss health bar UI
        this.createBossHealthBar(bossStats.name);
        
        // Announce boss arrival with traits
        const traitString = bossStats.traits.map(t => this.bossTraits[t].name).join(', ');
        this.eventBus.emit('BOSS_SPAWNED', {
            name: bossStats.name,
            waveNumber: waveNumber,
            traits: traitString
        });
        
        // Epic boss music
        this.eventBus.emit('PLAY_BOSS_MUSIC');
        
        // Start special trait effects
        this.initializeTraitEffects(bossStats);
    }
    
    initializeTraitEffects(bossStats) {
        // Necromancer health drain
        if (bossStats.specialProperties.healthDrainPerSecond) {
            this.necromancerDrainInterval = setInterval(() => {
                if (this.currentBoss && this.currentBoss.entity) {
                    const healthComp = this.currentBoss.entity.components.health;
                    if (healthComp && healthComp.current > 1) {
                        healthComp.current -= bossStats.specialProperties.healthDrainPerSecond;
                        
                        // But also spawn a minion
                        if (Math.random() < 0.3) { // 30% chance per second
                            this.spawnNecromancerMinion();
                        }
                    }
                }
            }, 1000);
        }
        
        // Necromancer auto-spawn minions
        if (bossStats.specialProperties.minionSpawnRate) {
            this.necromancerSpawnInterval = setInterval(() => {
                if (this.currentBoss) {
                    this.spawnNecromancerMinion();
                }
            }, bossStats.specialProperties.minionSpawnRate);
        }
    }
    
    spawnNecromancerMinion() {
        if (!this.currentBoss || !this.currentBoss.entity) return;
        
        const boss = this.currentBoss.entity;
        if (!boss.components || !boss.components.transform) return;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 150;
        const spawnX = boss.components.transform.x + Math.cos(angle) * distance;
        const spawnY = boss.components.transform.y + Math.sin(angle) * distance;
        
        this.eventBus.emit('ENEMY_SHOOT_REQUEST', {
            enemyId: this.currentBoss.id,
            spawnInfo: {
                faction: 'swarm',
                position: { x: spawnX, y: spawnY },
                isBossMinion: true,
                isNecromancerMinion: true
            }
        });
    }
    
    endBossPhase() {
        this.bossPhase = false;
        
        // Clear any trait-specific intervals
        if (this.necromancerDrainInterval) {
            clearInterval(this.necromancerDrainInterval);
            this.necromancerDrainInterval = null;
        }
        if (this.necromancerSpawnInterval) {
            clearInterval(this.necromancerSpawnInterval);
            this.necromancerSpawnInterval = null;
        }
        
        this.currentBoss = null;
        
        // Remove boss health bar through UI manager
        this.eventBus.emit('REMOVE_BOSS_HEALTH_BAR');
        
        // Boss defeated rewards - significantly reduced
        this.eventBus.emit('BOSS_REWARD', {
            credits: 100 + (this.bossNumber * 50), // Was 1000 * bossNumber
            upgrades: Math.floor(this.bossNumber / 2) + 1
        });
        
        // Return to normal music
        this.eventBus.emit('PLAY_NORMAL_MUSIC');
        
        // Don't continue to next wave immediately - wait for ability shop to close
        // The AbilityShopSystem will emit CONTINUE_TO_NEXT_WAVE when shop closes
    }
    
    update(deltaTime) {
        if (!this.bossPhase || !this.currentBoss) return;
        
        const bossEntity = this.entityManager.getEntity(this.currentBoss.id);
        if (!bossEntity) return;
        
        // Update boss health bar
        if (this.bossHealthBar && bossEntity.components.health) {
            const healthPercent = bossEntity.components.health.current / bossEntity.components.health.max;
            this.updateBossHealthBar(healthPercent);
            
            // Berserker damage scaling
            if (this.currentBoss.stats.specialProperties.damageScaling) {
                const missingHealthPercent = 1 - healthPercent;
                const damageBonus = 1 + (missingHealthPercent * (this.currentBoss.stats.specialProperties.damageScaling - 1));
                bossEntity.components.weapon.damage = this.currentBoss.stats.damage * damageBonus;
            }
        }
        
        // Update ability cooldowns
        this.currentBoss.stats.abilities.forEach(ability => {
            if (ability.currentCooldown > 0) {
                ability.currentCooldown -= deltaTime;
            }
        });
        
        // Execute boss behavior
        this.executeBossBehavior(bossEntity, deltaTime);
        
        // Juggernaut charge buildup
        if (this.currentBoss.stats.specialProperties.chargeBuildup && bossEntity.components.physics) {
            const speedIncrease = deltaTime * 0.01; // 1% per second
            bossEntity.components.physics.maxSpeed *= (1 + speedIncrease);
        }
    }
    
    executeBossBehavior(bossEntity, deltaTime) {
        const behavior = this.currentBoss.stats.behavior;
        const playerEntity = this.entityManager.query('player')[0];
        
        if (!playerEntity) return;
        
        // Check and use available abilities
        this.currentBoss.stats.abilities.forEach(ability => {
            if (ability.currentCooldown <= 0) {
                if (this.shouldUseAbility(ability.type, bossEntity, playerEntity)) {
                    this.useAbility(ability.type, bossEntity, playerEntity);
                    ability.currentCooldown = ability.cooldown;
                }
            }
        });
        
        // Basic movement AI based on behavior pattern
        this.updateBossMovement(bossEntity, playerEntity, behavior);
    }
    
    shouldUseAbility(abilityType, bossEntity, playerEntity) {
        const distance = this.getDistance(bossEntity, playerEntity);
        const healthPercent = bossEntity.components.health.current / bossEntity.components.health.max;
        
        // Ability usage logic based on context
        switch (abilityType) {
            // Melee abilities
            case 'smash':
            case 'shadowStrike':
            case 'criticalStrike':
                return distance < 200 && Math.random() < 0.4;
                
            // Charge abilities
            case 'ramCharge':
            case 'unstoppableCharge':
            case 'bulldoze':
            case 'shadowDash':
                return distance < 400 && distance > 150 && Math.random() < 0.3;
                
            // Defensive abilities
            case 'fortify':
            case 'armorPlating':
            case 'phaseShift':
                return healthPercent < 0.5 && Math.random() < 0.4;
                
            // Rage abilities
            case 'rage':
            case 'bloodlust':
                return healthPercent < 0.3 && Math.random() < 0.6;
                
            // AOE abilities
            case 'earthquake':
            case 'whirlwind':
            case 'deathAura':
            case 'fireStorm':
                return distance < 300 && Math.random() < 0.35;
                
            // Ranged abilities
            case 'lightningBolt':
            case 'iceBarrage':
            case 'soulDrain':
                return distance < 600 && Math.random() < 0.4;
                
            // Utility abilities
            case 'teleport':
            case 'smokeBomb':
                return (distance > 500 || healthPercent < 0.3) && Math.random() < 0.3;
                
            // Construction abilities
            case 'buildTurret':
            case 'constructBarrier':
                return Math.random() < 0.2;
                
            // Special abilities
            case 'summonUndead':
                return Math.random() < 0.3;
            case 'voidRift':
            case 'spatialDistortion':
            case 'blackHole':
                return Math.random() < 0.25;
                
            default:
                return Math.random() < 0.3;
        }
    }
    
    useAbility(abilityType, bossEntity, playerEntity) {
        // Check for special properties
        const props = this.currentBoss.stats.specialProperties;
        
        // Assassin first strike bonus
        if (props.firstStrikeBonus && this.currentBoss.firstStrike) {
            this.currentBoss.firstStrike = false;
            // Triple damage for this ability
        }
        
        switch (abilityType) {
            // Giant abilities
            case 'smash':
                this.executeSmash(bossEntity);
                break;
            case 'earthquake':
                this.executeEarthquake(bossEntity);
                break;
            case 'gravityPull':
                this.executeGravityPull(bossEntity);
                break;
                
            // Necromancer abilities
            case 'summonUndead':
                this.executeSummonUndead(bossEntity);
                break;
            case 'deathAura':
                this.executeDeathAura(bossEntity);
                break;
            case 'soulDrain':
                this.executeSoulDrain(bossEntity, playerEntity);
                break;
                
            // Berserker abilities
            case 'rage':
                this.executeRage(bossEntity);
                break;
            case 'whirlwind':
                this.executeWhirlwind(bossEntity);
                break;
            case 'bloodlust':
                this.executeBloodlust(bossEntity);
                break;
                
            // Phantom abilities
            case 'phaseShift':
                this.executePhaseShift(bossEntity);
                break;
            case 'teleport':
                this.executeTeleport(bossEntity);
                break;
            case 'shadowStrike':
                this.executeShadowStrike(bossEntity, playerEntity);
                break;
                
            // Tank abilities
            case 'fortify':
                this.executeFortify(bossEntity);
                break;
            case 'ramCharge':
                this.executeRamCharge(bossEntity, playerEntity);
                break;
            case 'armorPlating':
                this.executeArmorPlating(bossEntity);
                break;
                
            // Assassin abilities
            case 'shadowDash':
                this.executeShadowDash(bossEntity, playerEntity);
                break;
            case 'criticalStrike':
                this.executeCriticalStrike(bossEntity, playerEntity);
                break;
            case 'smokeBomb':
                this.executeSmokeBomb(bossEntity);
                break;
                
            // Elementalist abilities
            case 'fireStorm':
                this.executeFireStorm(bossEntity);
                break;
            case 'iceBarrage':
                this.executeIceBarrage(bossEntity, playerEntity);
                break;
            case 'lightningBolt':
                this.executeLightningBolt(bossEntity, playerEntity);
                break;
                
            // Juggernaut abilities
            case 'unstoppableCharge':
                this.executeUnstoppableCharge(bossEntity, playerEntity);
                break;
            case 'momentum':
                this.executeMomentum(bossEntity);
                break;
            case 'bulldoze':
                this.executeBulldoze(bossEntity, playerEntity);
                break;
                
            // Architect abilities
            case 'buildTurret':
                this.executeBuildTurret(bossEntity);
                break;
            case 'constructBarrier':
                this.executeConstructBarrier(bossEntity);
                break;
            case 'repairDrones':
                this.executeRepairDrones(bossEntity);
                break;
                
            // Voidwalker abilities
            case 'voidRift':
                this.executeVoidRift(bossEntity);
                break;
            case 'spatialDistortion':
                this.executeSpatialDistortion(bossEntity);
                break;
            case 'blackHole':
                this.executeBlackHole(bossEntity);
                break;
        }
        
        // Emit ability use event for effects
        this.eventBus.emit('BOSS_ABILITY_USED', {
            bossId: bossEntity.id,
            abilityType: abilityType
        });
    }
    
    // Giant abilities
    executeSmash(bossEntity) {
        this.eventBus.emit('CREATE_SHOCKWAVE', {
            x: bossEntity.components.transform.x,
            y: bossEntity.components.transform.y,
            radius: 300,
            damage: this.currentBoss.stats.damage * 2,
            force: 800
        });
    }
    
    executeEarthquake(bossEntity) {
        this.eventBus.emit('CREATE_EARTHQUAKE', {
            duration: 3000,
            damage: this.currentBoss.stats.damage * 0.5,
            screenShake: true
        });
    }
    
    // Necromancer abilities
    executeSummonUndead(bossEntity) {
        const numMinions = 3 + Math.floor(this.bossNumber / 3);
        for (let i = 0; i < numMinions; i++) {
            setTimeout(() => {
                this.spawnNecromancerMinion();
            }, i * 200);
        }
    }
    
    executeDeathAura(bossEntity) {
        this.eventBus.emit('CREATE_DAMAGE_AURA', {
            entityId: bossEntity.id,
            radius: 250,
            damage: this.currentBoss.stats.damage * 0.3,
            duration: 5000,
            color: 0x4B0082
        });
    }
    
    executeSoulDrain(bossEntity, targetEntity) {
        this.eventBus.emit('CREATE_LIFE_DRAIN', {
            sourceId: bossEntity.id,
            targetId: targetEntity.id,
            damage: this.currentBoss.stats.damage,
            healPercent: 0.5,
            duration: 2000
        });
    }
    
    // Berserker abilities
    executeRage(bossEntity) {
        const originalDamage = this.currentBoss.stats.damage;
        const originalSpeed = bossEntity.components.physics ? bossEntity.components.physics.maxSpeed : 100;
        
        this.currentBoss.stats.damage *= 2;
        if (bossEntity.components.physics) {
            bossEntity.components.physics.maxSpeed *= 1.5;
        }
        
        this.eventBus.emit('BOSS_RAGE_MODE', {
            bossId: bossEntity.id,
            duration: 6000
        });
        
        setTimeout(() => {
            if (this.currentBoss) {
                this.currentBoss.stats.damage = originalDamage;
                if (bossEntity.components.physics) {
                    bossEntity.components.physics.maxSpeed = originalSpeed;
                }
            }
        }, 6000);
    }
    
    executeWhirlwind(bossEntity) {
        this.eventBus.emit('CREATE_WHIRLWIND', {
            entityId: bossEntity.id,
            radius: 200,
            damage: this.currentBoss.stats.damage,
            duration: 2000,
            pullForce: 300
        });
    }
    
    executeBloodlust(bossEntity) {
        // Heal based on recent damage dealt
        const healAmount = this.currentBoss.stats.damage * 5;
        bossEntity.components.health.current = Math.min(
            bossEntity.components.health.current + healAmount,
            bossEntity.components.health.max
        );
        
        this.eventBus.emit('BOSS_HEAL', {
            bossId: bossEntity.id,
            amount: healAmount
        });
    }
    
    // Phantom abilities
    executePhaseShift(bossEntity) {
        this.eventBus.emit('BOSS_PHASE_SHIFT', {
            bossId: bossEntity.id,
            duration: 3000,
            opacity: 0.3
        });
        
        // Temporarily increase dodge chance
        const originalDodge = this.currentBoss.stats.specialProperties.dodgeChance || 0;
        this.currentBoss.stats.specialProperties.dodgeChance = 0.8;
        
        setTimeout(() => {
            if (this.currentBoss) {
                this.currentBoss.stats.specialProperties.dodgeChance = originalDodge;
            }
        }, 3000);
    }
    
    executeShadowStrike(bossEntity, targetEntity) {
        // Teleport behind target and strike
        const angle = Math.atan2(
            targetEntity.components.transform.y - bossEntity.components.transform.y,
            targetEntity.components.transform.x - bossEntity.components.transform.x
        );
        
        const behindX = targetEntity.components.transform.x - Math.cos(angle) * 100;
        const behindY = targetEntity.components.transform.y - Math.sin(angle) * 100;
        
        this.eventBus.emit('TELEPORT_ENTITY', {
            entityId: bossEntity.id,
            x: behindX,
            y: behindY
        });
        
        // High damage strike
        setTimeout(() => {
            this.eventBus.emit('CREATE_MELEE_STRIKE', {
                x: behindX,
                y: behindY,
                damage: this.currentBoss.stats.damage * 3,
                radius: 150
            });
        }, 100);
    }
    
    // Tank abilities
    executeFortify(bossEntity) {
        this.eventBus.emit('ACTIVATE_BOSS_SHIELD', {
            bossId: bossEntity.id,
            duration: 5000,
            strength: 0.75 // 75% damage reduction
        });
    }
    
    executeRamCharge(bossEntity, targetEntity) {
        const direction = this.getDirectionVector(bossEntity, targetEntity);
        const chargeForce = 2000;
        
        this.eventBus.emit('APPLY_FORCE', {
            entityId: bossEntity.id,
            force: {
                x: direction.x * chargeForce,
                y: direction.y * chargeForce
            }
        });
        
        // Damage on impact
        this.eventBus.emit('CREATE_RAM_DAMAGE', {
            entityId: bossEntity.id,
            damage: this.currentBoss.stats.damage * 2,
            duration: 1000
        });
    }
    
    executeArmorPlating(bossEntity) {
        // Permanent damage reduction increase
        if (!this.currentBoss.stats.specialProperties.damageReduction) {
            this.currentBoss.stats.specialProperties.damageReduction = 0;
        }
        this.currentBoss.stats.specialProperties.damageReduction += 0.1;
        
        this.eventBus.emit('BOSS_ARMOR_UPGRADE', {
            bossId: bossEntity.id
        });
    }
    
    // Assassin abilities
    executeShadowDash(bossEntity, targetEntity) {
        const direction = this.getDirectionVector(bossEntity, targetEntity);
        const dashForce = 1500;
        
        // Leave shadow clones
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.eventBus.emit('CREATE_SHADOW_CLONE', {
                    x: bossEntity.components.transform.x,
                    y: bossEntity.components.transform.y,
                    duration: 1000
                });
            }, i * 100);
        }
        
        this.eventBus.emit('APPLY_FORCE', {
            entityId: bossEntity.id,
            force: {
                x: direction.x * dashForce,
                y: direction.y * dashForce
            }
        });
    }
    
    executeCriticalStrike(bossEntity, targetEntity) {
        const isCrit = Math.random() < (this.currentBoss.stats.specialProperties.critChance || 0.4);
        const damage = this.currentBoss.stats.damage * (isCrit ? 4 : 2);
        
        this.eventBus.emit('CREATE_TARGETED_STRIKE', {
            sourceId: bossEntity.id,
            targetId: targetEntity.id,
            damage: damage,
            isCritical: isCrit
        });
    }
    
    executeSmokeBomb(bossEntity) {
        this.eventBus.emit('CREATE_SMOKE_CLOUD', {
            x: bossEntity.components.transform.x,
            y: bossEntity.components.transform.y,
            radius: 300,
            duration: 4000
        });
        
        // Boss becomes invisible
        this.executePhaseShift(bossEntity);
    }
    
    // Elementalist abilities
    executeFireStorm(bossEntity) {
        const numFireballs = 12;
        for (let i = 0; i < numFireballs; i++) {
            const angle = (i / numFireballs) * Math.PI * 2;
            setTimeout(() => {
                this.eventBus.emit('CREATE_FIREBALL', {
                    x: bossEntity.components.transform.x,
                    y: bossEntity.components.transform.y,
                    velocityX: Math.cos(angle) * 400,
                    velocityY: Math.sin(angle) * 400,
                    damage: this.currentBoss.stats.damage,
                    burn: true
                });
            }, i * 100);
        }
    }
    
    executeIceBarrage(bossEntity, targetEntity) {
        const numShards = 5;
        for (let i = 0; i < numShards; i++) {
            setTimeout(() => {
                this.eventBus.emit('CREATE_ICE_SHARD', {
                    x: bossEntity.components.transform.x,
                    y: bossEntity.components.transform.y,
                    targetId: targetEntity.id,
                    damage: this.currentBoss.stats.damage * 0.8,
                    slow: 0.5,
                    duration: 2000
                });
            }, i * 200);
        }
    }
    
    executeLightningBolt(bossEntity, targetEntity) {
        this.eventBus.emit('CREATE_LIGHTNING', {
            sourceId: bossEntity.id,
            targetId: targetEntity.id,
            damage: this.currentBoss.stats.damage * 2,
            chainTargets: 3,
            chainDamage: this.currentBoss.stats.damage
        });
    }
    
    // Juggernaut abilities
    executeUnstoppableCharge(bossEntity, targetEntity) {
        // Become immune to knockback
        this.currentBoss.stats.specialProperties.knockbackImmune = true;
        
        // Massive charge
        const direction = this.getDirectionVector(bossEntity, targetEntity);
        const chargeForce = 3000;
        
        if (bossEntity.components.physics) {
            bossEntity.components.physics.maxSpeed *= 3;
        }
        
        this.eventBus.emit('APPLY_FORCE', {
            entityId: bossEntity.id,
            force: {
                x: direction.x * chargeForce,
                y: direction.y * chargeForce
            }
        });
        
        // Create damage trail
        this.eventBus.emit('CREATE_DAMAGE_TRAIL', {
            entityId: bossEntity.id,
            damage: this.currentBoss.stats.damage,
            width: 100,
            duration: 2000
        });
        
        setTimeout(() => {
            if (bossEntity.components.physics) {
                bossEntity.components.physics.maxSpeed /= 3;
            }
        }, 2000);
    }
    
    executeMomentum(bossEntity) {
        // Increase speed and damage based on movement
        this.eventBus.emit('ACTIVATE_MOMENTUM', {
            entityId: bossEntity.id,
            speedBonus: 1.5,
            damageBonus: 1.5,
            duration: 5000
        });
    }
    
    executeBulldoze(bossEntity, targetEntity) {
        // Push everything away
        this.eventBus.emit('CREATE_KNOCKBACK_WAVE', {
            x: bossEntity.components.transform.x,
            y: bossEntity.components.transform.y,
            force: 1000,
            radius: 400,
            damage: this.currentBoss.stats.damage
        });
    }
    
    // Architect abilities
    executeBuildTurret(bossEntity) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 200;
        const turretX = bossEntity.components.transform.x + Math.cos(angle) * distance;
        const turretY = bossEntity.components.transform.y + Math.sin(angle) * distance;
        
        this.eventBus.emit('CREATE_TURRET', {
            x: turretX,
            y: turretY,
            damage: this.currentBoss.stats.damage * 0.5,
            health: this.currentBoss.stats.specialProperties.constructHealth || 200,
            fireRate: 1000,
            owner: bossEntity.id
        });
    }
    
    executeConstructBarrier(bossEntity) {
        const numSegments = 6;
        for (let i = 0; i < numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            const distance = 250;
            const barrierX = bossEntity.components.transform.x + Math.cos(angle) * distance;
            const barrierY = bossEntity.components.transform.y + Math.sin(angle) * distance;
            
            this.eventBus.emit('CREATE_BARRIER', {
                x: barrierX,
                y: barrierY,
                health: this.currentBoss.stats.specialProperties.constructHealth || 200,
                width: 100,
                height: 20,
                rotation: angle
            });
        }
    }
    
    executeRepairDrones(bossEntity) {
        this.eventBus.emit('CREATE_REPAIR_DRONES', {
            entityId: bossEntity.id,
            numDrones: 3,
            healRate: 10,
            duration: 8000
        });
    }
    
    // Voidwalker abilities
    executeVoidRift(bossEntity) {
        this.eventBus.emit('CREATE_VOID_RIFT', {
            x: bossEntity.components.transform.x,
            y: bossEntity.components.transform.y,
            radius: 300,
            damage: this.currentBoss.stats.damage * 0.5,
            pullForce: 400,
            duration: 4000
        });
    }
    
    executeSpatialDistortion(bossEntity) {
        // Randomly teleport all entities within range
        this.eventBus.emit('CREATE_SPATIAL_DISTORTION', {
            x: bossEntity.components.transform.x,
            y: bossEntity.components.transform.y,
            radius: 500,
            teleportRadius: 300
        });
    }
    
    executeBlackHole(bossEntity) {
        this.eventBus.emit('CREATE_BLACK_HOLE', {
            x: bossEntity.components.transform.x,
            y: bossEntity.components.transform.y,
            force: 1000,
            radius: 600,
            duration: 5000,
            damage: this.currentBoss.stats.damage / 10
        });
    }
    
    updateBossMovement(bossEntity, playerEntity, behavior) {
        const distance = this.getDistance(bossEntity, playerEntity);
        
        // Apply gravity aura if voidwalker
        if (this.currentBoss.stats.specialProperties.gravityAura) {
            const pullForce = 20;
            const direction = this.getDirectionVector(playerEntity, bossEntity);
            this.eventBus.emit('APPLY_FORCE', {
                entityId: playerEntity.id,
                force: {
                    x: direction.x * pullForce,
                    y: direction.y * pullForce
                }
            });
        }
        
        switch (behavior) {
            case 'aggressive':
                // Always move towards player
                this.moveTowardsTarget(bossEntity, playerEntity, 1.0);
                break;
            case 'defensive':
                // Keep medium distance
                if (distance < 300) {
                    this.moveAwayFromTarget(bossEntity, playerEntity, 0.8);
                } else if (distance > 500) {
                    this.moveTowardsTarget(bossEntity, playerEntity, 0.5);
                }
                break;
            case 'tactical':
                // Strafe around player
                this.strafeAroundTarget(bossEntity, playerEntity, 400);
                break;
            case 'berserker':
                // Erratic movement with charges
                if (Math.random() < 0.02) {
                    this.moveTowardsTarget(bossEntity, playerEntity, 2.0);
                } else {
                    this.moveRandomly(bossEntity);
                }
                break;
            case 'sniper':
                // Keep long distance
                if (distance < 600) {
                    this.moveAwayFromTarget(bossEntity, playerEntity, 1.0);
                }
                break;
        }
    }
    
    createBossHealthBar(bossName) {
        // This will be handled by UI manager
        this.eventBus.emit('CREATE_BOSS_HEALTH_BAR', {
            name: bossName,
            maxHealth: this.currentBoss.stats.maxHealth
        });
    }
    
    updateBossHealthBar(healthPercent) {
        this.eventBus.emit('UPDATE_BOSS_HEALTH_BAR', {
            percent: healthPercent
        });
    }
    
    // Helper methods
    getDistance(entity1, entity2) {
        const dx = entity1.components.transform.x - entity2.components.transform.x;
        const dy = entity1.components.transform.y - entity2.components.transform.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getDirectionVector(fromEntity, toEntity) {
        const dx = toEntity.components.transform.x - fromEntity.components.transform.x;
        const dy = toEntity.components.transform.y - fromEntity.components.transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return {
            x: dx / distance,
            y: dy / distance
        };
    }
    
    moveTowardsTarget(entity, target, speedMultiplier = 1.0) {
        const direction = this.getDirectionVector(entity, target);
        const force = 50 * speedMultiplier;
        
        this.eventBus.emit('APPLY_FORCE', {
            entityId: entity.id,
            force: {
                x: direction.x * force,
                y: direction.y * force
            }
        });
    }
    
    moveAwayFromTarget(entity, target, speedMultiplier = 1.0) {
        const direction = this.getDirectionVector(entity, target);
        const force = 50 * speedMultiplier;
        
        this.eventBus.emit('APPLY_FORCE', {
            entityId: entity.id,
            force: {
                x: -direction.x * force,
                y: -direction.y * force
            }
        });
    }
    
    strafeAroundTarget(entity, target, preferredDistance) {
        const distance = this.getDistance(entity, target);
        const direction = this.getDirectionVector(entity, target);
        
        // Calculate perpendicular direction for strafing
        const strafeDirection = {
            x: -direction.y,
            y: direction.x
        };
        
        // Adjust for distance
        let force = { x: strafeDirection.x * 30, y: strafeDirection.y * 30 };
        
        if (distance < preferredDistance * 0.8) {
            // Too close, move away
            force.x -= direction.x * 20;
            force.y -= direction.y * 20;
        } else if (distance > preferredDistance * 1.2) {
            // Too far, move closer
            force.x += direction.x * 20;
            force.y += direction.y * 20;
        }
        
        this.eventBus.emit('APPLY_FORCE', {
            entityId: entity.id,
            force: force
        });
    }
    
    moveRandomly(entity) {
        if (Math.random() < 0.05) {
            const angle = Math.random() * Math.PI * 2;
            const force = 30;
            
            this.eventBus.emit('APPLY_FORCE', {
                entityId: entity.id,
                force: {
                    x: Math.cos(angle) * force,
                    y: Math.sin(angle) * force
                }
            });
        }
    }
    
    getRandomSpawnPosition() {
        const margin = 100;
        const worldWidth = GameConfig.world.width;
        const worldHeight = GameConfig.world.height;
        const side = Math.floor(Math.random() * 4);
        
        switch (side) {
            case 0: // Top
                return { x: Math.random() * worldWidth, y: margin };
            case 1: // Right
                return { x: worldWidth - margin, y: Math.random() * worldHeight };
            case 2: // Bottom
                return { x: Math.random() * worldWidth, y: worldHeight - margin };
            case 3: // Left
                return { x: margin, y: Math.random() * worldHeight };
        }
    }
    
    cleanup() {
        // Clear any active intervals
        if (this.necromancerDrainInterval) {
            clearInterval(this.necromancerDrainInterval);
        }
        if (this.necromancerSpawnInterval) {
            clearInterval(this.necromancerSpawnInterval);
        }
        
        if (this.bossHealthBar) {
            this.bossHealthBar.destroy();
        }
        this.currentBoss = null;
        this.bossPhase = false;
    }
}

// BossSystem will be instantiated by GameInitializer
window.BossSystem = BossSystem;