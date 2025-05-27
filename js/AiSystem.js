// AISystem.js - Advanced AI behavior system with faction-specific behaviors
// COMPLETE REWRITE: Proper faction behaviors with intelligent combat

class AISystem {
    constructor(scene, eventBus) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.playerId = null;
        
        // Faction behaviors will be initialized after eventBus is available
        this.factionBehaviors = {};
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
        
        // Initialize faction behaviors with eventBus and scene
        this.factionBehaviors = {
            swarm: new SwarmBehavior(this.eventBus, this.entityManager, this.scene),
            sentinel: new SentinelBehavior(this.eventBus, this.entityManager, this.scene),
            phantom: new PhantomBehavior(this.eventBus, this.entityManager, this.scene),
            titan: new TitanBehavior(this.eventBus, this.entityManager, this.scene)
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

// Base behavior class
class BaseBehavior {
    constructor(eventBus, entityManager, scene) {
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.scene = scene;
    }
    
    getDistance(transformA, transformB) {
        const dx = transformB.x - transformA.x;
        const dy = transformB.y - transformA.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    calculateAngle(from, to) {
        return Math.atan2(to.y - from.y, to.x - from.x);
    }
    
    findNearestEnemy(entityId, transform, faction) {
        let nearest = null;
        let minDist = Infinity;
        
        // Check all enemies
        const enemies = this.entityManager.getEntitiesByType('enemy');
        enemies.forEach(otherId => {
            if (otherId === entityId) return;
            
            const otherAI = this.entityManager.getComponent(otherId, 'ai');
            const otherTransform = this.entityManager.getComponent(otherId, 'transform');
            
            if (!otherAI || !otherTransform || otherAI.faction === faction) return;
            
            const dist = this.getDistance(transform, otherTransform);
            if (dist < minDist) {
                minDist = dist;
                nearest = { id: otherId, transform: otherTransform, distance: dist };
            }
        });
        
        return nearest;
    }
    
    findPlayer() {
        const playerEntities = this.entityManager.getEntitiesByType('player');
        if (playerEntities.length === 0) return null;
        
        const playerId = playerEntities[0];
        const transform = this.entityManager.getComponent(playerId, 'transform');
        if (!transform) return null;
        
        return { id: playerId, transform: transform };
    }
    
    applyForce(entityId, forceX, forceY) {
        // Directly apply velocity to enemy instead of using force system
        const physics = this.entityManager.getComponent(entityId, 'physics');
        const sprite = this.scene.sprites.get(entityId);
        
        if (physics && sprite && sprite.body) {
            physics.velocity.x += forceX * 10; // Scale up force to velocity
            physics.velocity.y += forceY * 10;
            
            // Apply velocity to sprite immediately
            sprite.setVelocity(physics.velocity.x, physics.velocity.y);
        }
    }
    
    requestShoot(shooterId, angle) {
        const shooter = this.entityManager.getComponent(shooterId, 'transform');
        if (!shooter) return;
        
        this.eventBus.emit('ENEMY_SHOOT_REQUEST', {
            shooterId: shooterId,
            angle: angle
        });
    }
}

// Swarm behavior - aggressive group attacks
class SwarmBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene) {
        super(eventBus, entityManager, scene);
        this.boidParams = {
            separationRadius: 80,
            alignmentRadius: 150,
            cohesionRadius: 200,
            separationForce: 0.2,
            alignmentForce: 0.1,
            cohesionForce: 0.15,
            attackForce: 0.02
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
            if (playerDist < 1000) {
                swarmTarget = player;
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
        
        // Update AI state
        ai.decisionTimer -= deltaTime * 1000;
        if (ai.decisionTimer <= 0) {
            ai.decisionTimer = 500; // Fast reactions
            ai.aggressionLevel = 0.9;
            ai.fearLevel = 0.1;
        }
        
        // Calculate boid forces
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
            
            // Separation
            if (dist < this.boidParams.separationRadius) {
                forceX -= (dx / dist) * this.boidParams.separationForce / dist;
                forceY -= (dy / dist) * this.boidParams.separationForce / dist;
            }
            
            // Alignment & Cohesion
            if (dist < this.boidParams.alignmentRadius) {
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
            forceX += (avgVelX - physics.velocity.x) * this.boidParams.alignmentForce;
            forceY += (avgVelY - physics.velocity.y) * this.boidParams.alignmentForce;
            
            // Cohesion
            cohesionX /= neighborCount;
            cohesionY /= neighborCount;
            const cohDx = cohesionX - transform.x;
            const cohDy = cohesionY - transform.y;
            forceX += cohDx * this.boidParams.cohesionForce * 0.001;
            forceY += cohDy * this.boidParams.cohesionForce * 0.001;
        }
        
        // Attack target aggressively
        if (swarmTarget) {
            const dx = swarmTarget.transform.x - transform.x;
            const dy = swarmTarget.transform.y - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                // Aggressive pursuit
                forceX += (dx / dist) * this.boidParams.attackForce;
                forceY += (dy / dist) * this.boidParams.attackForce;
                
                // Shoot frequently when in range
                if (dist < 600) {
                    const weapon = this.entityManager.getComponent(entityId, 'weapon');
                    if (weapon && weapon.lastFireTime <= 0 && Math.random() < 0.05) {
                        const angle = Math.atan2(dy, dx);
                        this.requestShoot(entityId, angle);
                    }
                }
            }
        }
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update max speed for aggressive movement
        physics.maxSpeed = 8;
        physics.damping = 0.98;
    }
}

// Sentinel behavior - defensive and tactical
class SentinelBehavior extends BaseBehavior {
    constructor(eventBus, entityManager, scene) {
        super(eventBus, entityManager, scene);
        this.formations = new Map(); // Track formations
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
        if (!ai.memory.guardPoint) {
            ai.memory.guardPoint = { x: transform.x, y: transform.y };
            ai.memory.patrolRadius = 300;
            ai.memory.patrolAngle = Math.random() * Math.PI * 2;
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
                ai.state = 'defending';
                ai.target = threat.id;
                
                // Call for backup
                if (threat.distance < 400 && !ai.memory.calledBackup) {
                    ai.memory.calledBackup = true;
                    this.callForBackup(entityId, transform, allies);
                }
            } else if (player && this.getDistance(transform, player.transform) < 600) {
                ai.state = 'defending';
                ai.target = player.id;
            } else {
                ai.state = 'patrolling';
                ai.target = null;
                ai.memory.calledBackup = false;
            }
        }
        
        // Execute behavior
        let forceX = 0, forceY = 0;
        
        switch (ai.state) {
            case 'defending':
                if (ai.target) {
                    const target = this.entityManager.getComponent(ai.target, 'transform');
                    if (target) {
                        const dx = target.x - transform.x;
                        const dy = target.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        // Maintain defensive distance
                        const idealDist = 400;
                        if (dist < idealDist - 50) {
                            // Back away
                            forceX -= (dx / dist) * 0.008;
                            forceY -= (dy / dist) * 0.008;
                        } else if (dist > idealDist + 50) {
                            // Move closer
                            forceX += (dx / dist) * 0.006;
                            forceY += (dy / dist) * 0.006;
                        }
                        
                        // Strafe around target
                        const strafeAngle = Math.atan2(dy, dx) + Math.PI / 2;
                        forceX += Math.cos(strafeAngle) * 0.004;
                        forceY += Math.sin(strafeAngle) * 0.004;
                        
                        // Shoot tactically
                        const weapon = this.entityManager.getComponent(entityId, 'weapon');
                        if (weapon && weapon.lastFireTime <= 0 && dist < 500) {
                            // Predict target movement
                            const targetPhysics = this.entityManager.getComponent(ai.target, 'physics');
                            if (targetPhysics) {
                                const leadTime = dist / 15; // Projectile speed estimate
                                const predictX = target.x + targetPhysics.velocity.x * leadTime;
                                const predictY = target.y + targetPhysics.velocity.y * leadTime;
                                const angle = Math.atan2(predictY - transform.y, predictX - transform.x);
                                this.requestShoot(entityId, angle);
                            }
                        }
                    }
                }
                break;
                
            case 'patrolling':
                // Patrol around guard point
                ai.memory.patrolAngle += 0.001;
                const patrolX = ai.memory.guardPoint.x + Math.cos(ai.memory.patrolAngle) * ai.memory.patrolRadius;
                const patrolY = ai.memory.guardPoint.y + Math.sin(ai.memory.patrolAngle) * ai.memory.patrolRadius;
                
                const dx = patrolX - transform.x;
                const dy = patrolY - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 50) {
                    forceX += (dx / dist) * 0.005;
                    forceY += (dy / dist) * 0.005;
                }
                break;
        }
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics
        physics.maxSpeed = 5;
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
            if (dist < 800) {
                // Alert ally
                allyAI.state = 'defending';
                allyAI.memory.backupTarget = { x: callerTransform.x, y: callerTransform.y };
            }
        });
    }
}

