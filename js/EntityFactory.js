// EntityFactory.js - Centralized entity creation factory
// Creates all game entities with proper component composition

class EntityFactory {
    constructor(entityManager, eventBus) {
        this.entityManager = entityManager;
        this.eventBus = eventBus;
        this.scene = null;
    }
    
    setScene(scene) {
        this.scene = scene;
    }
    
    createPlayer(x, y) {
        // Initialize player with full component set
        const playerId = this.entityManager.createEntity('player', {
            transform: { x: x, y: y, rotation: 0, scale: 1, prevX: x, prevY: y },
            physics: { velocity: { x: 5, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 15, radius: 40, damping: 0.999, maxSpeed: 15, elasticity: 0.8 },
            health: Components.health(
				GameConfig.player.initialHealth,
				GameConfig.player.initialHealth
			),
            weapon: Components.weapon(
                'basic',
                GameConfig.player.baseDamage,
                300
            ),
            sprite: Components.sprite('player'),
            trail: Components.trail(20, 0x00ffff, 3),
            faction: Components.faction('player', 0x00ffff, [])
        });
        
        // Configure physics body
        const sprite = this.scene.matter.add.sprite(x, y, 'player');
        sprite.setCircle(12); // Circular hitbox for smooth collision
        sprite.setMass(15);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.8);
        sprite.setData('entityId', playerId);
        sprite.setData('entityType', 'player');
        
        // Store references
        sprite.setDepth(20); // Player above most entities
        this.scene.sprites.set(playerId, sprite);
        
        // Initialize visual trail effect
        this.eventBus.emit('CREATE_TRAIL', {
            entityId: playerId,
            trailConfig: { points: [], maxLength: 20, color: 0x00ffff, width: 3, alpha: 0.5, fadeRate: 0.05 }
        });
        
        // Emit entity created event
        this.eventBus.emit('ENTITY_CREATED', {
            id: playerId,
            type: 'player'
        });
        
        return playerId;
    }
    
    createEnemy(faction, x, y, initialVelocity = {x: 0, y: 0}, strengthMultiplier = 1, isNecromancerMinion = false) {
        // Validate faction configuration
        const factionConfig = GameConfig.factions[faction];
        if (!factionConfig) {
            console.error('[EntityFactory] No faction config for:', faction);
            return null;
        }
        
        //console.log('[EntityFactory] Faction config:', factionConfig);
        
        // Scale enemy stats by wave difficulty
        const enhancedHealth = Math.floor(factionConfig.health * strengthMultiplier);
        const enhancedDamage = Math.floor(factionConfig.damage * strengthMultiplier);
        
        //console.log(`[EntityFactory] Creating ${faction} with health: ${enhancedHealth}, damage: ${enhancedDamage}`);
        
        // Compose enemy components
        const components = {
            transform: Components.transform(x, y),
            physics: Components.physics(
                initialVelocity.x, 
                initialVelocity.y, 
                10 * factionConfig.size, 
                25 * factionConfig.size
            ),
            health: Components.health(enhancedHealth, enhancedHealth),
            weapon: Components.weapon('basic', enhancedDamage, 1500),
            ai: Components.ai(factionConfig.behavior, faction),
            sprite: Components.sprite(`enemy-${faction}`),
            faction: Components.faction(faction, factionConfig.color, [faction])
        };
        
        // Mark necromancer summons
        if (isNecromancerMinion) {
            components.ai.isNecromancerMinion = true;
        }
        
        const enemyId = this.entityManager.createEntity('enemy', components);
        
        //console.log('[EntityFactory] Enemy entity created with ID:', enemyId);
        
        // Create sprite
        const sprite = this.scene.matter.add.sprite(x, y, `enemy-${faction}`);
        
        // Set hitbox based on faction sprite size
        const hitboxSizes = {
            swarm: 10,    // Increased from 6 - 24x12 sprite
            sentinel: 14, // Increased from 12 - 28x20 sprite
            phantom: 14,  // Increased from 12 - 32x16 sprite
            titan: 20    // Increased from 18 - 40x32 sprite
        };
        
        const baseHitbox = hitboxSizes[faction] || 12;
        sprite.setCircle(baseHitbox * factionConfig.size);
        sprite.setMass(10 * factionConfig.size);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.7);
        sprite.setScale(factionConfig.size);
        sprite.setVelocity(initialVelocity.x, initialVelocity.y);
        sprite.setData('entityId', enemyId);
        sprite.setData('entityType', 'enemy');
        
        //console.log('[EntityFactory] Enemy sprite created');
        
        // Store references
        sprite.setDepth(15); // Enemies above vortex
        this.scene.sprites.set(enemyId, sprite);
        this.scene.enemyGroup.add(sprite);
        
