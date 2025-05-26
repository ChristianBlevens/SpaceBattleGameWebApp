// AISystem.js - Advanced AI behavior system with faction-specific behaviors
// REFACTORED: Removed direct system access, now fully event-driven

class AISystem {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.playerId = null;
        
        // Boids parameters for flocking behavior
        this.boidParams = {
            separationRadius: 100,
            alignmentRadius: 200,
            cohesionRadius: 300,
            separationForce: 0.15,
            alignmentForce: 0.05,
            cohesionForce: 0.03,
            maxTurnRate: 0.2
        };
        
        // Faction behaviors will be initialized after eventBus is available
        this.factionBehaviors = {};
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
        
        // Initialize faction behaviors with eventBus
        this.factionBehaviors = {
            swarm: new SwarmBehavior(this.eventBus),
            sentinel: new SentinelBehavior(this.eventBus),
            phantom: new PhantomBehavior(this.eventBus),
            titan: new TitanBehavior(this.eventBus)
        };
        
        // Listen for player ID updates
        this.eventBus.on('PLAYER_RESULT', (data) => {
            if (data.player && data.playerId) {
                this.playerId = data.playerId;
            }
        });
        
        // Request player ID
        this.eventBus.emit('GET_PLAYER', { requestId: 'ai_player' });
    }
    
    update(deltaTime, entityManager) {
        const aiEntities = entityManager.query('ai', 'transform', 'physics');
        
        aiEntities.forEach(entityId => {
            const ai = entityManager.getComponent(entityId, 'ai');
            const transform = entityManager.getComponent(entityId, 'transform');
            const physics = entityManager.getComponent(entityId, 'physics');
            
            if (!ai || !transform || !physics) return;
            
            // Update decision timer
            ai.decisionTimer -= deltaTime * 1000;
            
            if (ai.decisionTimer <= 0) {
                // Make new decision
                this.makeDecision(entityId, ai);
                ai.decisionTimer = ai.reactionTime;
            }
            
            // Execute current behavior
            this.executeBehavior(entityId, ai, transform, physics, deltaTime);
            
            // Apply faction-specific behavior
            if (this.factionBehaviors[ai.faction]) {
                this.factionBehaviors[ai.faction].update(
                    entityId, ai, transform, physics, deltaTime
                );
            }
        });
    }
    
    makeDecision(entityId, ai) {
        // Find potential targets
        const myTransform = this.entityManager.getComponent(entityId, 'transform');
        const enemies = [];
        const allies = [];
        
        // Check player
        if (this.playerId) {
            const playerTransform = this.entityManager.getComponent(this.playerId, 'transform');
            if (playerTransform) {
                const dist = this.getDistance(myTransform, playerTransform);
                enemies.push({ id: this.playerId, distance: dist });
            }
        }
        
        // Check other AI entities
        const allAI = this.entityManager.getEntitiesByType('enemy');
        allAI.forEach(otherId => {
            if (otherId === entityId) return;
            
            const otherAI = this.entityManager.getComponent(otherId, 'ai');
            const otherTransform = this.entityManager.getComponent(otherId, 'transform');
            
            if (!otherAI || !otherTransform) return;
            
            const dist = this.getDistance(myTransform, otherTransform);
            
            if (otherAI.faction === ai.faction) {
                allies.push({ id: otherId, distance: dist });
            } else {
                enemies.push({ id: otherId, distance: dist });
            }
        });
        
        // Sort by distance
        enemies.sort((a, b) => a.distance - b.distance);
        allies.sort((a, b) => a.distance - b.distance);
        
        // Store in AI memory
        ai.memory.nearestEnemy = enemies[0] || null;
        ai.memory.nearestAlly = allies[0] || null;
        ai.memory.enemyCount = enemies.length;
        ai.memory.allyCount = allies.length;
        
        // Determine behavior based on situation
        if (enemies.length > 0 && enemies[0].distance < 600) {
            // Enemy nearby
            if (ai.aggressionLevel > 0.7 || allies.length > enemies.length) {
                ai.state = 'attacking';
                ai.target = enemies[0].id;
            } else if (ai.fearLevel > 0.7 || enemies.length > allies.length * 2) {
                ai.state = 'fleeing';
                ai.target = enemies[0].id;
            } else {
                ai.state = 'circling';
                ai.target = enemies[0].id;
            }
        } else if (allies.length > 0 && allies[0].distance > 300) {
            // Too far from allies
            ai.state = 'regrouping';
            ai.target = allies[0].id;
        } else {
            // No immediate threats
            ai.state = 'wandering';
            ai.target = null;
        }
    }
    
    executeBehavior(entityId, ai, transform, physics, deltaTime) {
        let forceX = 0;
        let forceY = 0;
        
        switch (ai.state) {
            case 'attacking':
                if (ai.target) {
                    const targetTransform = this.entityManager.getComponent(ai.target, 'transform');
                    if (targetTransform) {
                        // Move toward target
                        const dx = targetTransform.x - transform.x;
                        const dy = targetTransform.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 0) {
                            forceX = (dx / dist) * 0.01;
                            forceY = (dy / dist) * 0.01;
                        }
                        
                        // Try to shoot
                        if (dist < 500 && Math.random() < 0.02) {
                            this.requestShoot(entityId, ai.target);
                        }
                    }
                }
                break;
                
            case 'fleeing':
                if (ai.target) {
                    const targetTransform = this.entityManager.getComponent(ai.target, 'transform');
                    if (targetTransform) {
                        // Move away from target
                        const dx = transform.x - targetTransform.x;
                        const dy = transform.y - targetTransform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 0) {
                            forceX = (dx / dist) * 0.012;
                            forceY = (dy / dist) * 0.012;
                        }
                    }
                }
                break;
                
            case 'circling':
                if (ai.target) {
                    const targetTransform = this.entityManager.getComponent(ai.target, 'transform');
                    if (targetTransform) {
                        // Circle around target
                        const dx = targetTransform.x - transform.x;
                        const dy = targetTransform.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 0) {
                            // Tangential force
                            const angle = Math.atan2(dy, dx);
                            forceX = -Math.sin(angle) * 0.008;
                            forceY = Math.cos(angle) * 0.008;
                            
                            // Maintain distance
                            const idealDist = 400;
                            if (dist < idealDist) {
                                forceX += (dx / dist) * -0.005;
                                forceY += (dy / dist) * -0.005;
                            } else if (dist > idealDist) {
                                forceX += (dx / dist) * 0.005;
                                forceY += (dy / dist) * 0.005;
                            }
                        }
                        
                        // Occasionally shoot
                        if (Math.random() < 0.01) {
                            this.requestShoot(entityId, ai.target);
                        }
                    }
                }
                break;
                
            case 'regrouping':
                if (ai.target) {
                    const targetTransform = this.entityManager.getComponent(ai.target, 'transform');
                    if (targetTransform) {
                        // Move toward ally
                        const dx = targetTransform.x - transform.x;
                        const dy = targetTransform.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 200) {
                            forceX = (dx / dist) * 0.008;
                            forceY = (dy / dist) * 0.008;
                        }
                    }
                }
                break;
                
            case 'wandering':
                // Random wandering
                if (!ai.memory.wanderAngle) {
                    ai.memory.wanderAngle = Math.random() * Math.PI * 2;
                }
                
                // Slowly change wander direction
                ai.memory.wanderAngle += (Math.random() - 0.5) * 0.1;
                
                forceX = Math.cos(ai.memory.wanderAngle) * 0.005;
                forceY = Math.sin(ai.memory.wanderAngle) * 0.005;
                break;
        }
        
        // Apply boids flocking behavior
        const boidForces = this.calculateBoidForces(entityId, ai.faction);
        forceX += boidForces.x;
        forceY += boidForces.y;
        
        // Emit movement request instead of directly applying force
        this.eventBus.emit('FORCE_APPLIED', {
            entityId: entityId,
            force: { x: forceX, y: forceY }
        });
    }
    
    calculateBoidForces(entityId, faction) {
        const myTransform = this.entityManager.getComponent(entityId, 'transform');
        const myPhysics = this.entityManager.getComponent(entityId, 'physics');
        
        let separationX = 0, separationY = 0;
        let alignmentX = 0, alignmentY = 0;
        let cohesionX = 0, cohesionY = 0;
        let neighborCount = 0;
        
        // Check all entities of same faction
        const allies = this.entityManager.getEntitiesByType('enemy');
        
        allies.forEach(otherId => {
            if (otherId === entityId) return;
            
            const otherAI = this.entityManager.getComponent(otherId, 'ai');
            if (!otherAI || otherAI.faction !== faction) return;
            
            const otherTransform = this.entityManager.getComponent(otherId, 'transform');
            const otherPhysics = this.entityManager.getComponent(otherId, 'physics');
            
            if (!otherTransform || !otherPhysics) return;
            
            const dx = otherTransform.x - myTransform.x;
            const dy = otherTransform.y - myTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist === 0) return;
            
            // Separation
            if (dist < this.boidParams.separationRadius) {
                separationX -= (dx / dist) / dist;
                separationY -= (dy / dist) / dist;
            }
            
            // Alignment
            if (dist < this.boidParams.alignmentRadius) {
                alignmentX += otherPhysics.velocity.x;
                alignmentY += otherPhysics.velocity.y;
                neighborCount++;
            }
            
            // Cohesion
            if (dist < this.boidParams.cohesionRadius) {
                cohesionX += otherTransform.x;
                cohesionY += otherTransform.y;
            }
        });
        
        // Calculate final forces
        let forceX = separationX * this.boidParams.separationForce;
        let forceY = separationY * this.boidParams.separationForce;
        
        if (neighborCount > 0) {
            // Alignment
            alignmentX /= neighborCount;
            alignmentY /= neighborCount;
            forceX += (alignmentX - myPhysics.velocity.x) * this.boidParams.alignmentForce;
            forceY += (alignmentY - myPhysics.velocity.y) * this.boidParams.alignmentForce;
            
            // Cohesion
            cohesionX /= neighborCount;
            cohesionY /= neighborCount;
            forceX += (cohesionX - myTransform.x) * this.boidParams.cohesionForce * 0.001;
            forceY += (cohesionY - myTransform.y) * this.boidParams.cohesionForce * 0.001;
        }
        
        return { x: forceX, y: forceY };
    }
    
    requestShoot(shooterId, targetId) {
        const weapon = this.entityManager.getComponent(shooterId, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return;
        
        this.eventBus.emit('ENEMY_SHOOT_REQUEST', {
            shooterId: shooterId,
            targetId: targetId,
            angle: this.calculateAngleToTarget(shooterId, targetId)
        });
    }
    
    calculateAngleToTarget(shooterId, targetId) {
        const shooterTransform = this.entityManager.getComponent(shooterId, 'transform');
        const targetTransform = this.entityManager.getComponent(targetId, 'transform');
        
        if (!shooterTransform || !targetTransform) return 0;
        
        return Math.atan2(
            targetTransform.y - shooterTransform.y,
            targetTransform.x - shooterTransform.x
        );
    }
    
    getDistance(transformA, transformB) {
        const dx = transformB.x - transformA.x;
        const dy = transformB.y - transformA.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// Faction-specific behaviors
class SwarmBehavior {
    update(entityId, ai, transform, physics, deltaTime) {
        // Swarm enemies attack in groups and are very aggressive
        ai.aggressionLevel = 0.9;
        ai.fearLevel = 0.2;
        
        // Boost speed when attacking
        if (ai.state === 'attacking') {
            physics.maxSpeed = 8;
        } else {
            physics.maxSpeed = 6;
        }
    }
}

class SentinelBehavior {
    update(entityId, ai, transform, physics, deltaTime) {
        // Sentinels are defensive and protect territories
        ai.aggressionLevel = 0.4;
        ai.fearLevel = 0.3;
        
        // Create defensive perimeter
        if (!ai.memory.guardPoint) {
            ai.memory.guardPoint = {
                x: transform.x,
                y: transform.y
            };
        }
        
        // Return to guard point if too far
        const dx = ai.memory.guardPoint.x - transform.x;
        const dy = ai.memory.guardPoint.y - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 500 && ai.state !== 'attacking') {
            ai.state = 'returning';
            
            // Request movement force
            this.eventBus.emit('FORCE_APPLIED', {
                entityId: entityId,
                force: {
                    x: (dx / dist) * 0.01,
                    y: (dy / dist) * 0.01
                }
            });
        }
    }
}

class PhantomBehavior {
    update(entityId, ai, transform, physics, deltaTime) {
        // Phantoms are stealthy and unpredictable
        ai.aggressionLevel = 0.6;
        ai.fearLevel = 0.5;
        
        // Phase in and out
        if (!ai.memory.phaseTimer) {
            ai.memory.phaseTimer = 0;
            ai.memory.phased = false;
        }
        
        ai.memory.phaseTimer += deltaTime;
        
        if (ai.memory.phaseTimer > 2) {
            ai.memory.phaseTimer = 0;
            ai.memory.phased = !ai.memory.phased;
            
            // Emit phase change event
            this.eventBus.emit('ENEMY_PHASE_CHANGE', {
                entityId: entityId,
                phased: ai.memory.phased,
                alpha: ai.memory.phased ? 0.3 : 1,
                speedMultiplier: ai.memory.phased ? 1.33 : 1
            });
            
            if (ai.memory.phased) {
                physics.maxSpeed = 8;
            } else {
                physics.maxSpeed = 6;
            }
        }
    }
}

class TitanBehavior {
    update(entityId, ai, transform, physics, deltaTime) {
        // Titans are slow but powerful
        ai.aggressionLevel = 0.8;
        ai.fearLevel = 0.1;
        
        physics.maxSpeed = 3;
        
        // Area damage when close to enemies
        if (ai.state === 'attacking' && ai.memory.nearestEnemy) {
            if (ai.memory.nearestEnemy.distance < 150) {
                // Shockwave attack
                if (!ai.memory.lastShockwave || ai.memory.lastShockwave + 3000 < Date.now()) {
                    ai.memory.lastShockwave = Date.now();
                    
                    // Emit shockwave event
                    this.eventBus.emit('TITAN_SHOCKWAVE', {
                        entityId: entityId,
                        x: transform.x,
                        y: transform.y
                    });
                }
            }
        }
    }
}