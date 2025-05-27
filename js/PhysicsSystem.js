// PhysicsSystem.js - Handles all physics calculations including gravity, collision detection, and forces
// REFACTORED: Added centralized collision detection, removed direct sprite manipulation

class PhysicsSystem {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.playerId = null;
        this.gravityConstant = GameConfig.physics.gravity;
        this.spiralForce = GameConfig.physics.spiralForce;
        this.damping = GameConfig.physics.damping;
        this.maxVelocity = GameConfig.physics.maxVelocity;
        this.gravitationFalloff = GameConfig.physics.gravitationFalloff;
        
        // Performance optimization: spatial grid for collision detection
        this.spatialGrid = new SpatialGrid(GameConfig.world.width, GameConfig.world.height, 500);
        
        // Track applied forces
        this.pendingForces = new Map();
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
        
        // Listen for player creation
        this.eventBus.on('ENTITY_CREATED', (data) => {
            if (data.type === 'player') {
                this.playerId = data.id;
                console.log('[PhysicsSystem] Player ID set:', this.playerId);
            }
        });
        
        // Listen for force application requests
        this.eventBus.on('FORCE_APPLIED', (data) => {
            if (!this.pendingForces.has(data.entityId)) {
                this.pendingForces.set(data.entityId, { x: 0, y: 0 });
            }
            const forces = this.pendingForces.get(data.entityId);
            forces.x += data.force.x;
            forces.y += data.force.y;
        });
        
        // Listen for explosion force requests
        this.eventBus.on('CREATE_EXPLOSION_FORCE', (data) => {
            this.createExplosionForce(data.x, data.y, data.force, data.radius);
        });
        
