// EntityFactory.js - Handles all entity creation without visual effects or collision logic
// REFACTORED: Removed visual effects and collision setup, now purely creates entities

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
        // Create player entity with all components
        const playerId = this.entityManager.createEntity('player', {
            transform: { x: x, y: y, rotation: 0, scale: 1, prevX: x, prevY: y },
            physics: { velocity: { x: 5, y: 0 }, acceleration: { x: 0, y: 0 }, mass: 15, radius: 40, damping: 0.999, maxSpeed: 15, elasticity: 0.8 },
            health: Components.health(
				GameConfig.player.initialHealth,
				GameConfig.player.initialHealth
			),
            weapon: Components.weapon(
                GameConfig.player.baseDamage,
                300,
                25
            ),
            sprite: Components.sprite('player'),
            trail: Components.trail(20, 0x00ffff, 3),
            faction: Components.faction('player', 0x00ffff, [])
        });
        
        // Create Matter.js sprite
        const sprite = this.scene.matter.add.sprite(x, y, 'player');
        sprite.setCircle(40);
        sprite.setMass(15);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.8);
        sprite.setData('entityId', playerId);
        sprite.setData('entityType', 'player');
        
        // Store references
        this.scene.sprites.set(playerId, sprite);
        
        // Request trail creation
        this.eventBus.emit('CREATE_TRAIL', {
            entityId: playerId,
            trailConfig: { points: [], maxLength: 20, color: 0x00ffff, width: 3, alpha: 0.5, fadeRate: 0.05 }
        });
        
        return playerId;
    }
    
    createEnemy(faction, x, y, initialVelocity = {x: 0, y: 0}) {
        console.log('[EntityFactory] createEnemy called:', { faction, x, y, initialVelocity });
        
        const factionConfig = GameConfig.factions[faction];
        if (!factionConfig) {
            console.error('[EntityFactory] No faction config for:', faction);
            return null;
        }
        
        console.log('[EntityFactory] Faction config:', factionConfig);
        
        // Create enemy entity
        const enemyId = this.entityManager.createEntity('enemy', {
            transform: Components.transform(x, y),
            physics: Components.physics(
                initialVelocity.x, 
                initialVelocity.y, 
                10 * factionConfig.size, 
                25 * factionConfig.size
            ),
            health: Components.health(factionConfig.health, factionConfig.health),
            weapon: Components.weapon(factionConfig.damage, 1500, 15),
            ai: Components.ai(factionConfig.behavior, faction),
            sprite: Components.sprite(`enemy-${faction}`),
            faction: Components.faction(faction, factionConfig.color, [faction])
        });
        
        console.log('[EntityFactory] Enemy entity created with ID:', enemyId);
        
        // Create sprite
        const sprite = this.scene.matter.add.sprite(x, y, `enemy-${faction}`);
        sprite.setCircle(25 * factionConfig.size);
        sprite.setMass(10 * factionConfig.size);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.7);
        sprite.setScale(factionConfig.size);
        sprite.setVelocity(initialVelocity.x, initialVelocity.y);
        sprite.setData('entityId', enemyId);
        sprite.setData('entityType', 'enemy');
        
        console.log('[EntityFactory] Enemy sprite created');
        
        // Store references
        this.scene.sprites.set(enemyId, sprite);
        this.scene.enemyGroup.add(sprite);
        
        console.log('[EntityFactory] Enemy added to groups, total enemies:', this.scene.enemyGroup.children.size);
        
        return enemyId;
    }
    
    createPlanet(x, y, size = 'medium') {
        const sizeConfig = {
            small: { radius: 40, mass: 20, texture: 'planet-small' },
            medium: { radius: 60, mass: 50, texture: 'planet-medium' },
            large: { radius: 80, mass: 100, texture: 'planet-large' }
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
        sprite.setCircle(config.radius);
        sprite.setMass(config.mass);
        sprite.setStatic(false);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.9);
        sprite.setScale(config.radius / 80);
        sprite.setData('entityId', planetId);
        sprite.setData('entityType', 'planet');
        
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
            physics: Components.physics(0, 0, 0.1, 20),
            sprite: Components.sprite(`powerup-${type}`),
            powerup: Components.powerup(type, type === 'credits' ? 100 : 25),
            lifetime: Components.lifetime(10000)
        });
        
        const sprite = this.scene.matter.add.sprite(x, y, `powerup-${type}`);
        sprite.setCircle(20);
        sprite.setSensor(true);
        sprite.setFriction(0);
        sprite.setData('entityId', powerupId);
        sprite.setData('entityType', 'powerup');
        
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
        
        this.scene.sprites.set(projectileId, sprite);
        this.scene.projectileGroup.add(sprite);
        
        return projectileId;
    }
}

// EntityFactory will be instantiated by GameInitializer
window.EntityFactory = EntityFactory;