// WeaponSystem.js - Handles weapon state and projectile creation only
// REFACTORED: Removed collision detection and direct entity destruction

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
        
        window.EventBus.on(window.GameEvents.ENEMY_SHOOT, (data) => {
            this.handleEnemyShoot(data);
        });
        
        // Listen for projectile expiration
        window.EventBus.on(window.GameEvents.PROJECTILE_EXPIRED, (data) => {
            this.projectiles.delete(data.projectileId);
            window.EventBus.emit(window.GameEvents.DESTROY_ENTITY, {
                entityId: data.projectileId
            });
        });
        
        // Listen for entity destruction to clean up projectiles
        window.EventBus.on(window.GameEvents.ENTITY_DESTROYED, (data) => {
            this.projectiles.delete(data.id);
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
                
                // Emit charge update for UI
                if (entityId === this.scene.player) {
                    const chargePercent = (weapon.chargeTime / weapon.maxChargeTime) * 100;
                    window.EventBus.emit(window.GameEvents.PLAYER_CHARGE_UPDATE, {
                        percent: chargePercent
                    });
                }
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
                    window.EventBus.emit(window.GameEvents.PROJECTILE_EXPIRED, {
                        projectileId: projectileId
                    });
                }
            }
        });
    }
    
    handlePlayerShoot(data) {
        const weapon = this.entityManager.getComponent(this.scene.player, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return;
        
        this.fireWeapon(this.scene.player, data.angle);
    }
    
    handleEnemyShoot(data) {
        const weapon = this.entityManager.getComponent(data.shooterId, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return;
        
        this.fireWeapon(data.shooterId, data.angle);
    }
    
    fireWeapon(shooterId, angle) {
        const weapon = this.entityManager.getComponent(shooterId, 'weapon');
        const transform = this.entityManager.getComponent(shooterId, 'transform');
        const shooterEntity = this.entityManager.getEntity(shooterId);
        
        if (!weapon || !transform || !shooterEntity || weapon.lastFireTime > 0) return;
        
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
        
        // Apply recoil force
        const recoilForce = 0.5 * (1 + chargeLevel);
        window.EventBus.emit(window.GameEvents.FORCE_APPLIED, {
            entityId: shooterId,
            force: {
                x: -Math.cos(angle) * recoilForce,
                y: -Math.sin(angle) * recoilForce
            }
        });
        
        // Update weapon state
        weapon.lastFireTime = weapon.fireRate;
        weapon.chargeTime = 0;
        
        // Emit projectile created event
        window.EventBus.emit(window.GameEvents.PROJECTILE_CREATED, {
            projectileId: projectileId,
            shooterId: shooterId,
            isCharged: isCharged,
            position: { x: spawnX, y: spawnY }
        });
        
        // Play sound
        AudioManager.play(isCharged ? 'explosion' : 'shoot');
        
        // Request camera shake for charged player shots
        if (isCharged && shooterId === this.scene.player) {
            window.EventBus.emit(window.GameEvents.CAMERA_SHAKE, {
                duration: 200,
                intensity: 0.01
            });
        }
        
        return projectileId;
    }
    
    getProjectileCount() {
        return this.projectiles.size;
    }
    
    clearAllProjectiles() {
        this.projectiles.forEach((value, projectileId) => {
            window.EventBus.emit(window.GameEvents.DESTROY_ENTITY, {
                entityId: projectileId
            });
        });
        this.projectiles.clear();
    }
}