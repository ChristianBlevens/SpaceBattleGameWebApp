const GameConstants = {
    // World & Physics
    WORLD: {
        WIDTH: 16000,
        HEIGHT: 12000,
        CENTER_X: 8000,
        CENTER_Y: 6000,
        MARGIN: 100,
        BUFFER: 50
    },

    PHYSICS: {
        GRAVITY: 50.0,
        SPIRAL_FORCE: 0.0003,
        DAMPING: 0.999,
        MAX_VELOCITY: 15,
        GRAVITATION_FALLOFF: 1.8,
        BOUNDARY_FORCE: 50,
        MAX_GRAVITY_RANGE: 100000000,
        NORMAL_GRAVITY_RANGE: 4000000,
        GRAVITY_DAMPENING_DISTANCE: 200,
        GRAVITY_DAMPENING_MIN: 0.5
    },

    SPATIAL: {
        GRID_CELL_SIZE: 500
    },

    // Player Configuration
    PLAYER: {
        INITIAL_HEALTH: 100,
        INITIAL_ENERGY: 100,
        BASE_SPEED: 0.8,
        BASE_DAMAGE: 10,
        BASE_DEFENSE: 10,
        CHARGE_RATE: 2.0,
        ENERGY_REGEN: 2.0,
        HITBOX_RADIUS: 18,
        MASS: 15,
        ELASTICITY: 0.8,
        MAX_SPEED: 15,
        TRAIL_LENGTH: 20,
        TRAIL_COLOR: 0x00ffff,
        TRAIL_WIDTH: 3,
        TRAIL_ALPHA: 0.5,
        TRAIL_FADE_RATE: 0.05,
        DEPTH: 20
    },

    // Enemy Configurations
    ENEMIES: {
        FACTIONS: {
            swarm: {
                color: 0xff69b4,
                behavior: 'aggressive',
                speed: 8.0,
                health: 10,
                damage: 10,
                size: 0.7,
                spawnCount: 15,
                hitboxRadius: 12,
                depth: 15
            },
            sentinel: {
                color: 0x66ff66,
                behavior: 'defensive',
                speed: 5.0,
                health: 100,
                damage: 12,
                size: 1.2,
                spawnCount: 8,
                hitboxRadius: 16,
                depth: 15
            },
            phantom: {
                color: 0x9966ff,
                behavior: 'stealth',
                speed: 9.0,
                health: 50,
                damage: 20,
                size: 0.9,
                spawnCount: 10,
                hitboxRadius: 14,
                depth: 15
            },
            titan: {
                color: 0xff9966,
                behavior: 'boss',
                speed: 2.5,
                health: 500,
                damage: 30,
                size: 2.0,
                spawnCount: 3,
                hitboxRadius: 22,
                depth: 15
            }
        },

        AI: {
            DETECTION_RANGE: 2000,
            SHOOTING_RANGE: 800,
            MELEE_RANGE: 200,
            TITAN_DETECTION_RANGE: 2500,
            FEAR_SPREAD_MODIFIER: 0.3,
            WEAPON_COOLDOWN: 1500
        },

        BEHAVIORS: {
            swarm: {
                separationRadius: 60,
                alignmentRadius: 120,
                cohesionRadius: 150,
                separationForce: 0.25,
                alignmentForce: 0.05,
                cohesionForce: 0.1,
                orbitRadiusBase: 300,
                orbitRadiusVariation: 100,
                chaosSpeed: { min: 0.002, max: 0.006 },
                diveTimer: { min: 1500, max: 2500 },
                circleTimer: { min: 1000, max: 3000 },
                buzzTimer: 2000,
                shootAccuracy: 0.7
            },
            sentinel: {
                orbitRadius: 400,
                orbitSpeed: { min: 0.001, max: 0.002 },
                preferredDistance: { base: 350, variation: 100 },
                shotCooldown: 1500,
                shootAccuracy: 0.9,
                groupRadius: 600,
                formationSpacing: 150,
                avoidanceRadius: 150,
                avoidanceForce: 0.006
            },
            phantom: {
                dashCooldown: 500,
                dashTimer: 150,
                dashForce: 0.08,
                emergencyDashTimer: 200,
                attackTimer: 2000,
                retreatTimer: 1500,
                retreatDistance: 600,
                phaseTimer: 2000,
                phasedAlpha: 0.3,
                shootAccuracy: 0.85,
                maxSpeed: { normal: 7, phased: 10, dashing: 15 }
            },
            titan: {
                initialChargeSpeed: 2,
                maxChargeSpeed: 25,
                chargeAcceleration: 30,
                chargeCooldown: 3000,
                slamCooldown: 2000,
                slamRadius: 300,
                slamDamage: 50,
                slamKnockback: 800,
                wanderSpeed: 150,
                baseSpeed: 6,
                roarTimer: { min: 5000, max: 10000 }
            }
        }
    },

    // Boss Configuration
    BOSSES: {
        SPAWN_DELAY: 1000,
        BASE_HEALTH: 800,
        HEALTH_PER_WAVE: 200,
        BASE_DAMAGE: 30,
        DAMAGE_PER_WAVE: 10,
        ABILITY_INTERVAL: 3000,
        HITBOX_SCALE: 40,
        DEPTH: 30,

        TYPES: [
            {
                name: 'Titan Destroyer',
                color: 0xff6666,
                scale: 2.5,
                healthMultiplier: 3.0,
                damageMultiplier: 2.0,
                speedMultiplier: 0.5,
                abilities: ['shockwave', 'summon']
            },
            {
                name: 'Phantom Lord',
                color: 0x9966ff,
                scale: 1.8,
                healthMultiplier: 1.5,
                damageMultiplier: 1.8,
                speedMultiplier: 1.5,
                abilities: ['teleport', 'multishot']
            },
            {
                name: 'Void Reaper',
                color: 0x6666ff,
                scale: 2.0,
                healthMultiplier: 2.0,
                damageMultiplier: 1.5,
                speedMultiplier: 1.0,
                abilities: ['blackhole', 'beam']
            },
            {
                name: 'Swarm Queen',
                color: 0xff66ff,
                scale: 2.2,
                healthMultiplier: 2.5,
                damageMultiplier: 1.2,
                speedMultiplier: 0.8,
                abilities: ['summon', 'heal']
            },
            {
                name: 'Storm Bringer',
                color: 0x66ffff,
                scale: 2.0,
                healthMultiplier: 2.0,
                damageMultiplier: 2.0,
                speedMultiplier: 1.2,
                abilities: ['lightning', 'shockwave']
            }
        ],

        ABILITIES: {
            shockwave: {
                radius: 400,
                damage: 50,
                force: 1000
            },
            summon: {
                count: { min: 3, max: 5 },
                distance: 150,
                minionScale: 0.5
            },
            multishot: {
                projectileCount: 8,
                projectileSpeed: 15,
                projectileDamage: 30
            },
            blackhole: {
                radius: 600,
                force: 800,
                duration: 5000
            },
            beam: {
                damage: 5,
                duration: 2000
            },
            lightning: {
                damage: 40,
                chains: 2
            },
            heal: {
                percentageOfMax: 0.1
            },
            teleport: {
                range: 500
            }
        },

        REWARDS: {
            BASE_CREDITS: 100,
            CREDITS_PER_BOSS: 50
        }
    },

    // Weapons & Projectiles
    WEAPONS: {
        BASIC: {
            FIRE_RATE: 300,
            DAMAGE: 10,
            PROJECTILE_SPEED: 15,
            MAX_CHARGE_TIME: 2000,
            CHARGE_MULTIPLIER: 1.0,
            SPEED_MULTIPLIER: 0.5
        },
        ENEMY: {
            FIRE_RATE: 1500,
            PROJECTILE_SPEED: 15,
            INACCURACY_SPREAD: 0.3
        },
        BOSS: {
            FIRE_RATE: 800
        },

        PROJECTILES: {
            BASIC: {
                SIZE: 6,
                LIFETIME: 5000,
                MASS: 0.5,
                DEPTH: 18
            },
            CHARGED: {
                SIZE: 10,
                SCALE: 1.5,
                PENETRATING: true
            },
            ENEMY: {
                SIZE: 5
            },
            TRAIL: {
                LENGTH: 10,
                COLOR: { BASIC: 0xffff00, CHARGED: 0x00ffff },
                WIDTH: 3
            },
            RECOIL: {
                BASE_FORCE: 0.5,
                CHARGE_MULTIPLIER: 1.0
            }
        }
    },

    // Wave System
    WAVES: {
        BASE_ENEMY_COUNT: 10,
        ENEMY_MULTIPLIER: 1.3,
        SPAWN_DELAY: 100,
        WAVE_START_DELAY: 3000,
        BOSS_TRANSITION_DELAY: 2000,
        BOSS_WAVE_INTERVAL: 1,
        STRENGTH_MULTIPLIER: 0.1,

        DISTRIBUTION: {
            SWARM_BASE: 0.5,
            SENTINEL_BASE: 0.2,
            PHANTOM_BASE: 0.2,
            TITAN_BASE: 0.1,
            PROGRESSION_SCALE: 0.2,
            CLUSTER_SPACING: 50,
            LINE_SPACING: 150,
            DISTRIBUTION_SECTIONS: 4
        }
    },

    // Combat System
    COMBAT: {
        COMBO: {
            MAX_TIMER: 3000,
            POINTS_MULTIPLIER: 100
        },

        REWARDS: {
            SWARM_CREDITS: 3,
            SENTINEL_CREDITS: 5,
            PHANTOM_CREDITS: 7,
            TITAN_CREDITS: 15,
            BOSS_CREDITS: 100,
            WAVE_BONUS_BASE: 50,
            WAVE_BONUS_PER_WAVE: 10,
            SCORE_MULTIPLIER: 1000
        },

        POWERUPS: {
            SPAWN_CHANCE: 0.3,
            TYPES: ['health', 'energy', 'credits'],
            LIFETIME: 10000,
            PICKUP_RADIUS: 35,
            DEPTH: 25,
            VALUES: {
                health: 25,
                energy: 25,
                credits: 20
            }
        }
    },

    // Upgrade System
    UPGRADES: {
        damage: {
            base: 10,
            multiplier: 1.15,
            increase: 5,
            baseCost: 50,
            costMultiplier: 1.5
        },
        speed: {
            base: 8,
            multiplier: 1.12,
            increase: 0.2,
            baseCost: 40,
            costMultiplier: 1.4
        },
        defense: {
            base: 12,
            multiplier: 1.18,
            increase: 3,
            baseCost: 60,
            costMultiplier: 1.6
        },
        energy: {
            base: 8,
            multiplier: 1.12,
            increase: 20,
            baseCost: 45,
            costMultiplier: 1.45
        },
        health: {
            increase: 25,
            baseCost: 55,
            costMultiplier: 1.5
        }
    },

    // Ability System
    ABILITIES: {
        dash: {
            energyCost: 10,
            cooldown: 2000,
            duration: 200,
            force: 50
        },
        boost: {
            energyCost: 20,
            cooldown: 5000,
            duration: 3000,
            speedMultiplier: 2
        },
        shield: {
            energyCost: 30,
            cooldown: 10000,
            duration: 5000
        },
        blast: {
            energyCost: 50,
            cooldown: 15000,
            radius: 500,
            baseDamage: 100,
            explosionForce: 20
        }
    },

    // Catastrophe (Vortex)
    CATASTROPHE: {
        WANDER_SPEED: 150,
        WANDER_TURN_RATE: 5.0,
        MASS: 2000,
        COLLIDER_RADIUS: 300,
        SCALE: 3,
        DEPTH: 5,

        PULL: {
            STRENGTH: 400,
            RADIUS: 2000,
            EVENT_HORIZON: 300,
            IMMUNITY_TRIGGER_TIME: 1000,
            IMMUNITY_DURATION: 15000,
            EJECTION_FORCE: 800,
            SPIRAL_FACTOR: 0.8,
            CHAOS_FACTOR: 0.3
        }
    },

    // Disasters
    DISASTERS: {
        MIN_INTERVAL: 30000,
        MAX_INTERVAL: 90000,
        WARNING_TIME: 3000,

        METEOR_SHOWER: {
            DURATION: 15000,
            SPAWN_INTERVAL: 200,
            DAMAGE: 15,
            SPEED: { MIN: 3, MAX: 5 },
            SCALE: { MIN: 2, MAX: 3 }
        },

        BLACK_HOLE: {
            DURATION: 20000,
            CENTER_FORCE: 200,
            DAMAGE_RADIUS: 80,
            DAMAGE: 10,
            PULL_MULTIPLIER: 0.5
        },

        SOLAR_FLARE: {
            DURATION: 12000,
            WAVE_INTERVAL: 3000,
            WAVE_DAMAGE: 10
        },

        GRAVITY_STORM: {
            DURATION: 18000,
            CHANGE_INTERVAL: 2000,
            STRENGTH: { MIN: 20, MAX: 50 }
        },

        ASTEROID_FIELD: {
            DURATION: 25000,
            COUNT: { MIN: 15, MAX: 25 },
            SPEED: { MIN: 20, MAX: 50 },
            SIZE: { MIN: 1, MAX: 3 },
            DAMAGE: 10,
            HEALTH: 50
        },

        ION_STORM: {
            DURATION: 15000,
            SPEED_MULTIPLIER: 0.5,
            LIGHTNING_INTERVAL: 500
        },

        SPACE_TORNADO: {
            DURATION: 20000,
            FORCE: 200,
            RADIUS: 200,
            ROTATION_SPEED: 5,
            VELOCITY: 100
        },

        COSMIC_RIFT: {
            DURATION: 15000,
            RIFT_INTERVAL: 2000,
            DAMAGE: 20,
            LENGTH: { MIN: 100, MAX: 300 }
        }
    },

    // Effects & UI
    EFFECTS: {
        EXPLOSION_PARTICLES: 50,
        TRAIL_LENGTH: 20,
        SCREEN_SHAKE_INTENSITY: 10,
        GLOW_INTENSITY: 1.5,

        CAMERA: {
            SHAKE: {
                TITAN_SLAM: { DURATION: 800, INTENSITY: 0.04 },
                CHARGED_SHOT: { DURATION: 200, INTENSITY: 0.01 },
                NOVA_BLAST: { DURATION: 500, INTENSITY: 0.02 }
            },
            FLASH: {
                NOVA_BLAST: { DURATION: 200, COLOR: { R: 255, G: 0, B: 255 } }
            }
        }
    },

    UI: {
        MAX_DASH_COOLDOWN: 2000,
        MAX_COMBO_TIMER: 3000,
        NOTIFICATION_DURATION: 3000
    }
};

// Freeze the object to prevent accidental modifications
Object.freeze(GameConstants);

// Make available globally
window.GameConstants = GameConstants;