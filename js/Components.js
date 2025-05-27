// Components.js - Component factory functions for the ECS

const Components = {
    transform: (x = 0, y = 0, rotation = 0) => ({
        x,
        y,
        rotation,
        velocity: { x: 0, y: 0 },
        scale: 1
    }),
    
    sprite: (key, sprite = null) => ({
        key,
        sprite,
        tint: 0xffffff,
        alpha: 1
    }),
    
    health: (max = 100, current = max) => ({
        max,
        current,
        regen: 0,
        invulnerable: false,
        invulnerabilityTime: 0
    }),
    
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
        ammo: -1,
        spread: 0
    }),
    
    ai: (behavior = 'basic', aggroRange = 500) => ({
        behavior,
        aggroRange,
        targetId: null,
        state: 'idle',
        fearLevel: 0,
        lastThought: 0,
        faction: 'neutral',
        memory: {},
        decisionTimer: 0,
        reactionTime: 200,
        aggressionLevel: 0.5
    }),
    
    faction: (name = 'neutral') => ({
        name,
        hostile: new Set(),
        friendlyWith: new Set()
    }),
    
    enemy: (value = 100, difficulty = 1) => ({
        value,
        difficulty,
        spawnTime: Date.now()
    }),
    
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
        hitEntities: new Set()
    }),
    
    powerup: (type = 'health', value = 25) => ({
        type,
        value,
        collected: false,
        lifetime: 10000,
        age: 0
    }),
    
    planet: (radius = 100, mass = 1000) => ({
        radius,
        mass,
        atmosphereRadius: radius * 1.5,
        type: 'terrestrial'
    }),
    
    physics: (vx = 0, vy = 0, mass = 1, radius = 20) => ({
        mass,
        restitution: 0.5,
        body: null,
        category: 'default',
        collidesWith: ['all'],
        velocity: { x: vx, y: vy },
        acceleration: { x: 0, y: 0 },
        radius: radius,
        damping: 0.999,
        maxSpeed: 15,
        elasticity: 0.8
    }),
    
    trail: (length = 10, color = 0x00ffff, width = 2) => ({
        points: [],
        maxLength: length,
        color: color,
        width: width,
        alpha: 0.5,
        fadeRate: 0.05
    }),
    
    lifetime: (duration) => ({
        duration: duration,
        elapsed: 0,
        fadeOut: true,
        destroyOnExpire: true
    })
};

// Export for use in other modules
window.Components = Components;