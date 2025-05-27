// AISystem.js - Modular AI behavior system with shared traits
// REFACTORED: Modular behaviors with trait composition

class AISystem {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.playerId = null;
        
        // AI configuration
        this.config = {
            detectionRange: 1200, // Max detection range for all AI
            shootingRange: 600,   // Max shooting range
            meleeRange: 200      // Close combat range
        };
        
        // Shared behavior traits
        this.traits = {};
        this.factionBehaviors = {};
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
        
        // Initialize shared trait behaviors
        this.traits = {
            targeting: new TargetingTrait(this.entityManager, this.config),
            shooting: new ShootingTrait(this.eventBus, this.entityManager, this.config),
            movement: new MovementTrait(this.entityManager),
            gravityAvoidance: new GravityAvoidanceTrait(this.entityManager),
            flocking: new FlockingTrait(this.entityManager),
            formation: new FormationTrait(this.entityManager)
        };
        
        // Initialize faction behaviors with trait composition
        this.factionBehaviors = {
            swarm: new SwarmBehavior(this.eventBus, this.entityManager, this.scene, this.traits),
            sentinel: new SentinelBehavior(this.eventBus, this.entityManager, this.scene, this.traits),
            phantom: new PhantomBehavior(this.eventBus, this.entityManager, this.scene, this.traits),
            titan: new TitanBehavior(this.eventBus, this.entityManager, this.scene, this.traits)
        };
        
        // Listen for player creation
        this.eventBus.on('ENTITY_CREATED', (data) => {
            if (data.type === 'player') {
                this.playerId = data.id;
                console.log('[AISystem] Player ID set:', this.playerId);
            }
        });
    }
    
    update(deltaTime, entityManager) {
        const aiEntities = entityManager.query('ai', 'transform', 'physics');
        
        // Let each faction behavior handle its entities
        const factionGroups = {};
        
        // Group entities by faction
        aiEntities.forEach(entityId => {
            const ai = entityManager.getComponent(entityId, 'ai');
            if (!ai) return;
            
            if (!factionGroups[ai.faction]) {
                factionGroups[ai.faction] = [];
            }
            factionGroups[ai.faction].push(entityId);
        });
        
        // Update each faction group
        Object.entries(factionGroups).forEach(([faction, entities]) => {
            if (this.factionBehaviors[faction]) {
                if (entities.length > 0 && Math.random() < 0.01) { // Log occasionally
                    console.log(`[AISystem] Updating ${faction} behavior for ${entities.length} entities`);
                }
                this.factionBehaviors[faction].updateGroup(entities, deltaTime, this.playerId);
            } else if (faction !== 'neutral' && faction !== 'player') {
                // Only warn for unexpected factions, not neutral or player
                console.warn(`[AISystem] No behavior found for faction: ${faction}`);
            }
        });
    }
}

// Shared AI Traits - Modular behaviors that can be composed

// Targeting trait - handles enemy and player detection
class TargetingTrait {
    constructor(entityManager, config) {
        this.entityManager = entityManager;
        this.config = config;
    }
    
    getDistance(transformA, transformB) {
        const dx = transformB.x - transformA.x;
        const dy = transformB.y - transformA.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    findTargets(entityId, transform, faction, maxRange = null) {
        const range = maxRange || this.config.detectionRange;
        const targets = [];
        
        // Check player
        const playerEntities = this.entityManager.getEntitiesByType('player');
        if (playerEntities.length > 0) {
            const playerId = playerEntities[0];
            const playerTransform = this.entityManager.getComponent(playerId, 'transform');
            if (playerTransform) {
                const dist = this.getDistance(transform, playerTransform);
                if (dist <= range) {
                    targets.push({
                        id: playerId,
                        transform: playerTransform,
                        distance: dist,
                        type: 'player',
                        priority: 1 // High priority
                    });
                }
            }
        }
        
        // Check enemy factions
        const enemies = this.entityManager.getEntitiesByType('enemy');
        enemies.forEach(enemyId => {
            if (enemyId === entityId) return;
            
            const enemyAI = this.entityManager.getComponent(enemyId, 'ai');
            const enemyTransform = this.entityManager.getComponent(enemyId, 'transform');
            
            if (!enemyAI || !enemyTransform || enemyAI.faction === faction) return;
            
            const dist = this.getDistance(transform, enemyTransform);
            if (dist <= range) {
                targets.push({
                    id: enemyId,
                    transform: enemyTransform,
                    distance: dist,
                    type: 'enemy',
                    faction: enemyAI.faction,
                    priority: 0.8 // Lower than player
                });
            }
        });
        
        // Sort by priority then distance
        targets.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return a.distance - b.distance;
        });
        
        return targets;
    }
    
    getNearestTarget(entityId, transform, faction, maxRange = null) {
        const targets = this.findTargets(entityId, transform, faction, maxRange);
        return targets.length > 0 ? targets[0] : null;
    }
}

// Shooting trait - handles weapon firing with prediction
class ShootingTrait {
    constructor(eventBus, entityManager, config) {
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.config = config;
    }
    
    canShoot(entityId, targetId, distance) {
        if (distance > this.config.shootingRange) return false;
        
        const weapon = this.entityManager.getComponent(entityId, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return false;
        
        return true;
    }
    
    aimAndShoot(shooterId, targetId, targetTransform, targetPhysics = null) {
        const shooterTransform = this.entityManager.getComponent(shooterId, 'transform');
        if (!shooterTransform) return;
        
        let aimX = targetTransform.x;
        let aimY = targetTransform.y;
        
        // Predict target movement if physics available
        if (targetPhysics) {
            const dist = Math.sqrt(
                Math.pow(targetTransform.x - shooterTransform.x, 2) +
                Math.pow(targetTransform.y - shooterTransform.y, 2)
            );
            const projectileSpeed = 15; // Approximate projectile speed
            const leadTime = dist / projectileSpeed;
            
            aimX += targetPhysics.velocity.x * leadTime;
            aimY += targetPhysics.velocity.y * leadTime;
        }
        
        const angle = Math.atan2(aimY - shooterTransform.y, aimX - shooterTransform.x);
        
        this.eventBus.emit('ENEMY_SHOOT_REQUEST', {
            shooterId: shooterId,
            angle: angle
        });
    }
}

// Movement trait - basic movement behaviors
class MovementTrait {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }
    
    applyForce(entityId, forceX, forceY) {
        const physics = this.entityManager.getComponent(entityId, 'physics');
        const sprite = this.scene?.sprites?.get(entityId);
        
        if (physics) {
            physics.velocity.x += forceX * 10;
            physics.velocity.y += forceY * 10;
            
            if (sprite && sprite.body) {
                sprite.setVelocity(physics.velocity.x, physics.velocity.y);
            }
        }
    }
    
    moveToward(transform, targetX, targetY, speed) {
        const dx = targetX - transform.x;
        const dy = targetY - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) return { x: 0, y: 0 };
        
        return {
            x: (dx / dist) * speed,
            y: (dy / dist) * speed
        };
    }
    
    orbit(transform, centerX, centerY, radius, angle, speed) {
        const targetX = centerX + Math.cos(angle) * radius;
        const targetY = centerY + Math.sin(angle) * radius;
        return this.moveToward(transform, targetX, targetY, speed);
    }
}

// Gravity avoidance trait
class GravityAvoidanceTrait {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }
    
    detectGravitySources(entityTransform) {
        const gravitySources = [];
        
        // Check planets
        const planets = this.entityManager.getEntitiesByType('planet');
        planets.forEach(planetId => {
            const planetTransform = this.entityManager.getComponent(planetId, 'transform');
            const planetPhysics = this.entityManager.getComponent(planetId, 'physics');
            
            if (!planetTransform || !planetPhysics) return;
            
            const dx = planetTransform.x - entityTransform.x;
            const dy = planetTransform.y - entityTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const gravityRange = planetPhysics.radius * 8;
            
            if (dist < gravityRange * 1.5) {
                gravitySources.push({
                    type: 'planet',
                    transform: planetTransform,
                    distance: dist,
                    gravityStrength: planetPhysics.mass / 600,
                    gravityRadius: gravityRange,
                    radius: planetPhysics.radius
                });
            }
        });
        
        // Check vortexes
        const vortexes = this.entityManager.query('catastrophe', 'transform');
        vortexes.forEach(vortexId => {
            const vortexTransform = this.entityManager.getComponent(vortexId, 'transform');
            const catastrophe = this.entityManager.getComponent(vortexId, 'catastrophe');
            
            if (!vortexTransform || !catastrophe) return;
            
            const dx = vortexTransform.x - entityTransform.x;
            const dy = vortexTransform.y - entityTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const pullRadius = catastrophe.pullRadius || 2000;
            
            if (dist < pullRadius * 1.5) {
                gravitySources.push({
                    type: 'vortex',
                    transform: vortexTransform,
                    distance: dist,
                    pullStrength: catastrophe.strength || 400,
                    pullRadius: pullRadius,
                    eventHorizon: catastrophe.radius || 300
                });
            }
        });
        
        return gravitySources;
    }
    
    calculateAvoidance(entityTransform, gravitySources) {
        let avoidX = 0, avoidY = 0;
        
        gravitySources.forEach(source => {
            const dx = entityTransform.x - source.transform.x;
            const dy = entityTransform.y - source.transform.y;
            const dist = source.distance;
            
            if (dist === 0) return;
            
            let avoidanceStrength = 0;
            
            if (source.type === 'planet') {
                const dangerZone = source.radius + 150;
                if (dist < dangerZone) {
                    avoidanceStrength = 0.2;
                } else if (dist < source.gravityRadius) {
                    const normalizedDist = (dist - dangerZone) / (source.gravityRadius - dangerZone);
                    avoidanceStrength = 0.1 * (1 - normalizedDist) * source.gravityStrength;
                }
            } else if (source.type === 'vortex') {
                if (dist < source.eventHorizon + 150) {
                    avoidanceStrength = 0.3;
                } else if (dist < source.pullRadius) {
                    const normalizedDist = (dist - source.eventHorizon) / (source.pullRadius - source.eventHorizon);
                    const exponentialFactor = Math.pow(1 - normalizedDist, 2);
                    avoidanceStrength = 0.15 * exponentialFactor * (source.pullStrength / 400);
                }
            }
            
            if (avoidanceStrength > 0) {
                avoidX += (dx / dist) * avoidanceStrength;
                avoidY += (dy / dist) * avoidanceStrength;
            }
        });
        
        return { x: avoidX, y: avoidY };
    }
}

// Flocking trait for swarm behaviors
class FlockingTrait {
    constructor(entityManager) {
        this.entityManager = entityManager;
        this.params = {
            separationRadius: 60,
            alignmentRadius: 120,
            cohesionRadius: 150,
            separationForce: 0.25,
            alignmentForce: 0.05,
            cohesionForce: 0.1
        };
    }
    
    calculateFlocking(entityId, transform, physics, neighbors) {
        let forceX = 0, forceY = 0;
        let neighborCount = 0;
        let avgVelX = 0, avgVelY = 0;
        let cohesionX = 0, cohesionY = 0;
        
        neighbors.forEach(otherId => {
            if (otherId === entityId) return;
            
            const otherTransform = this.entityManager.getComponent(otherId, 'transform');
            const otherPhysics = this.entityManager.getComponent(otherId, 'physics');
            
            if (!otherTransform || !otherPhysics) return;
            
            const dx = otherTransform.x - transform.x;
            const dy = otherTransform.y - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist === 0) return;
            
            // Separation
            if (dist < this.params.separationRadius) {
                forceX -= (dx / dist) * this.params.separationForce / dist;
                forceY -= (dy / dist) * this.params.separationForce / dist;
            }
            
            // Alignment & Cohesion
            if (dist < this.params.alignmentRadius) {
                avgVelX += otherPhysics.velocity.x;
                avgVelY += otherPhysics.velocity.y;
                cohesionX += otherTransform.x;
                cohesionY += otherTransform.y;
                neighborCount++;
            }
        });
        
        if (neighborCount > 0) {
            // Alignment
            avgVelX /= neighborCount;
            avgVelY /= neighborCount;
            forceX += (avgVelX - physics.velocity.x) * this.params.alignmentForce;
            forceY += (avgVelY - physics.velocity.y) * this.params.alignmentForce;
            
            // Cohesion
            cohesionX /= neighborCount;
            cohesionY /= neighborCount;
            const cohDx = cohesionX - transform.x;
            const cohDy = cohesionY - transform.y;
            forceX += cohDx * this.params.cohesionForce * 0.001;
            forceY += cohDy * this.params.cohesionForce * 0.001;
        }
        
        return { x: forceX, y: forceY };
    }
}

// Formation trait for organized movement
class FormationTrait {
    constructor(entityManager) {
        this.entityManager = entityManager;
    }
    
    assignFormationPositions(entities, formationType = 'circle') {
        const positions = new Map();
        
        if (formationType === 'circle') {
            const radius = 150 + entities.length * 20;
            entities.forEach((entityId, index) => {
                const angle = (index / entities.length) * Math.PI * 2;
                positions.set(entityId, {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius
                });
            });
        } else if (formationType === 'line') {
            const spacing = 150;
            entities.forEach((entityId, index) => {
                positions.set(entityId, {
                    x: index * spacing - (entities.length - 1) * spacing / 2,
                    y: 0
                });
            });
        }
        
        return positions;
    }
}

// Base behavior class
class BaseBehavior {
    constructor(eventBus, entityManager, scene, traits) {
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.scene = scene;
        this.traits = traits; // Shared trait behaviors
    }
    
    applyForce(entityId, forceX, forceY) {
        const physics = this.entityManager.getComponent(entityId, 'physics');
        const sprite = this.scene.sprites.get(entityId);
        
        if (physics && sprite && sprite.body) {
            physics.velocity.x += forceX * 10;
            physics.velocity.y += forceY * 10;
            sprite.setVelocity(physics.velocity.x, physics.velocity.y);
        }
    }
}

