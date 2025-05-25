// EntityFactory.js - Handles all entity creation

class EntityFactory {
    constructor(scene) {
        this.scene = scene;
        this.entityManager = window.EntityManager;
    }
    
    createPlayer(x, y) {
        // Create player entity with all components
        const playerId = this.entityManager.createEntity('player', {
            transform: Components.transform(x, y),
            physics: Components.physics(5, 0, 15, 40),
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
        
        // Store references
        this.scene.sprites.set(playerId, sprite);
        
        // Create trail graphics
        const trail = this.scene.add.graphics();
        this.scene.trails.set(playerId, trail);
        
        return playerId;
    }
    
    createEnemy(faction, x, y, initialVelocity = {x: 0, y: 0}) {
        const factionConfig = GameConfig.factions[faction];
        if (!factionConfig) return null;
        
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
        
        // Create sprite
        const sprite = this.scene.matter.add.sprite(x, y, `enemy-${faction}`);
        sprite.setCircle(25 * factionConfig.size);
        sprite.setMass(10 * factionConfig.size);
        sprite.setFriction(0);
        sprite.setFrictionAir(0);
        sprite.setBounce(0.7);
        sprite.setScale(factionConfig.size);
        sprite.setVelocity(initialVelocity.x, initialVelocity.y);
        
        // Store references
        this.scene.sprites.set(enemyId, sprite);
        this.scene.enemyGroup.add(sprite);
        
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
        
        // Floating animation
        this.scene.tweens.add({
            targets: sprite,
            y: y - 20,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Rotation
        this.scene.tweens.add({
            targets: sprite,
            rotation: Math.PI * 2,
            duration: 3000,
            repeat: -1
        });
        
        this.scene.sprites.set(powerupId, sprite);
        this.scene.powerupGroup.add(sprite);
        
        // Set up collision detection
        sprite.setOnCollide((pair) => {
            const { bodyA, bodyB } = pair;
            const playerSprite = this.scene.sprites.get(this.scene.player);
            if (playerSprite && (bodyA === playerSprite.body || bodyB === playerSprite.body)) {
                window.EventBus.emit(window.GameEvents.PICKUP_COLLECT, {
                    powerupId: powerupId,
                    type: type,
                    value: type === 'credits' ? 100 : 25
                });
            }
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
        
        // Add glow effect for charged shots
        if (isCharged) {
            sprite.setScale(1.5);
            this.scene.tweens.add({
                targets: sprite,
                scale: { from: 1.5, to: 1.8 },
                alpha: { from: 1, to: 0.8 },
                duration: 200,
                yoyo: true,
                repeat: -1
            });
        }
        
        // Add trail effect for player/charged projectiles
        if (isCharged || ownerEntity.type === 'player') {
            const trail = this.scene.add.graphics();
            this.scene.trails.set(projectileId, trail);
            
            this.entityManager.addComponent(projectileId, 'trail', 
                Components.trail(10, isCharged ? 0x00ffff : 0xffff00, 3)
            );
        }
        
        this.scene.sprites.set(projectileId, sprite);
        this.scene.projectileGroup.add(sprite);
        
        return projectileId;
    }
}

// Export for use
window.EntityFactory = EntityFactory;