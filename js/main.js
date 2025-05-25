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

// Initialize Howler sounds
const AudioManager = {
    sounds: {},
    music: null,
    
    init() {
        // Load sound effects
        this.sounds.shoot = new Howl({
            src: ['data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl+z/PYiTEIHGvA7+CWTRARUqzn7bllGgg8leDuldMIHGvA79+VTQ0MVqnn7bllGQ0'],
            volume: 0.3
        });
        
        this.sounds.explosion = new Howl({
            src: ['data:audio/wav;base64,UklGRjIHAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQ4HAAB/f39/f39/f39/f39/f3+AfwB1qrWDVX6Tf3+Uh2V0kYl/dqR6YnqZhEyHpHFjqHVRm6FMaLeFNKe8N1fLgjvMsDnOxTXHyj3AxEfBvUzItEzOq0jQqEfMrEnHr0/AsVS+r1e9sFO6sFG0sVWtr1morVuXqmWLomJ1kYJrg3uNfoB+gIB/f4B/g3N6kXZxk35rf3+Df3+Ff3+CgH+Af4B/fn+Af3+Af4B/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f3+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+Af4B/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/'],
            volume: 0.5
        });
        
        this.sounds.powerup = new Howl({
            src: ['data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAf4B/gH+Af4B/gH+Af4B/gH+Af4B/gICAf3+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4ODhYeIi4eLgH+Af4B/gH+Af3qDeYR5hHmEeYR5hHmEeYR5hHmEeYR5hHmEeYR5hHmEeYR5hHmEeYR5hHmEeYR5hHmEeYSAf4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/'],
            volume: 0.4
        });
        
        this.sounds.hit = new Howl({
            src: ['data:audio/wav;base64,UklGRhwGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YfgFAACBj318eYKRhHl/jIR0hpiJcYCShXF9joNwg5OGcn+QiXZ7h4x8eoKFgnuCgoZ/f39/hoOAf3+Dgn5+goN+fYKEfnuBhH57gYV+e4GFfnuBiH94gYl/d4GLf3iAi393gIx/d3+Mf3eAjH92gIx/doCMf3aAjH92gIx/doCMf3eBi394gYp+eYGJfnqBiX57gYh+e4KHfnyChX59goR+foKCfn+Cgn6AgoF+gIKAfoCCgH6AgoF+'],
            volume: 0.3
        });
        
        // Background music
        this.music = new Howl({
            src: ['https://cdn.freesound.org/previews/316/316917_5123451-lq.mp3'],
            volume: 0.2,
            loop: trueICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg