// AISystem.js - Modular AI behavior system with shared traits
// REFACTORED: Complete modular rewrite with trait composition

class AISystem {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.playerId = null;
        
        // AI configuration
        this.config = {
            detectionRange: 2000, // Match player's view at base zoom (screen width / 0.4)
            shootingRange: 800,   // Increased shooting range
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
            movement: new MovementTrait(this.entityManager, this.scene),
            gravityAvoidance: new GravityAvoidanceTrait(this.entityManager),
            flocking: new FlockingTrait(this.entityManager),
            formation: new FormationTrait(this.entityManager)
        };
        
        // Initialize faction behaviors with trait composition
        this.factionBehaviors = {
            swarm: new SwarmBehavior(this.eventBus, this.entityManager, this.scene, this.traits, this.config),
            sentinel: new SentinelBehavior(this.eventBus, this.entityManager, this.scene, this.traits, this.config),
            phantom: new PhantomBehavior(this.eventBus, this.entityManager, this.scene, this.traits, this.config),
            titan: new TitanBehavior(this.eventBus, this.entityManager, this.scene, this.traits, this.config)
        };
        
        // Listen for player creation
        this.eventBus.on('ENTITY_CREATED', (data) => {
            if (data.type === 'player') {
                this.playerId = data.id;
                //console.log('[AISystem] Player ID set:', this.playerId);
            }
        });
    }
    
    update(deltaTime, entityManager) {
        const aiEntities = entityManager.query('ai', 'transform', 'physics');
        
        // Group entities by faction
        const factionGroups = {};
        
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
                if (entities.length > 0 && Math.random() < 0.01) {
                    //console.log(`[AISystem] Updating ${faction} behavior for ${entities.length} entities`);
                }
                this.factionBehaviors[faction].updateGroup(entities, deltaTime, this.playerId);
            }
        });
    }
}

// Shared AI Traits - Modular behaviors that can be composed