// Swarm behavior - chaotic bee-like attacks
class SwarmBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene) {
        super(eventBus, entityManager, scene);
        this.boidParams = {
            separationRadius: 60,
            alignmentRadius: 120,
            cohesionRadius: 150,
            separationForce: 0.25,
            alignmentForce: 0.05,
            cohesionForce: 0.1,
            attackForce: 0.04,
            chaosForce: 0.15
        };
    }
    
    updateGroup(entities, deltaTime, playerId) {
        // Calculate center of swarm
        let centerX = 0, centerY = 0;
        let count = 0;
        
        entities.forEach(entityId => {
            const transform = this.entityManager.getComponent(entityId, 'transform');
            if (transform) {
                centerX += transform.x;
                centerY += transform.y;
                count++;
            }
        });
        
        if (count > 0) {
            centerX /= count;
            centerY /= count;
        }
        
        // Find target for swarm
        let swarmTarget = null;
        const player = this.findPlayer();
        if (player) {
            const playerDist = Math.sqrt(
                Math.pow(player.transform.x - centerX, 2) + 
                Math.pow(player.transform.y - centerY, 2)
            );
            if (playerDist < 1200) {
                swarmTarget = player;
            }
        }
        
        // Look for other enemies too
        if (!swarmTarget) {
            let closestEnemy = null;
            let closestDist = Infinity;
            
            entities.forEach(entityId => {
                const transform = this.entityManager.getComponent(entityId, 'transform');
                if (!transform) return;
                
                const enemy = this.findNearestEnemy(entityId, transform, 'swarm');
                if (enemy && enemy.distance < closestDist) {
                    closestEnemy = enemy;
                    closestDist = enemy.distance;
                }
            });
            
            if (closestEnemy && closestDist < 800) {
                swarmTarget = { id: closestEnemy.id, transform: closestEnemy.transform };
            }
        }
        
        // Update each entity
        entities.forEach(entityId => {
            this.updateEntity(entityId, entities, swarmTarget, deltaTime);
        });
    }
    
    updateEntity(entityId, swarmmates, swarmTarget, deltaTime) {
        const ai = this.entityManager.getComponent(entityId, 'ai');
        const transform = this.entityManager.getComponent(entityId, 'transform');
        const physics = this.entityManager.getComponent(entityId, 'physics');
        
        if (!ai || !transform || !physics) return;
        
        // Initialize swarm memory
        if (!ai.memory.swarmPhase) {
            ai.memory.swarmPhase = 'circling';
            ai.memory.diveTimer = Math.random() * 2000;
            ai.memory.chaosAngle = Math.random() * Math.PI * 2;
            ai.memory.chaosSpeed = 0.002 + Math.random() * 0.004;
            ai.memory.orbitAngle = Math.random() * Math.PI * 2;
            ai.memory.orbitDirection = Math.random() > 0.5 ? 1 : -1;
        }
        
        // Update timers
        ai.memory.diveTimer -= deltaTime * 1000;
        ai.memory.chaosAngle += ai.memory.chaosSpeed * deltaTime * 1000;
        
        // Update AI state
        ai.decisionTimer -= deltaTime * 1000;
        if (ai.decisionTimer <= 0) {
            ai.decisionTimer = 300; // Very fast reactions
            ai.aggressionLevel = 0.95;
            ai.fearLevel = 0.05;
            
            // Decide on swarm phase
            if (swarmTarget) {
                const targetDist = this.getDistance(transform, swarmTarget.transform);
                
                if (ai.memory.swarmPhase === 'circling' && ai.memory.diveTimer <= 0) {
                    // Start diving
                    ai.memory.swarmPhase = 'diving';
                    ai.memory.diveTimer = 1500 + Math.random() * 1000;
                    ai.memory.diveTarget = { 
                        x: swarmTarget.transform.x + (Math.random() - 0.5) * 100,
                        y: swarmTarget.transform.y + (Math.random() - 0.5) * 100
                    };
                } else if (ai.memory.swarmPhase === 'diving' && (ai.memory.diveTimer <= 0 || targetDist < 100)) {
                    // Buzz around target
                    ai.memory.swarmPhase = 'buzzing';
                    ai.memory.diveTimer = 2000 + Math.random() * 1000;
                } else if (ai.memory.swarmPhase === 'buzzing' && ai.memory.diveTimer <= 0) {
                    // Return to circling
                    ai.memory.swarmPhase = 'circling';
                    ai.memory.diveTimer = 1000 + Math.random() * 2000;
                    ai.memory.orbitDirection *= -1; // Change orbit direction
                }
            }
        }
        
        // Calculate boid forces with chaos
        let forceX = 0, forceY = 0;
        let neighborCount = 0;
        let avgVelX = 0, avgVelY = 0;
        let cohesionX = 0, cohesionY = 0;
        
        swarmmates.forEach(otherId => {
            if (otherId === entityId) return;
            
            const otherTransform = this.entityManager.getComponent(otherId, 'transform');
            const otherPhysics = this.entityManager.getComponent(otherId, 'physics');
            
            if (!otherTransform || !otherPhysics) return;
            
            const dx = otherTransform.x - transform.x;
            const dy = otherTransform.y - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist === 0) return;
            
            // Separation - stronger to avoid collisions during chaotic movement
            if (dist < this.boidParams.separationRadius) {
                forceX -= (dx / dist) * this.boidParams.separationForce / dist;
                forceY -= (dy / dist) * this.boidParams.separationForce / dist;
            }
            
            // Weak alignment for more chaos
            if (dist < this.boidParams.alignmentRadius) {
                avgVelX += otherPhysics.velocity.x;
                avgVelY += otherPhysics.velocity.y;
                cohesionX += otherTransform.x;
                cohesionY += otherTransform.y;
                neighborCount++;
            }
        });
        
        if (neighborCount > 0) {
            // Very weak alignment - we want chaos
            avgVelX /= neighborCount;
            avgVelY /= neighborCount;
            forceX += (avgVelX - physics.velocity.x) * this.boidParams.alignmentForce;
            forceY += (avgVelY - physics.velocity.y) * this.boidParams.alignmentForce;
            
            // Weak cohesion
            cohesionX /= neighborCount;
            cohesionY /= neighborCount;
            const cohDx = cohesionX - transform.x;
            const cohDy = cohesionY - transform.y;
            forceX += cohDx * this.boidParams.cohesionForce * 0.001;
            forceY += cohDy * this.boidParams.cohesionForce * 0.001;
        }
        
        // Add chaos movement
        const chaosX = Math.cos(ai.memory.chaosAngle) * this.boidParams.chaosForce;
        const chaosY = Math.sin(ai.memory.chaosAngle) * this.boidParams.chaosForce;
        
        // Execute phase-based behavior
        if (swarmTarget) {
            const dx = swarmTarget.transform.x - transform.x;
            const dy = swarmTarget.transform.y - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            switch (ai.memory.swarmPhase) {
                case 'circling':
                    // Orbit around target with chaos
                    ai.memory.orbitAngle += 0.003 * ai.memory.orbitDirection;
                    const orbitRadius = 300 + Math.sin(ai.memory.chaosAngle * 0.5) * 100;
                    const orbitX = swarmTarget.transform.x + Math.cos(ai.memory.orbitAngle) * orbitRadius;
                    const orbitY = swarmTarget.transform.y + Math.sin(ai.memory.orbitAngle) * orbitRadius;
                    
                    const toOrbitX = orbitX - transform.x;
                    const toOrbitY = orbitY - transform.y;
                    const toOrbitDist = Math.sqrt(toOrbitX * toOrbitX + toOrbitY * toOrbitY);
                    
                    if (toOrbitDist > 0) {
                        forceX += (toOrbitX / toOrbitDist) * 0.02 + chaosX;
                        forceY += (toOrbitY / toOrbitDist) * 0.02 + chaosY;
                    }
                    break;
                    
                case 'diving':
                    // Aggressive dive toward target
                    if (ai.memory.diveTarget) {
                        const diveDx = ai.memory.diveTarget.x - transform.x;
                        const diveDy = ai.memory.diveTarget.y - transform.y;
                        const diveDist = Math.sqrt(diveDx * diveDx + diveDy * diveDy);
                        
                        if (diveDist > 0) {
                            forceX += (diveDx / diveDist) * this.boidParams.attackForce * 2;
                            forceY += (diveDy / diveDist) * this.boidParams.attackForce * 2;
                        }
                    }
                    break;
                    
                case 'buzzing':
                    // Chaotic movement around target
                    if (dist > 150) {
                        // Get closer if too far
                        forceX += (dx / dist) * this.boidParams.attackForce;
                        forceY += (dy / dist) * this.boidParams.attackForce;
                    } else if (dist < 80) {
                        // Back away if too close
                        forceX -= (dx / dist) * this.boidParams.attackForce;
                        forceY -= (dy / dist) * this.boidParams.attackForce;
                    }
                    
                    // Add strong chaos when buzzing
                    forceX += chaosX * 3;
                    forceY += chaosY * 3;
                    break;
            }
            
            // Shoot frantically when close
            if (dist < 400 && (ai.memory.swarmPhase === 'diving' || ai.memory.swarmPhase === 'buzzing')) {
                const weapon = this.entityManager.getComponent(entityId, 'weapon');
                if (weapon && weapon.lastFireTime <= 0 && Math.random() < 0.1) {
                    // Inaccurate shooting with spread
                    const spread = (Math.random() - 0.5) * 0.3;
                    const angle = Math.atan2(dy, dx) + spread;
                    this.requestShoot(entityId, angle);
                }
            }
        } else {
            // No target - chaotic wandering
            forceX += chaosX * 2;
            forceY += chaosY * 2;
        }
        
        // Detect and avoid gravity sources
        const gravitySources = this.detectGravitySources(transform);
        const gravityAvoidance = this.calculateGravityAvoidance(transform, gravitySources);
        
        // Apply gravity avoidance with higher priority for swarm
        forceX += gravityAvoidance.x * 1.5; // Swarm is more responsive to gravity
        forceY += gravityAvoidance.y * 1.5;
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update speed based on phase
        switch (ai.memory.swarmPhase) {
            case 'diving':
                physics.maxSpeed = 12;
                physics.damping = 0.99;
                break;
            case 'buzzing':
                physics.maxSpeed = 10;
                physics.damping = 0.96;
                break;
            default:
                physics.maxSpeed = 8;
                physics.damping = 0.98;
        }
    }
}

