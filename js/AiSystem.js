// AISystem.js - Advanced AI behavior system with faction-specific behaviors

class AISystem {
    constructor(scene) {
        this.scene = scene;
        
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
        
        // Faction behaviors
        this.factionBehaviors = {
            swarm: new SwarmBehavior(),
            sentinel: new SentinelBehavior(),
            phantom: new PhantomBehavior(),
            titan: new TitanBehavior()
        };
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
    }
    
    update(deltaTime, entityManager) {
        const aiEntities = entityManager.query('ai', 'transform', 'physics');
        
        aiEntities.forEach(entityId => {
            const ai = entityManager.getComponent(entityId, 'ai');
            const transform = entityManager.getComponent(entityId, 'transform');
            const physics = entityManager.getComponent(entityId, 'physics');
            const sprite = this.scene.sprites.get(entityId);
            
            if (!ai || !transform || !physics || !sprite) return;
            
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
                    entityId, ai, transform, physics, this.scene, deltaTime
                );
            }
            
            // Update sprite rotation to face movement direction
            if (sprite && sprite.body) {
                const vel = sprite.body.velocity;
                if (Math.abs(vel.x) > 0.1 || Math.abs(vel.y) > 0.1) {
                    const targetAngle = Math.atan2(vel.y, vel.x);
                    const currentAngle = sprite.rotation;
                    
                    // Smooth rotation
                    let angleDiff = targetAngle - currentAngle;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                    
                    const turnAmount = Math.min(Math.abs(angleDiff), this.boidParams.maxTurnRate);
                    sprite.rotation += Math.sign(angleDiff) * turnAmount;
                }
            }
        });
    }
    
    makeDecision(entityId, ai) {
        // Find potential targets
        const myTransform = this.entityManager.getComponent(entityId, 'transform');
        const enemies = [];
        const allies = [];
        
        // Check player
        const playerTransform = this.entityManager.getComponent(this.scene.player, 'transform');
        if (playerTransform) {
            const dist = this.getDistance(myTransform, playerTransform);
            enemies.push({ id: this.scene.player, distance: dist });
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
        const sprite = this.scene.sprites.get(entityId);
        if (!sprite) return;
        
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
                            this.tryToShoot(entityId, ai.target);
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
                            this.tryToShoot(entityId, ai.target);
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
        
        // Apply forces
        if (sprite.body) {
            sprite.applyForce({ x: forceX, y: forceY });
        }
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
    
    tryToShoot(shooterId, targetId) {
        const weapon = this.entityManager.getComponent(shooterId, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return;
        
        const angle = this.calculateAngleToTarget(shooterId, targetId);
        
        // Add some inaccuracy based on AI skill
        const ai = this.entityManager.getComponent(shooterId, 'ai');
        const accuracy = 1 - (ai.fearLevel * 0.3);
        const spread = (1 - accuracy) * 0.3;
        const finalAngle = angle + (Math.random() - 0.5) * spread;
        
        // Use weapon system to shoot
        this.scene.weaponSystem.enemyShoot(shooterId, targetId);
        
        window.EventBus.emit(window.GameEvents.ENEMY_SHOOT, {
            shooterId: shooterId,
            targetId: targetId
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
}

// Faction-specific behaviors
class SwarmBehavior {
    update(entityId, ai, transform, physics, scene, deltaTime) {
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
    update(entityId, ai, transform, physics, scene, deltaTime) {
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
            const sprite = scene.sprites.get(entityId);
            if (sprite) {
                sprite.applyForce({
                    x: (dx / dist) * 0.01,
                    y: (dy / dist) * 0.01
                });
            }
        }
    }
}

class PhantomBehavior {
    update(entityId, ai, transform, physics, scene, deltaTime) {
        // Phantoms are stealthy and unpredictable
        ai.aggressionLevel = 0.6;
        ai.fearLevel = 0.5;
        
        // Phase in and out
        const sprite = scene.sprites.get(entityId);
        if (sprite) {
            if (!ai.memory.phaseTimer) {
                ai.memory.phaseTimer = 0;
                ai.memory.phased = false;
            }
            
            ai.memory.phaseTimer += deltaTime;
            
            if (ai.memory.phaseTimer > 2) {
                ai.memory.phaseTimer = 0;
                ai.memory.phased = !ai.memory.phased;
                
                if (ai.memory.phased) {
                    sprite.setAlpha(0.3);
                    physics.maxSpeed = 8;
                } else {
                    sprite.setAlpha(1);
                    physics.maxSpeed = 6;
                }
            }
        }
    }
}

class TitanBehavior {
    update(entityId, ai, transform, physics, scene, deltaTime) {
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
                    
                    scene.effectsSystem.createShockwave(
                        transform.x,
                        transform.y,
                        0xff9966
                    );
                    
                    // Apply explosion force
                    scene.physicsSystem.createExplosionForce(
                        transform.x,
                        transform.y,
                        10,
                        200
                    );
                    
                    AudioManager.play('explosion');
                }
            }
        }
    }
}