// Targeting trait - handles enemy and player detection with range limits
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
        
        // Check enemy factions - ALL enemies shoot at other factions
        const enemies = this.entityManager.getEntitiesByType('enemy');
        enemies.forEach(enemyId => {
            if (enemyId === entityId) return;
            
            const enemyAI = this.entityManager.getComponent(enemyId, 'ai');
            const enemyTransform = this.entityManager.getComponent(enemyId, 'transform');
            
            // Target any enemy that's not same faction
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
    
    canShoot(entityId, targetDistance) {
        if (targetDistance > this.config.shootingRange) return false;
        
        const weapon = this.entityManager.getComponent(entityId, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return false;
        
        return true;
    }
    
    aimAndShoot(shooterId, target, accuracy = 1.0) {
        const shooterTransform = this.entityManager.getComponent(shooterId, 'transform');
        if (!shooterTransform) return;
        
        let aimX = target.transform.x;
        let aimY = target.transform.y;
        
        // Predict target movement if physics available
        const targetPhysics = this.entityManager.getComponent(target.id, 'physics');
        if (targetPhysics) {
            const dist = target.distance;
            const projectileSpeed = 15; // Approximate projectile speed
            const leadTime = dist / projectileSpeed;
            
            aimX += targetPhysics.velocity.x * leadTime * accuracy;
            aimY += targetPhysics.velocity.y * leadTime * accuracy;
        }
        
        // Add inaccuracy for some factions
        const spread = (1 - accuracy) * 0.3;
        const angle = Math.atan2(aimY - shooterTransform.y, aimX - shooterTransform.x) + (Math.random() - 0.5) * spread;
        
        this.eventBus.emit('ENEMY_SHOOT_REQUEST', {
            shooterId: shooterId,
            angle: angle
        });
    }
}

// Movement trait - basic movement behaviors
class MovementTrait {
    constructor(entityManager, scene) {
        this.entityManager = entityManager;
        this.scene = scene;
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
    
    maintainDistance(transform, targetTransform, idealDistance, tolerance = 50) {
        const dx = targetTransform.x - transform.x;
        const dy = targetTransform.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) return { x: 0, y: 0 };
        
        let forceX = 0, forceY = 0;
        
        if (dist < idealDistance - tolerance) {
            // Too close - back away
            forceX = -(dx / dist) * 0.008;
            forceY = -(dy / dist) * 0.008;
        } else if (dist > idealDistance + tolerance) {
            // Too far - move closer
            forceX = (dx / dist) * 0.006;
            forceY = (dy / dist) * 0.006;
        }
        
        return { x: forceX, y: forceY };
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
    
    calculateAvoidance(entityTransform, gravitySources, multiplier = 1.0) {
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
                avoidX += (dx / dist) * avoidanceStrength * multiplier;
                avoidY += (dy / dist) * avoidanceStrength * multiplier;
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
    
    assignFormationPositions(entities, centerX, centerY, formationType = 'circle') {
        const positions = new Map();
        
        if (formationType === 'circle') {
            const radius = 150 + entities.length * 20;
            entities.forEach((entityId, index) => {
                const angle = (index / entities.length) * Math.PI * 2;
                positions.set(entityId, {
                    x: centerX + Math.cos(angle) * radius,
                    y: centerY + Math.sin(angle) * radius
                });
            });
        } else if (formationType === 'line') {
            const spacing = 450; // 3x spacing for sentinels
            entities.forEach((entityId, index) => {
                const offset = index * spacing - (entities.length - 1) * spacing / 2;
                positions.set(entityId, {
                    x: centerX + offset,
                    y: centerY
                });
            });
        }
        
        return positions;
    }
    
    moveToFormation(transform, targetPosition, speed = 0.008) {
        const dx = targetPosition.x - transform.x;
        const dy = targetPosition.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 30) return { x: 0, y: 0 }; // Close enough
        
        return {
            x: (dx / dist) * speed,
            y: (dy / dist) * speed
        };
    }
}

// Base behavior class
class BaseBehavior {
    constructor(eventBus, entityManager, scene, traits, config) {
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.scene = scene;
        this.traits = traits; // Shared trait behaviors
        this.config = config; // AI configuration
    }
    
    applyForce(entityId, forceX, forceY) {
        this.traits.movement.applyForce(entityId, forceX, forceY);
    }
}

// Swarm behavior - chaotic bee-like attacks
class SwarmBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene, traits, config) {
        super(eventBus, entityManager, scene, traits, config);
    }
    
    updateGroup(entities, deltaTime, playerId) {
        // Calculate swarm center
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
        
        // Find targets for swarm
        const targets = [];
        entities.forEach(entityId => {
            const transform = this.entityManager.getComponent(entityId, 'transform');
            if (!transform) return;
            
            const target = this.traits.targeting.getNearestTarget(entityId, transform, 'swarm');
            if (target) targets.push(target);
        });
        
        // Update each entity
        entities.forEach(entityId => {
            this.updateEntity(entityId, entities, targets, deltaTime);
        });
    }
    
    updateEntity(entityId, swarmmates, potentialTargets, deltaTime) {
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
        
        // Get nearest target
        const target = this.traits.targeting.getNearestTarget(entityId, transform, 'swarm');
        
        // Update swarm phase
        if (target) {
            if (ai.memory.swarmPhase === 'circling' && ai.memory.diveTimer <= 0) {
                ai.memory.swarmPhase = 'diving';
                ai.memory.diveTimer = 1500 + Math.random() * 1000;
                ai.memory.diveTarget = { 
                    x: target.transform.x + (Math.random() - 0.5) * 100,
                    y: target.transform.y + (Math.random() - 0.5) * 100
                };
            } else if (ai.memory.swarmPhase === 'diving' && (ai.memory.diveTimer <= 0 || target.distance < 100)) {
                ai.memory.swarmPhase = 'buzzing';
                ai.memory.diveTimer = 2000 + Math.random() * 1000;
            } else if (ai.memory.swarmPhase === 'buzzing' && ai.memory.diveTimer <= 0) {
                ai.memory.swarmPhase = 'circling';
                ai.memory.diveTimer = 1000 + Math.random() * 2000;
                ai.memory.orbitDirection *= -1;
            }
        }
        
        // Calculate forces
        let forceX = 0, forceY = 0;
        
        // Flocking behavior
        const flockForce = this.traits.flocking.calculateFlocking(entityId, transform, physics, swarmmates);
        forceX += flockForce.x;
        forceY += flockForce.y;
        
        // Chaos movement
        const chaosX = Math.cos(ai.memory.chaosAngle) * 0.15;
        const chaosY = Math.sin(ai.memory.chaosAngle) * 0.15;
        
        // Phase-based behavior
        if (target) {
            switch (ai.memory.swarmPhase) {
                case 'circling':
                    ai.memory.orbitAngle += 0.003 * ai.memory.orbitDirection;
                    const orbitRadius = 300 + Math.sin(ai.memory.chaosAngle * 0.5) * 100;
                    const orbitForce = this.traits.movement.orbit(
                        transform,
                        target.transform.x,
                        target.transform.y,
                        orbitRadius,
                        ai.memory.orbitAngle,
                        0.02
                    );
                    forceX += orbitForce.x + chaosX;
                    forceY += orbitForce.y + chaosY;
                    break;
                    
                case 'diving':
                    if (ai.memory.diveTarget) {
                        const diveForce = this.traits.movement.moveToward(
                            transform,
                            ai.memory.diveTarget.x,
                            ai.memory.diveTarget.y,
                            0.08
                        );
                        forceX += diveForce.x;
                        forceY += diveForce.y;
                    }
                    break;
                    
                case 'buzzing':
                    const buzzForce = this.traits.movement.maintainDistance(
                        transform,
                        target.transform,
                        100,
                        50
                    );
                    forceX += buzzForce.x + chaosX * 3;
                    forceY += buzzForce.y + chaosY * 3;
                    break;
            }
            
            // Shooting - swarm shoots frantically with low accuracy
            if (this.traits.shooting.canShoot(entityId, target.distance) && 
                (ai.memory.swarmPhase === 'diving' || ai.memory.swarmPhase === 'buzzing') && 
                Math.random() < 0.1) {
                this.traits.shooting.aimAndShoot(entityId, target, 0.7); // 70% accuracy
            }
        } else {
            // No target - chaotic wandering
            forceX += chaosX * 2;
            forceY += chaosY * 2;
        }
        
        // Gravity avoidance - swarm is highly responsive
        const gravitySources = this.traits.gravityAvoidance.detectGravitySources(transform);
        const gravityAvoidance = this.traits.gravityAvoidance.calculateAvoidance(transform, gravitySources, 1.5);
        forceX += gravityAvoidance.x;
        forceY += gravityAvoidance.y;
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics based on phase
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

// Sentinel behavior - defensive and tactical with orbiting
class SentinelBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene, traits, config) {
        super(eventBus, entityManager, scene, traits, config);
        this.formations = new Map();
    }
    
    updateGroup(entities, deltaTime, playerId) {
        // Form groups and assign formations
        const groups = this.formGroups(entities);
        
        groups.forEach((groupMembers, leaderId) => {
            const leaderTransform = this.entityManager.getComponent(leaderId, 'transform');
            if (leaderTransform) {
                const positions = this.traits.formation.assignFormationPositions(
                    groupMembers,
                    leaderTransform.x,
                    leaderTransform.y,
                    'circle'
                );
                this.formations.set(leaderId, positions);
            }
        });
        
        // Update each entity
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
            
            const group = [entityId];
            assigned.add(entityId);
            
            // Find nearby sentinels
            entities.forEach(otherId => {
                if (otherId === entityId || assigned.has(otherId)) return;
                
                const otherTransform = this.entityManager.getComponent(otherId, 'transform');
                if (!otherTransform) return;
                
                const dist = this.traits.targeting.getDistance(transform, otherTransform);
                if (dist < 600) { // Group radius
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
            ai.memory.lastShotTime = 0;
            ai.memory.shotCooldown = 1500; // 1.5 seconds between shots
        }
        
        // Update shot cooldown
        ai.memory.lastShotTime -= deltaTime * 1000;
        
        // Find target
        const target = this.traits.targeting.getNearestTarget(entityId, transform, 'sentinel');
        
        // Debug logging for targeting
        if (Math.random() < 0.01) { // 1% chance to log
            const allTargets = this.traits.targeting.findTargets(entityId, transform, 'sentinel');
            //console.log(`[Sentinel ${entityId}] Targeting:`, {
                //hasTarget: !!target,
                //targetId: target?.id || 'none',
                //targetDistance: target?.distance || 'N/A',
                //totalTargetsFound: allTargets.length,
                //detectionRange: this.config.detectionRange
            //});
        }
        
        // Calculate forces
        let forceX = 0, forceY = 0;
        
        if (target) {
            // Orbit target while maintaining distance
            ai.memory.orbitAngle += ai.memory.orbitSpeed * deltaTime * 1000;
            
            const orbitForce = this.traits.movement.orbit(
                transform,
                target.transform.x,
                target.transform.y,
                ai.memory.preferredDistance,
                ai.memory.orbitAngle,
                0.01
            );
            
            const distanceForce = this.traits.movement.maintainDistance(
                transform,
                target.transform,
                ai.memory.preferredDistance,
                50
            );
            
            forceX += orbitForce.x + distanceForce.x;
            forceY += orbitForce.y + distanceForce.y;
            
            // Tactical shooting with good prediction
            const weapon = this.entityManager.getComponent(entityId, 'weapon');
            
            // Debug logging
            if (Math.random() < 0.01) { // 1% chance to log
                //console.log(`[Sentinel ${entityId}] Combat check:`, {
                    //hasWeapon: !!weapon,
                    //weaponCooldown: weapon?.lastFireTime || 'N/A',
                    //aiCooldown: ai.memory.lastShotTime,
                    //targetDistance: target.distance,
                    //shootingRange: this.config.shootingRange,
                    //canShoot: weapon && weapon.lastFireTime <= 0 && ai.memory.lastShotTime <= 0 && target.distance <= this.config.shootingRange
                //});
            }
            
            if (weapon && target.distance <= this.config.shootingRange && 
                weapon.lastFireTime <= 0 && ai.memory.lastShotTime <= 0) {
                
                // Fire with prediction
                this.traits.shooting.aimAndShoot(entityId, target, 0.9); // 90% accuracy
                ai.memory.lastShotTime = ai.memory.shotCooldown;
                
                // Log successful shot
                //console.log(`[Sentinel ${entityId}] FIRING at target ${target.id} at distance ${target.distance}`);
            }
        } else {
            // Patrol or maintain formation
            let formationPosition = null;
            
            // Check if part of formation
            for (const [leaderId, positions] of this.formations) {
                if (positions.has(entityId)) {
                    formationPosition = positions.get(entityId);
                    break;
                }
            }
            
            if (formationPosition) {
                const formationForce = this.traits.formation.moveToFormation(transform, formationPosition);
                forceX += formationForce.x;
                forceY += formationForce.y;
            } else {
                // Solo patrol
                ai.memory.orbitAngle += 0.0005;
                const patrolForce = this.traits.movement.orbit(
                    transform,
                    ai.memory.guardPoint.x,
                    ai.memory.guardPoint.y,
                    ai.memory.orbitRadius,
                    ai.memory.orbitAngle,
                    0.005
                );
                forceX += patrolForce.x;
                forceY += patrolForce.y;
            }
        }
        
        // Avoid other sentinels
        allies.forEach(allyId => {
            if (allyId === entityId) return;
            
            const allyTransform = this.entityManager.getComponent(allyId, 'transform');
            if (!allyTransform) return;
            
            const dist = this.traits.targeting.getDistance(transform, allyTransform);
            if (dist < 150 && dist > 0) {
                const dx = transform.x - allyTransform.x;
                const dy = transform.y - allyTransform.y;
                forceX += (dx / dist) * 0.006 / dist;
                forceY += (dy / dist) * 0.006 / dist;
            }
        });
        
        // Gravity avoidance
        const gravitySources = this.traits.gravityAvoidance.detectGravitySources(transform);
        const gravityAvoidance = this.traits.gravityAvoidance.calculateAvoidance(transform, gravitySources, 1.0);
        forceX += gravityAvoidance.x;
        forceY += gravityAvoidance.y;
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics
        physics.maxSpeed = 5;
        physics.damping = 0.995;
    }
}

// Phantom behavior - hit and run with dash mechanics
class PhantomBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene, traits, config) {
        super(eventBus, entityManager, scene, traits, config);
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
        if (!ai.memory.dashCooldown) {
            ai.memory.dashCooldown = 0;
            ai.memory.isDashing = false;
            ai.memory.dashDirection = null;
            ai.memory.dashTimer = 0;
            ai.memory.attackTimer = 0;
            ai.memory.retreatTimer = 0;
            ai.memory.isPhased = false;
            ai.memory.phaseTimer = 0;
        }
        
        // Update timers
        ai.memory.dashCooldown -= deltaTime * 1000;
        ai.memory.attackTimer -= deltaTime * 1000;
        ai.memory.retreatTimer -= deltaTime * 1000;
        ai.memory.phaseTimer -= deltaTime * 1000;
        
        // Phase ability
        if (ai.memory.phaseTimer <= 0) {
            ai.memory.phaseTimer = 2000;
            ai.memory.isPhased = !ai.memory.isPhased;
            
            this.eventBus.emit('ENEMY_PHASE_CHANGE', {
                entityId: entityId,
                phased: ai.memory.isPhased,
                alpha: ai.memory.isPhased ? 0.3 : 1.0
            });
        }
        
        // Find target
        const target = this.traits.targeting.getNearestTarget(entityId, transform, 'phantom');
        
        // Update dash state
        if (ai.memory.isDashing) {
            ai.memory.dashTimer -= deltaTime * 1000;
            if (ai.memory.dashTimer <= 0) {
                ai.memory.isDashing = false;
                ai.memory.dashDirection = null;
            }
        }
        
        // Dash mechanics - every 0.5 seconds
        if (ai.memory.dashCooldown <= 0 && !ai.memory.isDashing && target) {
            ai.memory.dashCooldown = 500;
            
            // Decide dash direction
            let dashX = 0, dashY = 0;
            
            if (target.distance < 400 && target.distance > 150) {
                // Flank dash
                const angle = Math.atan2(target.transform.y - transform.y, target.transform.x - transform.x);
                const flankAngle = angle + (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2);
                dashX = Math.cos(flankAngle);
                dashY = Math.sin(flankAngle);
            } else if (target.distance < 150) {
                // Escape dash
                const angle = Math.atan2(transform.y - target.transform.y, transform.x - target.transform.x);
                dashX = Math.cos(angle);
                dashY = Math.sin(angle);
            }
            
            if (dashX !== 0 || dashY !== 0) {
                ai.memory.dashDirection = { x: dashX, y: dashY };
                ai.memory.isDashing = true;
                ai.memory.dashTimer = 150;
                
                this.eventBus.emit('PHANTOM_DASH', {
                    entityId: entityId,
                    x: transform.x,
                    y: transform.y,
                    direction: ai.memory.dashDirection
                });
            }
        }
        
        // Calculate forces
        let forceX = 0, forceY = 0;
        
        if (ai.memory.isDashing && ai.memory.dashDirection) {
            // Dash force
            forceX = ai.memory.dashDirection.x * 0.08;
            forceY = ai.memory.dashDirection.y * 0.08;
        } else if (target) {
            // Hit and run tactics
            if (ai.memory.attackTimer <= 0 && ai.memory.retreatTimer <= 0) {
                ai.memory.attackTimer = 2000;
            }
            
            if (ai.memory.attackTimer > 0) {
                // Approach with weaving
                const approachForce = this.traits.movement.moveToward(
                    transform,
                    target.transform.x,
                    target.transform.y,
                    0.015
                );
                
                const weaveAngle = Date.now() * 0.003;
                const perpX = -approachForce.y;
                const perpY = approachForce.x;
                
                forceX += approachForce.x + perpX * Math.sin(weaveAngle) * 0.005;
                forceY += approachForce.y + perpY * Math.sin(weaveAngle) * 0.005;
                
                // Shoot when close
                if (this.traits.shooting.canShoot(entityId, target.distance)) {
                    this.traits.shooting.aimAndShoot(entityId, target, 0.85); // 85% accuracy
                    
                    if (ai.memory.attackTimer <= 1000) {
                        ai.memory.retreatTimer = 1500;
                        ai.memory.attackTimer = 0;
                    }
                }
            } else if (ai.memory.retreatTimer > 0) {
                // Retreat with zigzag
                const dx = transform.x - target.transform.x;
                const dy = transform.y - target.transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    const zigzagAngle = Date.now() * 0.004;
                    const perpX = -dy / dist;
                    const perpY = dx / dist;
                    
                    forceX += (dx / dist) * 0.018 + perpX * Math.sin(zigzagAngle) * 0.008;
                    forceY += (dy / dist) * 0.018 + perpY * Math.sin(zigzagAngle) * 0.008;
                }
                
                if (target.distance > 600) {
                    ai.memory.retreatTimer = 0;
                }
            }
        } else {
            // Hunt with erratic movement
            if (!ai.memory.huntAngle) {
                ai.memory.huntAngle = Math.random() * Math.PI * 2;
            }
            ai.memory.huntAngle += (Math.random() - 0.5) * 0.3;
            
            forceX = Math.cos(ai.memory.huntAngle) * 0.008;
            forceY = Math.sin(ai.memory.huntAngle) * 0.008;
        }
        
        // Gravity avoidance with emergency dash
        const gravitySources = this.traits.gravityAvoidance.detectGravitySources(transform);
        const gravityAvoidance = this.traits.gravityAvoidance.calculateAvoidance(transform, gravitySources, 1.2);
        
        if ((gravityAvoidance.x !== 0 || gravityAvoidance.y !== 0) && !ai.memory.isDashing && ai.memory.dashCooldown <= 0) {
            // Check for emergency dash need
            const strongestGravity = gravitySources.reduce((strongest, source) => {
                const danger = source.type === 'vortex' ? 
                    (source.eventHorizon + 100) / source.distance :
                    (source.radius + 50) / source.distance;
                return danger > strongest.danger ? { danger, source } : strongest;
            }, { danger: 0, source: null });
            
            if (strongestGravity.danger > 0.8) {
                // Emergency dash
                ai.memory.dashCooldown = 500;
                const avoidLen = Math.sqrt(gravityAvoidance.x ** 2 + gravityAvoidance.y ** 2);
                ai.memory.dashDirection = {
                    x: gravityAvoidance.x / avoidLen,
                    y: gravityAvoidance.y / avoidLen
                };
                ai.memory.isDashing = true;
                ai.memory.dashTimer = 200;
            }
        }
        
        forceX += gravityAvoidance.x;
        forceY += gravityAvoidance.y;
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics
        physics.maxSpeed = ai.memory.isDashing ? 15 : (ai.memory.isPhased ? 10 : 7);
        physics.damping = ai.memory.isDashing ? 0.99 : 0.97;
    }
}

