// WeaponSystem.js - Handles all weapon firing and projectile management

class WeaponSystem {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = new Map();
        this.entityFactory = null;
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
        this.entityFactory = new EntityFactory(this.scene);
        
        // Listen for shooting events
        window.EventBus.on(window.GameEvents.PLAYER_SHOOT, (data) => {
            if (!data.charging) {
                this.handlePlayerShoot(data);
            }
        });
    }
    
    update(deltaTime, entityManager) {
        // Update all entities with weapons
        const weaponEntities = entityManager.query('weapon', 'transform');
        
        weaponEntities.forEach(entityId => {
            const weapon = entityManager.getComponent(entityId, 'weapon');
            
            // Update charge time if charging
            if (weapon.charging) {
                weapon.chargeTime = Math.min(
                    weapon.chargeTime + deltaTime * 1000,
                    weapon.maxChargeTime
                );
            }
            
            // Cool down weapon
            if (weapon.lastFireTime > 0) {
                weapon.lastFireTime = Math.max(0, weapon.lastFireTime - deltaTime * 1000);
            }
        });
        
        // Update projectile lifetimes
        const projectiles = entityManager.getEntitiesByType('projectile');
        projectiles.forEach(projectileId => {
            const lifetime = entityManager.getComponent(projectileId, 'lifetime');
            if (lifetime) {
                lifetime.elapsed += deltaTime * 1000;
                
                if (lifetime.elapsed >= lifetime.duration) {
                    this.destroyProjectile(projectileId);
                }
            }
        });
        
        // Check projectile collisions
        this.checkProjectileCollisions();
    }
    
    handlePlayerShoot(data) {
        const weapon = this.entityManager.getComponent(this.scene.player, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return;
        
        this.fireWeapon(this.scene.player, data.angle);
    }
    
    fireWeapon(shooterId, angle) {
        const weapon = this.entityManager.getComponent(shooterId, 'weapon');
        const transform = this.entityManager.getComponent(shooterId, 'transform');
        const shooterSprite = this.scene.sprites.get(shooterId);
        
        if (!weapon || !transform || !shooterSprite || weapon.lastFireTime > 0) return;
        
        // Calculate charge level
        const chargeLevel = weapon.chargeTime / weapon.maxChargeTime;
        const isCharged = chargeLevel > 0.5;
        
        // Calculate projectile properties
        const damage = weapon.damage * (1 + chargeLevel);
        const speed = weapon.projectileSpeed * (1 + chargeLevel * 0.5);
        const size = isCharged ? 12 : 8;
        
        // Spawn position (in front of shooter)
        const spawnDistance = 60;
        const spawnX = transform.x + Math.cos(angle) * spawnDistance;
        const spawnY = transform.y + Math.sin(angle) * spawnDistance;
        
        // Create projectile
        const projectileId = this.entityFactory.createProjectile(
            shooterId, spawnX, spawnY, angle, speed, damage, size, isCharged
        );
        
        this.projectiles.set(projectileId, true);
        
        // Apply recoil
        const recoilForce = 0.5 * (1 + chargeLevel);
        shooterSprite.applyForce({
            x: -Math.cos(angle) * recoilForce,
            y: -Math.sin(angle) * recoilForce
        });
        
        // Update weapon state
        weapon.lastFireTime = weapon.fireRate;
        weapon.chargeTime = 0;
        
        // Effects
        AudioManager.play(isCharged ? 'explosion' : 'shoot');
        if (isCharged && shooterId === this.scene.player) {
            this.scene.renderSystem.shake(200, 0.01);
        }
        
        return projectileId;
    }
    
    checkProjectileCollisions() {
        const projectiles = this.entityManager.getEntitiesByType('projectile');
        
        projectiles.forEach(projectileId => {
            const sprite = this.scene.sprites.get(projectileId);
            if (!sprite || !sprite.active) return;
            
            const projectileData = this.entityManager.getComponent(projectileId, 'projectile');
            if (!projectileData) return;
            
            // Check collision with all bodies
            const bodies = this.scene.matter.world.getAllBodies();
            
            bodies.forEach(body => {
                if (body === sprite.body || !body.gameObject) return;
                
                // Check collision
                const collision = this.scene.matter.collision.collides(sprite.body, body);
                if (!collision) return;
                
                // Find entity for this body
                let targetEntity = null;
                this.scene.sprites.forEach((targetSprite, entityId) => {
                    if (targetSprite.body === body) {
                        targetEntity = entityId;
                    }
                });
                
                if (!targetEntity) return;
                
                // Check if already hit
                if (projectileData.hitEntities.has(targetEntity)) return;
                
                // Check if can damage
                if (!this.canDamageTarget(projectileId, targetEntity)) return;
                
                // Mark as hit
                projectileData.hitEntities.add(targetEntity);
                
                // Emit hit event
                window.EventBus.emit(window.GameEvents.PROJECTILE_HIT, {
                    projectileId: projectileId,
                    targetId: targetEntity,
                    damage: projectileData.damage
                });
                
                // Destroy if not penetrating
                if (!projectileData.penetrating) {
                    this.destroyProjectile(projectileId);
                }
            });
        });
    }
    
    canDamageTarget(projectileId, targetId) {
        const projectileData = this.entityManager.getComponent(projectileId, 'projectile');
        const targetEntity = this.entityManager.getEntity(targetId);
        
        if (!projectileData || !targetEntity) return false;
        
        // Can't damage self
        if (projectileData.ownerId === targetId) return false;
        
        // Can't damage other projectiles or powerups
        if (targetEntity.type === 'projectile' || targetEntity.type === 'powerup') return false;
        
        // Check factions
        const targetFaction = this.entityManager.getComponent(targetId, 'faction');
        if (targetFaction && projectileData.ownerFaction) {
            if (targetFaction.name === projectileData.ownerFaction) return false;
            if (targetFaction.friendlyWith.has(projectileData.ownerFaction)) return false;
        }
        
        return true;
    }
    
    destroyProjectile(projectileId) {
        const sprite = this.scene.sprites.get(projectileId);
        if (!sprite) return;
        
        // Create impact effect
        window.EventBus.emit(window.GameEvents.EXPLOSION, {
            x: sprite.x,
            y: sprite.y,
            type: 'impact',
            scale: 0.5
        });
        
        // Clean up
        this.projectiles.delete(projectileId);
        sprite.destroy();
        this.scene.sprites.delete(projectileId);
        
        // Remove trail
        const trail = this.scene.trails.get(projectileId);
        if (trail) {
            trail.destroy();
            this.scene.trails.delete(projectileId);
        }
        
        this.entityManager.destroyEntity(projectileId);
    }
    
    // Enemy shooting
    enemyShoot(enemyId, targetId) {
        const enemy = this.entityManager.getEntity(enemyId);
        const target = this.entityManager.getEntity(targetId);
        
        if (!enemy || !target) return;
        
        const angle = this.calculateAngleToTarget(enemyId, targetId);
        
        // Add inaccuracy based on AI
        const ai = this.entityManager.getComponent(enemyId, 'ai');
        const accuracy = 1 - (ai.fearLevel * 0.3);
        const spread = (1 - accuracy) * 0.3;
        const finalAngle = angle + (Math.random() - 0.5) * spread;
        
        return this.fireWeapon(enemyId, finalAngle);
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