        // Listen for titan shockwaves
        this.eventBus.on('TITAN_SHOCKWAVE', (data) => {
            this.createExplosionForce(data.x, data.y, 10, 200);
        });
    }
    
    update(deltaTime, entityManager) {
        // Get all physics entities
        const physicsEntities = entityManager.query('transform', 'physics');
        
        // Update spatial grid
        this.spatialGrid.clear();
        physicsEntities.forEach(entityId => {
            const transform = entityManager.getComponent(entityId, 'transform');
            if (transform) {
                this.spatialGrid.insert(entityId, transform.x, transform.y);
            }
        });
        
        // Apply forces
        this.applyGravitationalForces(physicsEntities, entityManager);
        this.applySpiralForce(physicsEntities, entityManager);
        this.applyPendingForces(physicsEntities, entityManager);
        
        // Update velocities and positions
        this.integratePhysics(physicsEntities, entityManager, deltaTime);
        
        // Detect collisions
        this.detectCollisions(entityManager);
        
        // Handle boundary wrapping
        this.handleBoundaries(physicsEntities, entityManager);
        
        // Clear pending forces
        this.pendingForces.clear();
    }
    
    applyGravitationalForces(entities, entityManager) {
        // Apply n-body gravity between all entities
        for (let i = 0; i < entities.length; i++) {
            const entityA = entities[i];
            const transformA = entityManager.getComponent(entityA, 'transform');
            const physicsA = entityManager.getComponent(entityA, 'physics');
            
            if (!transformA || !physicsA) continue;
            
            // Get nearby entities from spatial grid for optimization
            const nearbyEntities = this.spatialGrid.getNearby(
                transformA.x, 
                transformA.y, 
                2000 // Max gravity range
            );
            
            nearbyEntities.forEach(entityB => {
                if (entityA === entityB) return;
                
                const transformB = entityManager.getComponent(entityB, 'transform');
                const physicsB = entityManager.getComponent(entityB, 'physics');
                
                if (!transformB || !physicsB) return;
                
                // Calculate gravitational force
                const force = this.calculateGravitationalForce(
                    transformA, physicsA,
                    transformB, physicsB
                );
                
                if (force) {
                    // Apply force to acceleration
                    physicsA.acceleration.x += force.x / physicsA.mass;
                    physicsA.acceleration.y += force.y / physicsA.mass;
                }
            });
        }
    }
    
    calculateGravitationalForce(transformA, physicsA, transformB, physicsB) {
        // Calculate distance
        const dx = transformB.x - transformA.x;
        const dy = transformB.y - transformA.y;
        const distSq = dx * dx + dy * dy;
        
        // Skip if too close or too far
        if (distSq < 100 || distSq > 4000000) return null;
        
        const dist = Math.sqrt(distSq);
        
        // Calculate force magnitude using modified gravity formula
        // F = G * m1 * m2 / r^falloff
        const forceMagnitude = this.gravityConstant * physicsA.mass * physicsB.mass / 
                              Math.pow(dist, this.gravitationFalloff);
        
        // Reduce force when objects are close to prevent singularities
        let dampeningFactor = 1;
        if (dist < 200) {
            dampeningFactor = 0.5 + (dist / 200) * 0.5;
        }
        
        // Calculate force vector
        const forceX = (dx / dist) * forceMagnitude * dampeningFactor;
        const forceY = (dy / dist) * forceMagnitude * dampeningFactor;
        
        return { x: forceX, y: forceY };
    }
    
    applySpiralForce(entities, entityManager) {
        const centerX = GameConfig.world.centerX;
        const centerY = GameConfig.world.centerY;
        
        entities.forEach(entityId => {
            const transform = entityManager.getComponent(entityId, 'transform');
            const physics = entityManager.getComponent(entityId, 'physics');
            
            if (!transform || !physics) return;
            
            // Calculate distance from center
            const dx = transform.x - centerX;
            const dy = transform.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Apply spiral force if within range
            if (dist > 100 && dist < 8000) {
                // Calculate tangential force (perpendicular to radius)
                const angle = Math.atan2(dy, dx);
                const tangentX = -Math.sin(angle);
                const tangentY = Math.cos(angle);
                
                // Force decreases with distance
                const forceMagnitude = this.spiralForce * (1000 / dist) * physics.mass;
                
                physics.acceleration.x += tangentX * forceMagnitude;
                physics.acceleration.y += tangentY * forceMagnitude;
            }
        });
    }
    
    applyPendingForces(entities, entityManager) {
        entities.forEach(entityId => {
            const physics = entityManager.getComponent(entityId, 'physics');
            const forces = this.pendingForces.get(entityId);
            
            if (physics && forces) {
                physics.acceleration.x += forces.x;
                physics.acceleration.y += forces.y;
            }
        });
    }
    
    integratePhysics(entities, entityManager, deltaTime) {
        entities.forEach(entityId => {
            const transform = entityManager.getComponent(entityId, 'transform');
            const physics = entityManager.getComponent(entityId, 'physics');
            const sprite = this.scene.sprites.get(entityId);
            
            if (!transform || !physics || !sprite || !sprite.body) return;
            
            // For player entities, don't override velocity (let Matter.js handle it)
            if (entityManager.getEntity(entityId).type === 'player') {
                // Get current velocity from Matter.js body
                physics.velocity.x = sprite.body.velocity.x;
                physics.velocity.y = sprite.body.velocity.y;
            } else {
                // Update velocity from acceleration for non-player entities
                physics.velocity.x += physics.acceleration.x * deltaTime;
                physics.velocity.y += physics.acceleration.y * deltaTime;
                
                // Apply damping
                physics.velocity.x *= physics.damping;
                physics.velocity.y *= physics.damping;
                
                // Clamp to max velocity
                const speed = Math.sqrt(physics.velocity.x ** 2 + physics.velocity.y ** 2);
                if (speed > physics.maxSpeed) {
                    const scale = physics.maxSpeed / speed;
                    physics.velocity.x *= scale;
                    physics.velocity.y *= scale;
                }
                
                // Apply velocity to Matter.js body
                sprite.setVelocity(physics.velocity.x, physics.velocity.y);
            }
            
            // Reset acceleration for next frame
            physics.acceleration.x = 0;
            physics.acceleration.y = 0;
        });
    }
    
    detectCollisions(entityManager) {
        // Projectile collisions
        const projectiles = entityManager.getEntitiesByType('projectile');
        projectiles.forEach(projectileId => {
            const projectileSprite = this.scene.sprites.get(projectileId);
            if (!projectileSprite || !projectileSprite.active) return;
            
            const projectileTransform = entityManager.getComponent(projectileId, 'transform');
            if (!projectileTransform) return;
            
            // Get nearby entities for collision check
            const nearbyEntities = this.spatialGrid.getNearby(
                projectileTransform.x,
                projectileTransform.y,
                100 // Collision check radius
            );
            
            // Check against nearby entities
            nearbyEntities.forEach(targetId => {
                if (targetId === projectileId) return;
                
                const targetSprite = this.scene.sprites.get(targetId);
                if (!targetSprite || !targetSprite.active) return;
                
                if (this.checkCollision(projectileSprite, targetSprite)) {
                    this.eventBus.emit('COLLISION_DETECTED', {
                        entityA: projectileId,
                        entityB: targetId,
                        type: 'projectile'
                    });
                }
            });
        });
        
        // Powerup collisions with player
        const powerups = entityManager.getEntitiesByType('powerup');
        const playerSprite = this.scene.sprites.get(this.playerId);
        
        if (playerSprite && playerSprite.active) {
            powerups.forEach(powerupId => {
                const powerupSprite = this.scene.sprites.get(powerupId);
                
                if (powerupSprite && powerupSprite.active) {
                    if (this.checkCollision(playerSprite, powerupSprite)) {
                        this.eventBus.emit('COLLISION_DETECTED', {
                            entityA: this.playerId,
                            entityB: powerupId,
                            type: 'powerup'
                        });
                    }
                }
            });
        }
        
        // General entity collisions for physics responses
        const allEntities = entityManager.query('transform', 'physics');
        for (let i = 0; i < allEntities.length; i++) {
            const entityA = allEntities[i];
            const spriteA = this.scene.sprites.get(entityA);
            if (!spriteA || !spriteA.active) continue;
            
            const transformA = entityManager.getComponent(entityA, 'transform');
            const nearbyEntities = this.spatialGrid.getNearby(
                transformA.x,
                transformA.y,
                200
            );
            
            for (let j = 0; j < nearbyEntities.length; j++) {
                const entityB = nearbyEntities[j];
                if (entityA >= entityB) continue; // Avoid duplicate checks
                
                const spriteB = this.scene.sprites.get(entityB);
                if (!spriteB || !spriteB.active) continue;
                
                if (this.checkCollision(spriteA, spriteB)) {
                    this.eventBus.emit('COLLISION_DETECTED', {
                        entityA: entityA,
                        entityB: entityB,
                        type: 'physics'
                    });
                }
            }
        }
    }
    
    checkCollision(spriteA, spriteB) {
        // Use Matter.js collision detection
        return this.scene.matter.collision.collides(spriteA.body, spriteB.body);
    }
    
    handleBoundaries(entities, entityManager) {
        const bounds = {
            left: 0,
            right: GameConfig.world.width,
            top: 0,
            bottom: GameConfig.world.height
        };
        
        entities.forEach(entityId => {
            const transform = entityManager.getComponent(entityId, 'transform');
            const sprite = this.scene.sprites.get(entityId);
            
            if (!transform || !sprite) return;
            
            let wrapped = false;
            let newX = transform.x;
            let newY = transform.y;
            
            // Wrap horizontally
            if (transform.x < bounds.left - 100) {
                newX = bounds.right + 100;
                wrapped = true;
            } else if (transform.x > bounds.right + 100) {
                newX = bounds.left - 100;
                wrapped = true;
            }
            
            // Wrap vertically
            if (transform.y < bounds.top - 100) {
                newY = bounds.bottom + 100;
                wrapped = true;
            } else if (transform.y > bounds.bottom + 100) {
                newY = bounds.top - 100;
                wrapped = true;
            }
            
            if (wrapped) {
                sprite.setPosition(newX, newY);
                transform.x = newX;
                transform.y = newY;
                
                // Emit boundary wrap event
                this.eventBus.emit('BOUNDARY_WRAP', {
                    entityId: entityId,
                    position: { x: newX, y: newY }
                });
            }
        });
    }
    
    // Apply impulse to an entity
    applyImpulse(entityId, impulseX, impulseY) {
        const sprite = this.scene.sprites.get(entityId);
        
        if (sprite && sprite.body) {
            sprite.applyForce({ x: impulseX, y: impulseY });
        }
    }
    
    // Create explosion force
    createExplosionForce(x, y, force, radius) {
        const affectedEntities = this.spatialGrid.getNearby(x, y, radius);
        
        affectedEntities.forEach(entityId => {
            const transform = this.entityManager.getComponent(entityId, 'transform');
            const physics = this.entityManager.getComponent(entityId, 'physics');
            
            if (!transform || !physics) return;
            
            const dx = transform.x - x;
            const dy = transform.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < radius && dist > 0) {
                const forceMagnitude = force * (1 - dist / radius);
                const forceX = (dx / dist) * forceMagnitude;
                const forceY = (dy / dist) * forceMagnitude;
                
                this.applyImpulse(entityId, forceX, forceY);
            }
        });
    }
}

// Spatial grid for performance optimization
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = new Map();
    }
    
    clear() {
        this.grid.clear();
    }
    
    getKey(col, row) {
        return `${col},${row}`;
    }
    
    insert(entityId, x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        const key = this.getKey(col, row);
        
        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }
        
        this.grid.get(key).add(entityId);
    }
    
    getNearby(x, y, radius) {
        const nearby = new Set();
        const minCol = Math.floor((x - radius) / this.cellSize);
        const maxCol = Math.floor((x + radius) / this.cellSize);
        const minRow = Math.floor((y - radius) / this.cellSize);
        const maxRow = Math.floor((y + radius) / this.cellSize);
        
        for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
                const key = this.getKey(col, row);
                const cell = this.grid.get(key);
                
                if (cell) {
                    cell.forEach(entityId => nearby.add(entityId));
                }
            }
        }
        
        return Array.from(nearby);
    }
}

window.PhysicsSystem = PhysicsSystem;