// Titan behavior - charging and slam attacks
class TitanBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene, traits, config) {
        super(eventBus, entityManager, scene, traits, config);
        this.titanDetectionRange = 2500; // Massive detection range
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
        const sprite = this.scene.sprites.get(entityId);
        
        if (!ai || !transform || !physics || !sprite) {
            //console.log(`[Titan ${entityId}] Missing components:`, { ai: !!ai, transform: !!transform, physics: !!physics, sprite: !!sprite });
            return;
        }
        
        // Initialize memory
        if (!ai.memory.initialized) {
            ai.memory.initialized = true;
            ai.memory.state = 'hunting'; // hunting, charging, slamming
            ai.memory.chargeSpeed = 0;
            ai.memory.chargeTarget = null;
            ai.memory.chargeCooldown = 0;
            ai.memory.slamCooldown = 0;
            ai.memory.wanderAngle = Math.random() * Math.PI * 2;
            ai.memory.roarTimer = 0;
            //console.log(`[Titan ${entityId}] Initialized`);
        }
        
        // Update timers
        ai.memory.chargeCooldown = Math.max(0, ai.memory.chargeCooldown - deltaTime);
        ai.memory.slamCooldown = Math.max(0, ai.memory.slamCooldown - deltaTime);
        ai.memory.roarTimer = Math.max(0, ai.memory.roarTimer - deltaTime);
        