// Sentinel behavior - defensive and tactical with orbiting mechanics
class SentinelBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene) {
        super(eventBus, entityManager, scene);
        this.formations = new Map(); // Track formations
        this.groupLeaders = new Map(); // Track group leaders
    }
    
    updateGroup(entities, deltaTime, playerId) {
        // Form groups based on proximity
        const groups = this.formGroups(entities);
        
        // Update each group
        groups.forEach((groupMembers, leaderId) => {
            this.updateGroupFormation(leaderId, groupMembers, deltaTime);
        });
        
        // Update individual entities
        entities.forEach(entityId => {
            this.updateEntity(entityId, entities, deltaTime);
        });
    }
    
    formGroups(entities) {
        const groups = new Map();
        const assigned = new Set();
        
        entities.forEach(entityId => {
            if (assigned.has(entityId)) return;
            
            const transform = this.entityManager.getComponent(entityId, 'transform');
            if (!transform) return;
            
            // Find nearby sentinels
            const group = [entityId];
            assigned.add(entityId);
            
            entities.forEach(otherId => {
                if (otherId === entityId || assigned.has(otherId)) return;
                
                const otherTransform = this.entityManager.getComponent(otherId, 'transform');
                if (!otherTransform) return;
                
                const dist = this.getDistance(transform, otherTransform);
                if (dist < 400) { // Group radius
                    group.push(otherId);
                    assigned.add(otherId);
                }
            });
            
            if (group.length > 1) {
                groups.set(entityId, group);
            }
        });
        
        return groups;
    }
    
    updateGroupFormation(leaderId, groupMembers, deltaTime) {
        if (groupMembers.length < 2) return;
        
        const leaderTransform = this.entityManager.getComponent(leaderId, 'transform');
        if (!leaderTransform) return;
        
        // Assign formation positions
        groupMembers.forEach((memberId, index) => {
            if (memberId === leaderId) return;
            
            const ai = this.entityManager.getComponent(memberId, 'ai');
            if (!ai) return;
            
            // Circle formation around leader
            const angle = (index / (groupMembers.length - 1)) * Math.PI * 2;
            const radius = 150 + (groupMembers.length * 20);
            
            ai.memory.formationPosition = {
                x: leaderTransform.x + Math.cos(angle) * radius,
                y: leaderTransform.y + Math.sin(angle) * radius
            };
            ai.memory.formationLeader = leaderId;
        });
    }
    
    updateEntity(entityId, allies, deltaTime) {
        const ai = this.entityManager.getComponent(entityId, 'ai');
        const transform = this.entityManager.getComponent(entityId, 'transform');
        const physics = this.entityManager.getComponent(entityId, 'physics');
        
        if (!ai || !transform || !physics) return;
        
        // Initialize memory
        if (!ai.memory.guardPoint) {
            ai.memory.guardPoint = { x: transform.x, y: transform.y };
            ai.memory.orbitRadius = 400;
            ai.memory.orbitAngle = Math.random() * Math.PI * 2;
            ai.memory.orbitSpeed = 0.001 + Math.random() * 0.001;
            ai.memory.preferredDistance = 350 + Math.random() * 100;
        }
        
        // Update AI state
        ai.decisionTimer -= deltaTime * 1000;
        if (ai.decisionTimer <= 0) {
            ai.decisionTimer = 1000; // Thoughtful decisions
            ai.aggressionLevel = 0.4;
            ai.fearLevel = 0.3;
            
            // Look for threats
            const threat = this.findNearestEnemy(entityId, transform, 'sentinel');
            const player = this.findPlayer();
            
            if (threat && threat.distance < 800) {
                ai.state = 'orbiting';
                ai.target = threat.id;
                
                // Call for backup if overwhelmed
                if (threat.distance < 300 && !ai.memory.calledBackup) {
                    ai.memory.calledBackup = true;
                    this.callForBackup(entityId, transform, allies);
                }
            } else if (player && this.getDistance(transform, player.transform) < 700) {
                ai.state = 'orbiting';
                ai.target = player.id;
            } else if (ai.memory.backupTarget) {
                ai.state = 'responding';
            } else {
                ai.state = 'patrolling';
                ai.target = null;
                ai.memory.calledBackup = false;
            }
        }
        
        // Execute behavior
        let forceX = 0, forceY = 0;
        
        switch (ai.state) {
            case 'orbiting':
                if (ai.target) {
                    const target = this.entityManager.getComponent(ai.target, 'transform');
                    if (target) {
                        const dx = target.x - transform.x;
                        const dy = target.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        // Update orbit angle
                        ai.memory.orbitAngle += ai.memory.orbitSpeed * deltaTime * 1000;
                        
                        // Calculate desired orbit position
                        const orbitX = target.x + Math.cos(ai.memory.orbitAngle) * ai.memory.preferredDistance;
                        const orbitY = target.y + Math.sin(ai.memory.orbitAngle) * ai.memory.preferredDistance;
                        
                        // Move towards orbit position
                        const toOrbitX = orbitX - transform.x;
                        const toOrbitY = orbitY - transform.y;
                        const toOrbitDist = Math.sqrt(toOrbitX * toOrbitX + toOrbitY * toOrbitY);
                        
                        if (toOrbitDist > 20) {
                            forceX += (toOrbitX / toOrbitDist) * 0.01;
                            forceY += (toOrbitY / toOrbitDist) * 0.01;
                        }
                        
                        // Maintain distance while orbiting
                        if (dist < ai.memory.preferredDistance - 50) {
                            // Too close - back away
                            forceX -= (dx / dist) * 0.008;
                            forceY -= (dy / dist) * 0.008;
                        } else if (dist > ai.memory.preferredDistance + 50) {
                            // Too far - move closer
                            forceX += (dx / dist) * 0.006;
                            forceY += (dy / dist) * 0.006;
                        }
                        
                        // Coordinated shooting with prediction
                        const weapon = this.entityManager.getComponent(entityId, 'weapon');
                        if (weapon && weapon.lastFireTime <= 0 && dist < 600) {
                            // Predict target movement
                            const targetPhysics = this.entityManager.getComponent(ai.target, 'physics');
                            if (targetPhysics) {
                                const leadTime = dist / 15; // Projectile speed estimate
                                const predictX = target.x + targetPhysics.velocity.x * leadTime;
                                const predictY = target.y + targetPhysics.velocity.y * leadTime;
                                const angle = Math.atan2(predictY - transform.y, predictX - transform.x);
                                
                                // Fire in coordinated bursts with nearby sentinels
                                let shouldFire = true;
                                allies.forEach(allyId => {
                                    if (allyId === entityId) return;
                                    const allyAI = this.entityManager.getComponent(allyId, 'ai');
                                    const allyWeapon = this.entityManager.getComponent(allyId, 'weapon');
                                    if (allyAI && allyWeapon && allyAI.target === ai.target) {
                                        // Stagger shots
                                        if (allyWeapon.lastFireTime > -100 && allyWeapon.lastFireTime < 100) {
                                            shouldFire = false;
                                        }
                                    }
                                });
                                
                                if (shouldFire) {
                                    this.requestShoot(entityId, angle);
                                }
                            }
                        }
                    }
                }
                break;
                
            case 'responding':
                // Move to backup location
                if (ai.memory.backupTarget) {
                    const dx = ai.memory.backupTarget.x - transform.x;
                    const dy = ai.memory.backupTarget.y - transform.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 100) {
                        forceX += (dx / dist) * 0.012;
                        forceY += (dy / dist) * 0.012;
                    } else {
                        // Arrived at backup location
                        ai.memory.backupTarget = null;
                        ai.state = 'orbiting';
                    }
                }
                break;
                
            case 'patrolling':
                // Follow formation or patrol
                if (ai.memory.formationPosition && ai.memory.formationLeader) {
                    // Move to formation position
                    const dx = ai.memory.formationPosition.x - transform.x;
                    const dy = ai.memory.formationPosition.y - transform.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 30) {
                        forceX += (dx / dist) * 0.008;
                        forceY += (dy / dist) * 0.008;
                    }
                } else {
                    // Solo patrol
                    ai.memory.orbitAngle += 0.0005;
                    const patrolX = ai.memory.guardPoint.x + Math.cos(ai.memory.orbitAngle) * ai.memory.orbitRadius;
                    const patrolY = ai.memory.guardPoint.y + Math.sin(ai.memory.orbitAngle) * ai.memory.orbitRadius;
                    
                    const dx = patrolX - transform.x;
                    const dy = patrolY - transform.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 50) {
                        forceX += (dx / dist) * 0.005;
                        forceY += (dy / dist) * 0.005;
                    }
                }
                break;
        }
        
        // Avoid other sentinels to prevent bunching
        allies.forEach(allyId => {
            if (allyId === entityId) return;
            
            const allyTransform = this.entityManager.getComponent(allyId, 'transform');
            if (!allyTransform) return;
            
            const dist = this.getDistance(transform, allyTransform);
            if (dist < 150 && dist > 0) {
                // Repel from allies that are too close
                const dx = transform.x - allyTransform.x;
                const dy = transform.y - allyTransform.y;
                forceX += (dx / dist) * 0.006 / dist;
                forceY += (dy / dist) * 0.006 / dist;
            }
        });
        
        // Detect and avoid gravity sources
        const gravitySources = this.detectGravitySources(transform);
        const gravityAvoidance = this.calculateGravityAvoidance(transform, gravitySources);
        
        // Apply gravity avoidance - Sentinels are smart about avoiding gravity
        forceX += gravityAvoidance.x;
        forceY += gravityAvoidance.y;
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics
        physics.maxSpeed = ai.state === 'responding' ? 7 : 5;
        physics.damping = 0.995;
    }
    
    callForBackup(callerId, callerTransform, allies) {
        // Alert nearby allies
        allies.forEach(allyId => {
            if (allyId === callerId) return;
            
            const allyTransform = this.entityManager.getComponent(allyId, 'transform');
            const allyAI = this.entityManager.getComponent(allyId, 'ai');
            
            if (!allyTransform || !allyAI) return;
            
            const dist = this.getDistance(callerTransform, allyTransform);
            if (dist < 1000) {
                // Alert ally with urgency based on distance
                allyAI.state = 'responding';
                allyAI.memory.backupTarget = { x: callerTransform.x, y: callerTransform.y };
                allyAI.decisionTimer = 0; // Immediate response
            }
        });
    }
}