// Phantom behavior - hit and run tactics
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
        }
        
        // Update timers
        ai.memory.attackTimer -= deltaTime * 1000;
        ai.memory.retreatTimer -= deltaTime * 1000;
        ai.memory.phaseTimer -= deltaTime * 1000;
        
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
                            // Fast approach
                            forceX += (dx / dist) * 0.015;
                            forceY += (dy / dist) * 0.015;
                            
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
                            // Fast retreat
                            forceX += (dx / dist) * 0.018;
                            forceY += (dy / dist) * 0.018;
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
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics
        physics.maxSpeed = ai.memory.isPhased ? 10 : 7;
        physics.damping = 0.97;
    }
}

// Titan behavior - fearless and powerful
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
        }
        
        // Update timers
        ai.memory.chargeTimer -= deltaTime * 1000;
        ai.memory.shockwaveTimer -= deltaTime * 1000;
        
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
                ai.state = 'charging';
                ai.target = target.id;
                
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
            case 'charging':
                if (ai.target) {
                    const target = this.entityManager.getComponent(ai.target, 'transform');
                    if (target) {
                        const dx = target.x - transform.x;
                        const dy = target.y - transform.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        
                        if (dist > 0) {
                            // Fearless charge with rage boost
                            const chargeForce = 0.025 * (1 + ai.memory.rageLevel);
                            forceX += (dx / dist) * chargeForce;
                            forceY += (dy / dist) * chargeForce;
                            
                            // Shockwave attack when very close
                            if (dist < 200 && ai.memory.shockwaveTimer <= 0) {
                                ai.memory.shockwaveTimer = 3000;
                                
                                // Create shockwave
                                this.eventBus.emit('TITAN_SHOCKWAVE', {
                                    entityId: entityId,
                                    x: transform.x,
                                    y: transform.y
                                });
                                
                                // Screen shake for impact
                                this.eventBus.emit('CAMERA_SHAKE', {
                                    duration: 500,
                                    intensity: 0.02
                                });
                            }
                            
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
        
        // Apply forces
        this.applyForce(entityId, forceX, forceY);
        
        // Update physics - slow but unstoppable
        physics.maxSpeed = 4 + ai.memory.rageLevel * 2;
        physics.damping = 0.999;
        physics.mass = 30; // Heavy
    }
}

window.AiSystem = AISystem;