        // Find nearest target with massive detection range
        const target = this.traits.targeting.getNearestTarget(entityId, transform, 'titan', this.titanDetectionRange);
        
        let forceX = 0, forceY = 0;
        
        // State machine
        switch (ai.memory.state) {
            case 'hunting':
                if (target && ai.memory.chargeCooldown <= 0) {
                    // BEAST MODE: Initiate charge!
                    ai.memory.state = 'charging';
                    ai.memory.chargeSpeed = 2; // Start with some initial speed
                    ai.memory.chargeTarget = {
                        x: target.transform.x,
                        y: target.transform.y,
                        id: target.id
                    };
                    
                    // Announce charge with shockwave
                    this.eventBus.emit('TITAN_SHOCKWAVE', {
                        x: transform.x,
                        y: transform.y
                    });
                    
                    //console.log(`[Titan ${entityId}] INITIATING CHARGE! Target: ${target.faction} at ${Math.round(target.distance)} distance`);
                } else if (target && ai.memory.chargeCooldown > 0) {
                    // On cooldown - aggressively pursue
                    const pursuit = this.traits.movement.moveToward(
                        transform,
                        target.transform.x,
                        target.transform.y,
                        0.03
                    );
                    forceX = pursuit.x;
                    forceY = pursuit.y;
                    
                    // Try to slam if close enough
                    if (target.distance < 200 && ai.memory.slamCooldown <= 0) {
                        this.executeSlam(entityId, transform);
                    }
                    
                    // Shoot while pursuing
                    if (this.traits.shooting.canShoot(entityId, target.distance)) {
                        this.traits.shooting.aimAndShoot(entityId, target, 0.9);
                    }
                } else {
                    // No target - wander aggressively
                    ai.memory.wanderAngle += (Math.random() - 0.5) * 0.2;
                    forceX = Math.cos(ai.memory.wanderAngle) * 0.02;
                    forceY = Math.sin(ai.memory.wanderAngle) * 0.02;
                    
                    // Occasional roar
                    if (ai.memory.roarTimer <= 0) {
                        ai.memory.roarTimer = 5 + Math.random() * 5;
                        //console.log(`[Titan ${entityId}] *ROAR* (wandering)`);
                    }
                }
                break;
                
            case 'charging':
                // Accelerate charge continuously
                ai.memory.chargeSpeed = Math.min(ai.memory.chargeSpeed + deltaTime * 30, 25); // Max speed 25
                
                // Set initial charge direction if not set
                if (!ai.memory.chargeDirection) {
                    if (target) {
                        // Predict where target will be based on their velocity
                        const targetPhysics = this.entityManager.getComponent(target.id, 'physics');
                        let predictX = target.transform.x;
                        let predictY = target.transform.y;
                        
                        if (targetPhysics && targetPhysics.velocity) {
                            // Calculate time to reach target at average charge speed
                            const avgChargeSpeed = 15; // Average between start and max
                            const timeToTarget = target.distance / avgChargeSpeed;
                            
                            // Predict target position
                            predictX += targetPhysics.velocity.x * timeToTarget * 0.7; // 70% prediction for some error
                            predictY += targetPhysics.velocity.y * timeToTarget * 0.7;
                        }
                        
                        // Lock in the charge direction toward predicted position
                        const dx = predictX - transform.x;
                        const dy = predictY - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        ai.memory.chargeDirection = { 
                            x: dx / dist, 
                            y: dy / dist 
                        };
                        ai.memory.chargeTargetId = target.id;
                        ai.memory.lastTargetDistance = target.distance;
                        
                        //console.log(`[Titan ${entityId}] Charge direction locked with prediction!`);
                    } else {
                        // No target? Charge forward
                        ai.memory.chargeDirection = {
                            x: Math.cos(sprite.rotation),
                            y: Math.sin(sprite.rotation)
                        };
                    }
                }
                
                // Apply charge force in locked direction (NO TURNING)
                if (ai.memory.chargeDirection) {
                    forceX = ai.memory.chargeDirection.x * ai.memory.chargeSpeed * 0.1;
                    forceY = ai.memory.chargeDirection.y * ai.memory.chargeSpeed * 0.1;
                }
                
                // Track distance to original target
                if (target && target.id === ai.memory.chargeTargetId) {
                    const currentDistance = target.distance;
                    
                    // Check if we're moving away from target
                    if (ai.memory.lastTargetDistance && currentDistance > ai.memory.lastTargetDistance) {
                        //console.log(`[Titan ${entityId}] Passed target! Was ${ai.memory.lastTargetDistance.toFixed(0)}, now ${currentDistance.toFixed(0)}`);
                        ai.memory.state = 'hunting';
                        ai.memory.chargeSpeed = 0;
                        ai.memory.chargeDirection = null;
                        ai.memory.chargeCooldown = 3;
                    }
                    
                    ai.memory.lastTargetDistance = currentDistance;
                }
                
                // Check for slam opportunity during charge
                const nearbyTargets = this.traits.targeting.findTargets(entityId, transform, 'titan', 200);
                if (nearbyTargets.length > 0 && ai.memory.slamCooldown <= 0) {
                    // SLAM!
                    this.executeSlam(entityId, transform);
                    ai.memory.state = 'hunting';
                    ai.memory.chargeSpeed = 0;
                    ai.memory.chargeDirection = null; // Clear direction
                    ai.memory.chargeCooldown = 3; // 3 second charge cooldown
                }
                
                // End charge if no targets in extended range
                if (!target) {
                    //console.log(`[Titan ${entityId}] Lost all targets, ending charge`);
                    ai.memory.state = 'hunting';
                    ai.memory.chargeSpeed = 0;
                    ai.memory.chargeDirection = null; // Clear direction
                    ai.memory.chargeCooldown = 3;
                }
                break;
        }
        
