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
        
        // Catastrophe wandering properties
        this.catastropheWanderAngle = Math.random() * Math.PI * 2;
        this.catastropheWanderSpeed = 150;  // Pixels per second
        this.catastropheWanderTurnRate = 5.0;  // Much more erratic movement
        this.catastropheId = null;
        
        // Immunity tracking
        this.vortexImmunity = new Map(); // entityId -> immunityEndTime
        this.vortexProximity = new Map(); // entityId -> timeNearVortex
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
        
        // Listen for entity creation
        this.eventBus.on('ENTITY_CREATED', (data) => {
            if (data.type === 'player') {
                this.playerId = data.id;
                //console.log('[PhysicsSystem] Player ID set:', this.playerId);
            } else if (data.type === 'catastrophe') {
                this.catastropheId = data.id;
                //console.log('[PhysicsSystem] Catastrophe ID set:', this.catastropheId);
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
        // Update wandering catastrophe
        this.updateWanderingCatastrophe(deltaTime, entityManager);
        
        // Update immunity timers
        this.updateImmunityTimers(deltaTime);
        
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
        this.applyCatastropheForces(physicsEntities, entityManager, deltaTime);
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
                10000 // Max gravity range for planets (2x increase)
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
        
        // Skip if too close
        if (distSq < 100) return null;
        
        // For planets (high mass), use much longer gravity range
        const maxRange = physicsB.mass > 100 ? 100000000 : 4000000; // 10000 or 2000 pixel range (2x increase)
        if (distSq > maxRange) return null;
        
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
        
        // Debug log planet gravity occasionally
        //if (physicsB.mass > 100 && Math.random() < 0.01) {
        //    //console.log(`[Gravity] Planet mass ${physicsB.mass} pulling entity at dist ${dist.toFixed(0)}: force ${forceMagnitude.toFixed(2)}`);
        //}
        
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
                
                // Debug log enemy forces
                const entity = entityManager.getEntity(entityId);
                if (entity && entity.type === 'enemy' && Math.random() < 0.01) {
                    //console.log(`[Physics] Enemy ${entityId} force: ${forces.x.toFixed(2)}, ${forces.y.toFixed(2)}`);
                }
            }
        });
    }
    
    integratePhysics(entities, entityManager, deltaTime) {
        entities.forEach(entityId => {
            const transform = entityManager.getComponent(entityId, 'transform');
            const physics = entityManager.getComponent(entityId, 'physics');
            const sprite = this.scene.sprites.get(entityId);
            
            if (!transform || !physics || !sprite || !sprite.body) return;
            
            // Update velocity from acceleration for all entities
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
            if (!projectileSprite || !projectileSprite.active || !projectileSprite.body) return;
            
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
            if (!spriteA || !spriteA.active || !spriteA.body) continue;
            
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
                if (!spriteB || !spriteB.active || !spriteB.body) continue;
                
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
        // Ensure both sprites have valid bodies before checking collision
        if (!spriteA || !spriteB || !spriteA.body || !spriteB.body) {
            return false;
        }
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
            const physics = entityManager.getComponent(entityId, 'physics');
            const sprite = this.scene.sprites.get(entityId);
            
            if (!transform || !sprite) return;
            
            let wrapped = false;
            let newX = transform.x;
            let newY = transform.y;
            
            // Check boundaries and apply rebound with velocity buildup
            const boundaryForce = 50;
            const buffer = 50;
            
            // Horizontal boundaries
            if (transform.x < bounds.left + buffer) {
                physics.velocity.x = Math.abs(physics.velocity.x);
                physics.acceleration.x = boundaryForce;
                newX = bounds.left + buffer;
                wrapped = true;
            } else if (transform.x > bounds.right - buffer) {
                physics.velocity.x = -Math.abs(physics.velocity.x);
                physics.acceleration.x = -boundaryForce;
                newX = bounds.right - buffer;
                wrapped = true;
            }
            
            // Vertical boundaries
            if (transform.y < bounds.top + buffer) {
                physics.velocity.y = Math.abs(physics.velocity.y);
                physics.acceleration.y = boundaryForce;
                newY = bounds.top + buffer;
                wrapped = true;
            } else if (transform.y > bounds.bottom - buffer) {
                physics.velocity.y = -Math.abs(physics.velocity.y);
                physics.acceleration.y = -boundaryForce;
                newY = bounds.bottom - buffer;
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
    
    updateWanderingCatastrophe(deltaTime, entityManager) {
        if (!this.catastropheId) return;
        
        const catastropheSprite = this.scene.sprites.get(this.catastropheId);
        if (!catastropheSprite || !catastropheSprite.body) return;
        
        const transform = entityManager.getComponent(this.catastropheId, 'transform');
        const catastropheData = entityManager.getComponent(this.catastropheId, 'catastrophe');
        if (!transform || !catastropheData) return;
        
        // Catastrophe is always active, no cooldown on the vortex itself
        catastropheSprite.setScale(3.0);
        
        // Update wander angle with random turns
        this.catastropheWanderAngle += (Math.random() - 0.5) * this.catastropheWanderTurnRate * deltaTime;
        
        // Calculate velocity (no deltaTime scaling needed for setVelocity)
        const vx = Math.cos(this.catastropheWanderAngle) * this.catastropheWanderSpeed;
        const vy = Math.sin(this.catastropheWanderAngle) * this.catastropheWanderSpeed;
        
        // Move the catastrophe
        catastropheSprite.setVelocity(vx, vy);
        
        // Keep it within bounds
        const buffer = 300;
        if (transform.x < buffer || transform.x > GameConfig.world.width - buffer) {
            this.catastropheWanderAngle = Math.PI - this.catastropheWanderAngle;
        }
        if (transform.y < buffer || transform.y > GameConfig.world.height - buffer) {
            this.catastropheWanderAngle = -this.catastropheWanderAngle;
        }
    }
    
    applyCatastropheForces(entities, entityManager, deltaTime) {
        if (!this.catastropheId) return;
        
        const catastropheTransform = entityManager.getComponent(this.catastropheId, 'transform');
        const catastropheData = entityManager.getComponent(this.catastropheId, 'catastrophe');
        
        if (!catastropheTransform || !catastropheData) return;
        
        const currentTime = Date.now();
        
        entities.forEach(entityId => {
            if (entityId === this.catastropheId) return;
            
            // Check immunity
            if (this.vortexImmunity.has(entityId)) {
                const immunityEnd = this.vortexImmunity.get(entityId);
                if (currentTime < immunityEnd) {
                    return; // Skip this entity, it's immune
                }
            }
            
            const transform = entityManager.getComponent(entityId, 'transform');
            const physics = entityManager.getComponent(entityId, 'physics');
            
            if (!transform || !physics) return;
            
            // Calculate distance from catastrophe
            const dx = transform.x - catastropheTransform.x;
            const dy = transform.y - catastropheTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Track proximity for immunity
            if (dist < catastropheData.radius) {
                const proximityTime = this.vortexProximity.get(entityId) || 0;
                const newProximityTime = proximityTime + (deltaTime * 1000);
                this.vortexProximity.set(entityId, newProximityTime);
                
                // Grant immunity after exposure
                if (newProximityTime >= catastropheData.immunityTriggerTime) {
                    this.vortexImmunity.set(entityId, currentTime + catastropheData.immunityDuration);
                    this.vortexProximity.delete(entityId);
                    //console.log(`[PhysicsSystem] Entity ${entityId} gained immunity from catastrophe`);
                    
                    // Apply strong ejection force to push entity away
                    const ejectForce = 800;
                    const ejectX = (dx / dist) * ejectForce;
                    const ejectY = (dy / dist) * ejectForce;
                    physics.velocity.x += ejectX / physics.mass;
                    physics.velocity.y += ejectY / physics.mass;
                    return;
                }
            } else {
                // Reset proximity timer if moved away
                this.vortexProximity.delete(entityId);
            }
            
            if (dist < catastropheData.pullRadius && dist > 50) {
                // Calculate pull force towards catastrophe center
                const pullStrength = catastropheData.strength * (1 - dist / catastropheData.pullRadius);
                const pullX = -(dx / dist) * pullStrength;
                const pullY = -(dy / dist) * pullStrength;
                
                // Add chaotic tangential force for spiral effect
                const angle = Math.atan2(dy, dx);
                const tangentX = -Math.sin(angle) * pullStrength * 0.8;
                const tangentY = Math.cos(angle) * pullStrength * 0.8;
                
                // Add random chaos
                const chaosX = (Math.random() - 0.5) * pullStrength * 0.3;
                const chaosY = (Math.random() - 0.5) * pullStrength * 0.3;
                
                // Apply combined forces
                physics.acceleration.x += (pullX + tangentX + chaosX) / physics.mass;
                physics.acceleration.y += (pullY + tangentY + chaosY) / physics.mass;
            }
        });
    }
    
    
    updateImmunityTimers(deltaTime) {
        const currentTime = Date.now();
        
        // Clean up expired immunities
        for (const [entityId, endTime] of this.vortexImmunity.entries()) {
            if (currentTime > endTime) {
                this.vortexImmunity.delete(entityId);
                //console.log(`[PhysicsSystem] Entity ${entityId} immunity expired`);
            }
        }
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