// Phantom behavior - hit and run tactics with dash/dodge mechanics
class PhantomBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene) {
        super(eventBus, entityManager, scene);
    }
    
    updateGroup(entities, deltaTime, playerId) {
        entities.forEach(entityId => {
            this.updateEntity(entityId, entities, deltaTime);
        });
    }
    
    updateEntity(entityId, allies, deltaTime) {
        const ai = this.entityManager.getComponent(entityId, 'ai');
        const transform = this.entityManager.getComponent(entityId, 'transform');
        const physics = this.entityManager.getComponent(entityId, 'physics');
        
        if (!ai || !transform || !physics) return;
        
        // Initialize memory
        if (!ai.memory.attackTimer) {
            ai.memory.attackTimer = 0;
            ai.memory.retreatTimer = 0;
            ai.memory.phaseTimer = 0;
            ai.memory.isPhased = false;
            ai.memory.dashCooldown = 0;
            ai.memory.dashDirection = null;
            ai.memory.isDashing = false;
            ai.memory.lastEnemyPositions = new Map();
        }
        
        // Update timers
        ai.memory.attackTimer -= deltaTime * 1000;
        ai.memory.retreatTimer -= deltaTime * 1000;
        ai.memory.phaseTimer -= deltaTime * 1000;
        ai.memory.dashCooldown -= deltaTime * 1000;
        
        // Dash/dodge mechanics every 0.5 seconds
        if (ai.memory.dashCooldown <= 0 && !ai.memory.isDashing) {
            ai.memory.dashCooldown = 500; // 0.5 second cooldown
            
            // Decide dash direction based on threats
            let dashX = 0, dashY = 0;
            let shouldDash = false;
            
            // Check for incoming projectiles
            const projectiles = this.entityManager.getEntitiesByType('projectile');
            projectiles.forEach(projId => {
                const projTransform = this.entityManager.getComponent(projId, 'transform');
                const projPhysics = this.entityManager.getComponent(projId, 'physics');
                const projWeapon = this.entityManager.getComponent(projId, 'weapon');
                
                if (!projTransform || !projPhysics || !projWeapon) return;
                if (projWeapon.ownerId === entityId) return; // Don't dodge own projectiles
                
                const dist = this.getDistance(transform, projTransform);
                if (dist < 200) {
                    // Calculate dodge direction perpendicular to projectile path
                    const perpX = -projPhysics.velocity.y;
                    const perpY = projPhysics.velocity.x;
                    const len = Math.sqrt(perpX * perpX + perpY * perpY);
                    if (len > 0) {
                        dashX += perpX / len;
                        dashY += perpY / len;
                        shouldDash = true;
                    }
                }
            });
            
            // Dash to get around enemies or dodge their attacks
            if (ai.target && !shouldDash) {
                const target = this.entityManager.getComponent(ai.target, 'transform');
                const targetPhysics = this.entityManager.getComponent(ai.target, 'physics');
                
                if (target) {
                    const dist = this.getDistance(transform, target);
                    
                    // Track enemy movement for prediction
                    const lastPos = ai.memory.lastEnemyPositions.get(ai.target);
                    if (lastPos) {
                        const enemyVelX = target.x - lastPos.x;
                        const enemyVelY = target.y - lastPos.y;
                        
                        // Dash to flank or dodge predicted attacks
                        if (dist < 400 && dist > 150) {
                            // Flank dash - circle around enemy
                            const angle = Math.atan2(target.y - transform.y, target.x - transform.x);
                            const flankAngle = angle + (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2);
                            dashX = Math.cos(flankAngle);
                            dashY = Math.sin(flankAngle);
                            shouldDash = true;
                        } else if (dist < 150) {
                            // Escape dash - away from enemy
                            const angle = Math.atan2(transform.y - target.y, transform.x - target.x);
                            dashX = Math.cos(angle);
                            dashY = Math.sin(angle);
                            shouldDash = true;
                        }
                    }
                    
                    // Update position tracking
                    ai.memory.lastEnemyPositions.set(ai.target, { x: target.x, y: target.y });
                }
            }
            
            // Execute dash
            if (shouldDash) {
                const dashLen = Math.sqrt(dashX * dashX + dashY * dashY);
                if (dashLen > 0) {
                    ai.memory.dashDirection = {
                        x: dashX / dashLen,
                        y: dashY / dashLen
                    };
                    ai.memory.isDashing = true;
                    ai.memory.dashTimer = 150; // 150ms dash duration
                    
                    // Visual effect for dash
                    this.eventBus.emit('PHANTOM_DASH', {
                        entityId: entityId,
                        x: transform.x,
                        y: transform.y,
                        direction: ai.memory.dashDirection
                    });
                }
            }
        }
        
        // Update dash state
        if (ai.memory.isDashing) {
            ai.memory.dashTimer -= deltaTime * 1000;
            if (ai.memory.dashTimer <= 0) {
                ai.memory.isDashing = false;
                ai.memory.dashDirection = null;
            }
        }
        
        // Phase in/out ability
        if (ai.memory.phaseTimer <= 0) {
            ai.memory.phaseTimer = 2000;
            ai.memory.isPhased = !ai.memory.isPhased;
            
            // Emit phase change
            this.eventBus.emit('ENEMY_PHASE_CHANGE', {
                entityId: entityId,
                phased: ai.memory.isPhased,
                alpha: ai.memory.isPhased ? 0.3 : 1.0
            });
        }
        
        // Update AI state
        ai.decisionTimer -= deltaTime * 1000;
        if (ai.decisionTimer <= 0) {
            ai.decisionTimer = 750;
            ai.aggressionLevel = 0.7;
            ai.fearLevel = 0.4;
            
            // Find target
            const enemy = this.findNearestEnemy(entityId, transform, 'phantom');
            const player = this.findPlayer();
            
            let target = null;
            if (player && this.getDistance(transform, player.transform) < 800) {
                target = player;
            } else if (enemy && enemy.distance < 600) {
                target = { id: enemy.id, transform: enemy.transform };
            }
            
            if (target) {
                if (ai.memory.attackTimer <= 0 && ai.memory.retreatTimer <= 0) {
                    ai.state = 'approaching';
                    ai.target = target.id;
                    ai.memory.attackTimer = 2000;
                } else if (ai.memory.attackTimer > 0) {
                    ai.state = 'attacking';
                } else {
                    ai.state = 'retreating';
                }
            } else {
                ai.state = 'hunting';
                ai.target = null;
            }
        }
        
        // Execute behavior
        let forceX = 0, forceY = 0;
        
        // Apply dash force if dashing
        if (ai.memory.isDashing && ai.memory.dashDirection) {
            forceX = ai.memory.dashDirection.x * 0.08;
            forceY = ai.memory.dashDirection.y * 0.08;
        } else {
            // Normal movement behavior
            switch (ai.state) {
                case 'approaching':
                case 'attacking':
                    if (ai.target) {
                        const target = this.entityManager.getComponent(ai.target, 'transform');
                        if (target) {
                            const dx = target.x - transform.x;
                            const dy = target.y - transform.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist > 0) {
                                // Fast approach with evasive maneuvers
                                forceX += (dx / dist) * 0.015;
                                forceY += (dy / dist) * 0.015;
                                
                                // Add slight weaving motion
                                const weaveAngle = Date.now() * 0.003;
                                const perpX = -dy / dist;
                                const perpY = dx / dist;
                                forceX += perpX * Math.sin(weaveAngle) * 0.005;
                                forceY += perpY * Math.sin(weaveAngle) * 0.005;
                                
                                // Shoot rapidly when close
                                if (dist < 400) {
                                    const weapon = this.entityManager.getComponent(entityId, 'weapon');
                                    if (weapon && weapon.lastFireTime <= 0) {
                                        const angle = Math.atan2(dy, dx);
                                        this.requestShoot(entityId, angle);
                                        
                                        // Start retreat after shooting
                                        if (ai.memory.attackTimer <= 1000) {
                                            ai.memory.retreatTimer = 1500;
                                            ai.state = 'retreating';
                                        }
                                    }
                                }
                            }
                        }
                    }
                    break;
                    
                case 'retreating':
                    if (ai.target) {
                        const target = this.entityManager.getComponent(ai.target, 'transform');
                        if (target) {
                            const dx = transform.x - target.x;
                            const dy = transform.y - target.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            
                            if (dist > 0) {
                                // Fast retreat with zigzag pattern
                                forceX += (dx / dist) * 0.018;
                                forceY += (dy / dist) * 0.018;
                                
                                // Zigzag evasion
                                const zigzagAngle = Date.now() * 0.004;
                                const perpX = -dy / dist;
                                const perpY = dx / dist;
                                forceX += perpX * Math.sin(zigzagAngle) * 0.008;
                                forceY += perpY * Math.sin(zigzagAngle) * 0.008;
                            }
                            
                            // Reset attack timer when far enough
                            if (dist > 600) {
                                ai.memory.attackTimer = 0;
                                ai.memory.retreatTimer = 0;
                            }
                        }
                    }
                    break;
                    
                case 'hunting':
                    // Erratic movement while hunting
                    if (!ai.memory.huntAngle) {
                        ai.memory.huntAngle = Math.random() * Math.PI * 2;
                    }
                    ai.memory.huntAngle += (Math.random() - 0.5) * 0.3;
                    
                    forceX = Math.cos(ai.memory.huntAngle) * 0.008;
                    forceY = Math.sin(ai.memory.huntAngle) * 0.008;
                    break;
            }
        }
        
        // Team up with nearby phantoms
        let phantomCount = 0;
        allies.forEach(allyId => {
            if (allyId === entityId) return;
            
            const allyTransform = this.entityManager.getComponent(allyId, 'transform');
            if (!allyTransform) return;
            
            const dist = this.getDistance(transform, allyTransform);
            if (dist < 300 && dist > 100) {
                phantomCount++;
                // Slight attraction to stay in loose groups
                const dx = allyTransform.x - transform.x;
                const dy = allyTransform.y - transform.y;
                forceX += (dx / dist) * 0.002;
                forceY += (dy / dist) * 0.002;
            }
        });
        
        // Detect and avoid gravity sources
        const gravitySources = this.detectGravitySources(transform);
        const gravityAvoidance = this.calculateGravityAvoidance(transform, gravitySources);
        
        // Apply gravity avoidance - Phantoms use dashes to escape gravity
        if (gravityAvoidance.x !== 0 || gravityAvoidance.y !== 0) {
            // If in gravity danger, boost avoidance force
            const avoidanceStrength = ai.memory.isDashing ? 2 : 1.2;
            forceX += gravityAvoidance.x * avoidanceStrength;
            forceY += gravityAvoidance.y * avoidanceStrength;
            
            // Trigger emergency dash if too close to gravity source
            if (!ai.memory.isDashing && ai.memory.dashCooldown <= 0) {
                const strongestGravity = gravitySources.reduce((strongest, source) => {
                    const danger = source.type === 'vortex' ? 
                        (source.eventHorizon + 100) / source.distance :
                        (source.radius + 50) / source.distance;
                    return danger > strongest.danger ? { danger, source } : strongest;
                }, { danger: 0, source: null });
                
                if (strongestGravity.danger > 0.8) {
                    // Emergency dash away from gravity
                    ai.memory.dashCooldown = 500;
                    ai.memory.dashDirection = {
                        x: gravityAvoidance.x / Math.sqrt(gravityAvoidance.x ** 2 + gravityAvoidance.y ** 2),
                        y: gravityAvoidance.y / Math.sqrt(gravityAvoidance.x ** 2 + gravityAvoidance.y ** 2)
                    };
                    ai.memory.isDashing = true;
                    ai.memory.dashTimer = 200; // Longer emergency dash
                }
            }
        }
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics
        physics.maxSpeed = ai.memory.isDashing ? 15 : (ai.memory.isPhased ? 10 : 7);
        physics.damping = ai.memory.isDashing ? 0.99 : 0.97;
    }
}