        // Gravity avoidance (titans resist but still avoid vortexes)
        const gravitySources = this.traits.gravityAvoidance.detectGravitySources(transform);
        const gravityAvoidance = this.traits.gravityAvoidance.calculateAvoidance(transform, gravitySources, 0.5);
        
        // Check for vortex danger
        const nearVortex = gravitySources.some(source => 
            source.type === 'vortex' && source.distance < source.eventHorizon * 2
        );
        
        if (nearVortex && ai.memory.state === 'charging') {
            // Emergency abort charge
            //console.log(`[Titan ${entityId}] VORTEX DANGER! Aborting charge!`);
            ai.memory.state = 'hunting';
            ai.memory.chargeSpeed = 0;
            ai.memory.chargeDirection = null; // Clear direction
            ai.memory.chargeCooldown = 1;
        }
        
        // Always apply some gravity avoidance
        forceX += gravityAvoidance.x;
        forceY += gravityAvoidance.y;
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics based on state
        if (ai.memory.state === 'charging') {
            physics.maxSpeed = ai.memory.chargeSpeed;
            physics.damping = 0.999; // Less damping during charge
        } else {
            physics.maxSpeed = 6; // Faster base speed
            physics.damping = 0.99;
        }
        
        // Debug occasional status
        if (Math.random() < 0.001) {
            //console.log(`[Titan ${entityId}] Status:`, {
                //state: ai.memory.state,
                //chargeSpeed: ai.memory.chargeSpeed.toFixed(1),
                //chargeCooldown: ai.memory.chargeCooldown.toFixed(1),
                //hasTarget: !!target,
                //targetDistance: target?.distance.toFixed(0) || 'N/A'
            //});
        }
    }
    
    executeSlam(entityId, transform) {
        //console.log(`[Titan ${entityId}] EXECUTING SLAM!`);
        
        // Set slam cooldown
        const ai = this.entityManager.getComponent(entityId, 'ai');
        ai.memory.slamCooldown = 2; // 2 second cooldown
        
        // Emit slam event
        this.eventBus.emit('TITAN_SLAM', {
            attackerId: entityId,
            x: transform.x,
            y: transform.y,
            radius: 300,
            damage: 50,
            knockback: 800
        });
        
        // Camera shake
        this.eventBus.emit('CAMERA_SHAKE', {
            duration: 800,
            intensity: 0.04
        });
        
        // Create shockwave visual
        this.eventBus.emit('TITAN_SHOCKWAVE', {
            x: transform.x,
            y: transform.y
        });
    }
}

window.AiSystem = AISystem;