        //console.log('[EntityFactory] Enemy added to groups, total enemies:', this.scene.enemyGroup.children.size);
        
        return enemyId;
    }
    
    createPlanet(x, y, size = 'medium') {
        const sizeConfig = {
            small: { radius: 40, mass: 200, texture: 'planet-small' },
            medium: { radius: 60, mass: 600, texture: 'planet-medium' },
            large: { radius: 80, mass: 1200, texture: 'planet-large' }
        };
        
        const config = sizeConfig[size];
        
        // Create planet entity
        const planetId = this.entityManager.createEntity('planet', {
            transform: Components.transform(x, y, 0, config.radius / 80),
            physics: Components.physics(0, 0, config.mass, config.radius),
            sprite: Components.sprite(config.texture)
        });
        
        // Create sprite
        const sprite = this.scene.matter.add.sprite(x, y, config.texture);
        // Set the circle hitbox to match the exact visual size
        sprite.setCircle(config.radius);
        sprite.setMass(config.mass);
        sprite.setStatic(false);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.9);
        sprite.setData('entityId', planetId);
        sprite.setData('entityType', 'planet');
        sprite.setRotation(0); // Ensure zero rotation
        sprite.setAngularVelocity(0); // No spinning
        
        sprite.setDepth(10); // Planets above vortex but below enemies
        this.scene.sprites.set(planetId, sprite);
        
        return planetId;
    }
    
    createOrbitalSystem(centerX, centerY, numPlanets, centralSize = 'large') {
        // Create central body
        const centralId = this.createPlanet(centerX, centerY, centralSize);
        const centralPhysics = this.entityManager.getComponent(centralId, 'physics');
        centralPhysics.mass *= 3; // Make it more massive
        
        const orbitingPlanets = [];
        
        // Create orbiting planets
        for (let i = 0; i < numPlanets; i++) {
            const orbitRadius = 200 + (i * 150);
            const angle = (Math.PI * 2 * i) / numPlanets;
            
            const x = centerX + Math.cos(angle) * orbitRadius;
            const y = centerY + Math.sin(angle) * orbitRadius;
            
            const planetId = this.createPlanet(x, y, 'small');
            const physics = this.entityManager.getComponent(planetId, 'physics');
            
            // Calculate orbital velocity
            const orbitalSpeed = Math.sqrt(GameConfig.physics.gravity * centralPhysics.mass / orbitRadius) * 2;
            physics.velocity.x = -Math.sin(angle) * orbitalSpeed;
            physics.velocity.y = Math.cos(angle) * orbitalSpeed;
            
            // Also set the sprite velocity
            const sprite = this.scene.sprites.get(planetId);
            if (sprite) {
                sprite.setVelocity(physics.velocity.x, physics.velocity.y);
            }
            
            orbitingPlanets.push(planetId);
        }
        
        return { centralId, orbitingPlanets };
    }
    
    createPowerup(x, y, type) {
        const powerupId = this.entityManager.createEntity('powerup', {
            transform: Components.transform(x, y),
            physics: Components.physics(0, 0, 0.1, 35), // Increased pickup radius
            sprite: Components.sprite(`powerup-${type}`),
            powerup: Components.powerup(type, type === 'credits' ? 100 : 25),
            lifetime: Components.lifetime(10000)
        });
        
        const sprite = this.scene.matter.add.sprite(x, y, `powerup-${type}`);
        sprite.setCircle(35); // Much larger pickup radius for easier collection
        sprite.setSensor(true);
        sprite.setFriction(0);
        sprite.setData('entityId', powerupId);
        sprite.setData('entityType', 'powerup');
        
        sprite.setDepth(25); // Powerups on top
        this.scene.sprites.set(powerupId, sprite);
        this.scene.powerupGroup.add(sprite);
        
        // Emit creation event for RenderSystem to handle animations
        this.eventBus.emit('POWERUP_CREATED', {
            entityId: powerupId,
            type: type,
            position: { x, y }
        });
        
        return powerupId;
    }
    
    createProjectile(ownerId, x, y, angle, speed, damage, size, isCharged = false) {
        const ownerEntity = this.entityManager.getEntity(ownerId);
        const ownerFaction = this.entityManager.getComponent(ownerId, 'faction');
        
        // Determine texture
        let texture = 'projectile-basic';
        if (isCharged) {
            texture = 'projectile-charged';
        } else if (ownerEntity && ownerEntity.type === 'enemy') {
            texture = 'projectile-enemy';
        }
        
        // Create projectile entity
        const projectileId = this.entityManager.createEntity('projectile', {
            transform: Components.transform(x, y, angle),
            physics: Components.physics(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                0.5,
                size
            ),
            sprite: Components.sprite(texture),
            lifetime: Components.lifetime(5000),
            projectile: {
                damage: damage,
                ownerId: ownerId,
                ownerFaction: ownerFaction ? ownerFaction.name : 'neutral',
                penetrating: isCharged,
                hitEntities: new Set()
            }
        });
        
        // Create sprite
        const sprite = this.scene.matter.add.sprite(x, y, texture);
        sprite.setCircle(size);
        sprite.setSensor(true);
        sprite.setRotation(angle);
        sprite.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
        sprite.setData('entityId', projectileId);
        sprite.setData('entityType', 'projectile');
        
        if (isCharged) {
            sprite.setScale(1.5);
        }
        
        // Request trail for player/charged projectiles
        if (isCharged || ownerEntity.type === 'player') {
            this.entityManager.addComponent(projectileId, 'trail', 
                Components.trail(10, isCharged ? 0x00ffff : 0xffff00, 3)
            );
            
            this.eventBus.emit('CREATE_TRAIL', {
                entityId: projectileId,
                trailConfig: Components.trail(10, isCharged ? 0x00ffff : 0xffff00, 3)
            });
        }
        
        sprite.setDepth(18); // Projectiles above enemies
        this.scene.sprites.set(projectileId, sprite);
        this.scene.projectileGroup.add(sprite);
        
        return projectileId;
    }
    
    createCatastrophe(x, y) {
        // Create combined catastrophe entity (vortex + galactic spiral)
        const catastropheId = this.entityManager.createEntity('catastrophe', {
            transform: Components.transform(x, y, 0, 1),
            physics: Components.physics(0, 0, 2000, 300), // Massive wandering catastrophe
            sprite: Components.sprite('vortex'),
            catastrophe: {
                strength: 400,  // Much less intense pull
                radius: 300,     // Close immunity trigger radius (same as visual)
                pullRadius: 2000, // Smaller pull radius
                rotationSpeed: 4,
                immunityTriggerTime: 1000, // 1 second near it
                immunityDuration: 15000 // 15 seconds immunity
            }
        });
        
        // Create sprite
        const sprite = this.scene.matter.add.sprite(x, y, 'vortex');
        sprite.setScale(3); // Large catastrophe
        sprite.setCircle(300);
        sprite.setSensor(true); // Don't collide, just pull
        sprite.setStatic(false); // Can move
        sprite.setData('entityId', catastropheId);
        sprite.setData('entityType', 'catastrophe');
        sprite.setDepth(5); // Slightly above background
        
        this.scene.sprites.set(catastropheId, sprite);
        
        // Store on scene for special rendering
        this.scene.catastropheId = catastropheId;
        
        // Emit entity created event
        this.eventBus.emit('ENTITY_CREATED', {
            id: catastropheId,
            type: 'catastrophe'
        });
        
        return catastropheId;
    }
    
    createBoss(x, y, bossStats) {
        // Create boss entity with specified stats
        
        // Create boss entity with all components
        const bossId = this.entityManager.createEntity('boss', {
            transform: Components.transform(x, y),
            physics: {
                velocity: { x: 0, y: 0 },
                acceleration: { x: 0, y: 0 },
                mass: bossStats.mass,
                radius: 40 * bossStats.scale,
                damping: 0.99,
                maxSpeed: bossStats.speed,
                elasticity: 0.9
            },
            health: Components.health(bossStats.health, bossStats.maxHealth),
            weapon: Components.weapon('boss', bossStats.damage, 800),
            ai: Components.ai(bossStats.behavior, 'boss'),
            sprite: Components.sprite('boss'),
            faction: Components.faction('boss', bossStats.color, ['boss']),
            boss: {
                abilities: bossStats.abilities,
                name: bossStats.name,
                scale: bossStats.scale,
                phase: 1
            }
        });
        
        // Create Matter.js sprite - using enemy sprite as placeholder for now
        const sprite = this.scene.matter.add.sprite(x, y, 'enemy-titan');
        sprite.setCircle(40 * bossStats.scale);
        sprite.setMass(bossStats.mass);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.9);
        sprite.setScale(bossStats.scale);
        sprite.setTint(bossStats.color);
        sprite.setData('entityId', bossId);
        sprite.setData('entityType', 'boss');
        sprite.setData('isBoss', true);
        
        // Store references
        sprite.setDepth(30); // Boss above other entities
        this.scene.sprites.set(bossId, sprite);
        
        // Add boss glow/aura effect
        this.eventBus.emit('CREATE_BOSS_AURA', {
            entityId: bossId,
            color: bossStats.color,
            scale: bossStats.scale
        });
        
        // Emit entity created event
        this.eventBus.emit('ENTITY_CREATED', {
            id: bossId,
            type: 'boss',
            stats: bossStats
        });
        
        return bossId;
    }
}

// EntityFactory will be instantiated by GameInitializer
window.EntityFactory = EntityFactory;