// Titan behavior - fearless and powerful with charging mechanics
class TitanBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene) {
        super(eventBus, entityManager, scene);
    }
    
    updateGroup(entities, deltaTime, playerId) {
        entities.forEach(entityId => {
            this.updateEntity(entityId, deltaTime);
        });
    }
    
    updateEntity(entityId, deltaTime) {
        const ai = this.entityManager.getComponent(entityId, 'ai');
        const transform = this.entityManager.getComponent(entityId, 'transform');
        const physics = this.entityManager.getComponent(entityId, 'physics');
        
        if (!ai || !transform || !physics) return;
        
        // Initialize memory
        if (!ai.memory.chargeTimer) {
            ai.memory.chargeTimer = 0;
            ai.memory.shockwaveTimer = 0;
            ai.memory.rageLevel = 0;
            ai.memory.chargeSpeed = 0;
            ai.memory.chargeDirection = null;
            ai.memory.chargeCooldown = 0;
            ai.memory.slamCooldown = 0;
        }
        
        // Update timers
        ai.memory.chargeTimer -= deltaTime * 1000;
        ai.memory.shockwaveTimer -= deltaTime * 1000;
        ai.memory.chargeCooldown -= deltaTime * 1000;
        ai.memory.slamCooldown -= deltaTime * 1000;
        
        // Update AI state
        ai.decisionTimer -= deltaTime * 1000;
        if (ai.decisionTimer <= 0) {
            ai.decisionTimer = 1500;
            ai.aggressionLevel = 1.0; // Maximum aggression
            ai.fearLevel = 0; // Fearless
            
            // Find nearest target
            const enemy = this.findNearestEnemy(entityId, transform, 'titan');
            const player = this.findPlayer();
            
            let target = null;
            let targetDist = Infinity;
            
            if (player) {
                const dist = this.getDistance(transform, player.transform);
                if (dist < targetDist) {
                    target = player;
                    targetDist = dist;
                }
            }
            
            if (enemy && enemy.distance < targetDist) {
                target = { id: enemy.id, transform: enemy.transform };
                targetDist = enemy.distance;
            }
            
            if (target) {
                // Decide between charging sprint or slam attack
                if (targetDist > 400 && ai.memory.chargeCooldown <= 0) {
                    ai.state = 'sprint_charging';
                    ai.target = target.id;
                    ai.memory.chargeTimer = 3000; // 3 second charge
                    ai.memory.chargeSpeed = 0;
                    // Lock in charge direction
                    const dx = target.transform.x - transform.x;
                    const dy = target.transform.y - transform.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    ai.memory.chargeDirection = {
                        x: dx / dist,
                        y: dy / dist
                    };
                } else if (targetDist < 250 && ai.memory.slamCooldown <= 0) {
                    ai.state = 'preparing_slam';
                    ai.target = target.id;
                } else {
                    ai.state = 'advancing';
                    ai.target = target.id;
                }
                
                // Increase rage when enemy is close
                if (targetDist < 300) {
                    ai.memory.rageLevel = Math.min(1, ai.memory.rageLevel + 0.1);
                }
            } else {
                ai.state = 'seeking';
                ai.memory.rageLevel = Math.max(0, ai.memory.rageLevel - 0.05);
            }
        }
        
        // Execute behavior
        let forceX = 0, forceY = 0;
        
        switch (ai.state) {
            case 'sprint_charging':
                if (ai.memory.chargeDirection && ai.memory.chargeTimer > 0) {
                    // Accelerating sprint that gets faster and faster
                    ai.memory.chargeSpeed = Math.min(ai.memory.chargeSpeed + 0.3, 15);
                    
                    // Can barely turn during charge - only slight adjustments
                    if (ai.target) {
                        const target = this.entityManager.getComponent(ai.target, 'transform');
                        if (target) {
                            const dx = target.x - transform.x;
                            const dy = target.y - transform.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > 0) {
                                const targetDir = { x: dx / dist, y: dy / dist };
                                // Very slight course correction (5% turning ability)
                                ai.memory.chargeDirection.x = ai.memory.chargeDirection.x * 0.95 + targetDir.x * 0.05;
                                ai.memory.chargeDirection.y = ai.memory.chargeDirection.y * 0.95 + targetDir.y * 0.05;
                                // Renormalize
                                const len = Math.sqrt(ai.memory.chargeDirection.x ** 2 + ai.memory.chargeDirection.y ** 2);
                                ai.memory.chargeDirection.x /= len;
                                ai.memory.chargeDirection.y /= len;
                            }
                        }
                    }
                    
                    // Apply massive forward force
                    forceX = ai.memory.chargeDirection.x * ai.memory.chargeSpeed * 0.05;
                    forceY = ai.memory.chargeDirection.y * ai.memory.chargeSpeed * 0.05;
                    
                    // Check for slam opportunity
                    if (ai.target) {
                        const target = this.entityManager.getComponent(ai.target, 'transform');
                        if (target) {
                            const dist = this.getDistance(transform, target);
                            if (dist < 200) {
                                ai.state = 'slamming';
                                ai.memory.chargeCooldown = 5000; // 5 second cooldown
                            }
                        }
                    }
                } else {
                    // Charge ended, cooldown
                    ai.state = 'advancing';
                    ai.memory.chargeCooldown = 4000;
                }
                break;
                
            case 'preparing_slam':
                // Brief windup before slam
                ai.memory.slamTimer = (ai.memory.slamTimer || 0) + deltaTime * 1000;
                if (ai.memory.slamTimer > 500) {
                    ai.state = 'slamming';
                    ai.memory.slamTimer = 0;
                }
                // Slow movement during windup
                if (ai.target) {
                    const target = this.entityManager.getComponent(ai.target, 'transform');
                    if (target) {
                        const dx = target.x - transform.x;
                        const dy = target.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0) {
                            forceX = (dx / dist) * 0.005;
                            forceY = (dy / dist) * 0.005;
                        }
                    }
                }
                break;
                
            case 'slamming':
                // Execute slam attack
                ai.memory.slamCooldown = 3000;
                
                // Create shockwave
                this.eventBus.emit('TITAN_SHOCKWAVE', {
                    entityId: entityId,
                    x: transform.x,
                    y: transform.y,
                    radius: 300,
                    damage: 50
                });
                
                // Screen shake for impact
                this.eventBus.emit('CAMERA_SHAKE', {
                    duration: 800,
                    intensity: 0.04
                });
                
                ai.state = 'advancing';
                break;
                
            case 'advancing':
                if (ai.target) {
                    const target = this.entityManager.getComponent(ai.target, 'transform');
                    if (target) {
                        const dx = target.x - transform.x;
                        const dy = target.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 0) {
                            // Normal movement with rage boost
                            const moveForce = 0.015 * (1 + ai.memory.rageLevel);
                            forceX += (dx / dist) * moveForce;
                            forceY += (dy / dist) * moveForce;
                            
                            // Powerful shots
                            if (dist < 600) {
                                const weapon = this.entityManager.getComponent(entityId, 'weapon');
                                if (weapon && weapon.lastFireTime <= 0) {
                                    // Charged shots
                                    weapon.chargeTime = weapon.maxChargeTime;
                                    const angle = Math.atan2(dy, dx);
                                    this.requestShoot(entityId, angle);
                                }
                            }
                        }
                    }
                }
                break;
                
            case 'seeking':
                // Aggressive wandering
                if (!ai.memory.seekAngle) {
                    ai.memory.seekAngle = Math.random() * Math.PI * 2;
                }
                ai.memory.seekAngle += (Math.random() - 0.5) * 0.1;
                
                forceX = Math.cos(ai.memory.seekAngle) * 0.01;
                forceY = Math.sin(ai.memory.seekAngle) * 0.01;
                break;
        }
        
        // Detect and avoid gravity sources
        const gravitySources = this.detectGravitySources(transform);
        const gravityAvoidance = this.calculateGravityAvoidance(transform, gravitySources);
        
        // Titans resist gravity with their mass but still avoid vortexes
        if (gravityAvoidance.x !== 0 || gravityAvoidance.y !== 0) {
            // Check if near vortex - even titans fear the vortex
            const nearVortex = gravitySources.some(source => 
                source.type === 'vortex' && source.distance < source.eventHorizon * 2
            );
            
            if (nearVortex) {
                // Emergency power to escape vortex
                forceX += gravityAvoidance.x * 2;
                forceY += gravityAvoidance.y * 2;
                // Cancel charge if heading toward vortex
                if (ai.state === 'sprint_charging') {
                    ai.state = 'advancing';
                    ai.memory.chargeSpeed = 0;
                    ai.memory.chargeCooldown = 1000;
                }
            } else {
                // Normal gravity resistance (titans are heavy)
                forceX += gravityAvoidance.x * 0.7;
                forceY += gravityAvoidance.y * 0.7;
            }
        }
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics based on state
        if (ai.state === 'sprint_charging') {
            physics.maxSpeed = ai.memory.chargeSpeed;
            physics.damping = 0.999; // Almost no damping during charge
        } else {
            physics.maxSpeed = 4 + ai.memory.rageLevel * 2;
            physics.damping = 0.995;
        }
        physics.mass = 30; // Heavy
    }
}

window.AiSystem = AISystem;