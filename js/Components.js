// Components.js - Component factory functions for the ECS
// Provides consistent component structures for all entities in the game

const Components = {
    // Position and movement data
    transform: (x = 0, y = 0, rotation = 0) => ({
        x,
        y,
        rotation,
        velocity: { x: 0, y: 0 },
        scale: 1
    }),
    
    // Visual representation
    sprite: (key, sprite = null) => ({
        key,
        sprite,
        tint: 0xffffff,
        alpha: 1
    }),
    
    // Health and damage system
    health: (max = 100, current = max) => ({
        max,
        current,
        regen: 0,
        invulnerable: false,
        invulnerabilityTime: 0
    }),
    
    // Weapon configuration and state
    weapon: (type = 'basic', damage = 10, fireRate = 200) => ({
        type,
        damage,
        fireRate,
        lastFireTime: 0,
        energy: 0,
        charging: false,
        chargeTime: 0,
        maxChargeTime: 2000,
        projectileSpeed: 20,
        ammo: -1, // -1 = infinite
        spread: 0
    }),
    
    // AI behavior and decision making
    ai: (behavior = 'basic', faction = 'swarm') => ({
        behavior,
        aggroRange: 500,
        targetId: null,
        state: 'idle', // idle, pursuing, fleeing, attacking
        fearLevel: 0,
        lastThought: 0,
        faction: faction,
        memory: {},
        decisionTimer: 0,
        reactionTime: 200,
        aggressionLevel: 0.5
    }),
    
    // Faction allegiance for combat
    faction: (name = 'neutral') => ({
        name,
        hostile: new Set(),
        friendlyWith: new Set()
    }),
    
    // Enemy-specific data
    enemy: (value = 100, difficulty = 1) => ({
        value,
        difficulty,
        spawnTime: Date.now()
    }),
    
    // Projectile properties
    projectile: (damage = 10, speed = 10, ownerId = null, ownerFaction = null) => ({
        damage,
        speed,
        ownerId,
        ownerFaction,
        penetrating: false,
        homing: false,
        targetId: null,
        lifetime: 3000,
        age: 0,
        hitEntities: new Set() // Track hits for penetrating projectiles
    }),
    
    // Collectible powerup
    powerup: (type = 'health', value = 25) => ({
        type, // health, energy, credits
        value,
        collected: false,
        lifetime: 10000,
        age: 0
    }),
    
    // Celestial body with gravity
    planet: (radius = 100, mass = 1000) => ({
        radius,
        mass,
        atmosphereRadius: radius * 1.5,
        type: 'terrestrial'
    }),
    
    // Physics properties for n-body simulation
    physics: (vx = 0, vy = 0, mass = 1, radius = 20) => ({
        mass,
        restitution: 0.5,
        body: null, // Matter.js body reference
        category: 'default',
        collidesWith: ['all'],
        velocity: { x: vx, y: vy },
        acceleration: { x: 0, y: 0 },
        radius: radius,
        damping: 0.999,
        maxSpeed: 15,
        elasticity: 0.8
    }),
    
    // Visual trail effect
    trail: (length = 10, color = 0x00ffff, width = 2) => ({
        points: [],
        maxLength: length,
        color: color,
        width: width,
        alpha: 0.5,
        fadeRate: 0.05
    }),
    
    // Entity lifetime management
    lifetime: (duration) => ({
        duration: duration,
        elapsed: 0,
        fadeOut: true,
        destroyOnExpire: true
    })
};

// Export for use in other modules
window.Components = Components;