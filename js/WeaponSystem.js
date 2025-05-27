// WeaponSystem.js - Handles weapon state and projectile creation only
// REFACTORED: Removed collision detection and direct entity destruction

class WeaponSystem {
    constructor(scene, eventBus, entityManager, entityFactory) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.entityFactory = entityFactory;
        this.projectiles = new Map();
        this.playerId = null;
    }
    
    init() {
        // Listen for player creation
        this.eventBus.on('ENTITY_CREATED', (data) => {
            if (data.type === 'player') {
                this.playerId = data.id;
                console.log('[WeaponSystem] Player ID set:', this.playerId);
            }
        });
        
        // Listen for shooting events
        this.eventBus.on('PLAYER_SHOOT', (data) => {
            if (!data.charging) {
                this.handlePlayerShoot(data);
            }
        });
        
        this.eventBus.on('ENEMY_SHOOT_REQUEST', (data) => {
            this.handleEnemyShoot(data);
        });
        
        // Listen for projectile expiration
        this.eventBus.on('PROJECTILE_EXPIRED', (data) => {
            this.projectiles.delete(data.projectileId);
            this.eventBus.emit('DESTROY_ENTITY', {
                entityId: data.projectileId
            });
        });
        
        // Listen for entity destruction to clean up projectiles
        this.eventBus.on('ENTITY_DESTROYED', (data) => {
            this.projectiles.delete(data.id);
        });
    }
    
    update(deltaTime) {
        // Update all entities with weapons
        const weaponEntities = this.entityManager.query('weapon', 'transform');
        
        weaponEntities.forEach(entityId => {
            const weapon = this.entityManager.getComponent(entityId, 'weapon');
            
            // Update charge time if charging
            if (weapon.charging) {
                weapon.chargeTime = Math.min(
                    weapon.chargeTime + deltaTime * 1000,
                    weapon.maxChargeTime
                );
                
                // Emit charge update for UI
                if (entityId === this.playerId) {
                    const chargePercent = (weapon.chargeTime / weapon.maxChargeTime) * 100;
                    this.eventBus.emit('PLAYER_CHARGE_UPDATE', {
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
        const projectiles = this.entityManager.getEntitiesByType('projectile');
        projectiles.forEach(projectileId => {
            const lifetime = this.entityManager.getComponent(projectileId, 'lifetime');
            if (lifetime) {
                lifetime.elapsed += deltaTime * 1000;
                
                if (lifetime.elapsed >= lifetime.duration) {
                    this.eventBus.emit('PROJECTILE_EXPIRED', {
                        projectileId: projectileId
                    });
                }
            }
        });
    }
    
    handlePlayerShoot(data) {
        if (!this.playerId) return;
        const weapon = this.entityManager.getComponent(this.playerId, 'weapon');
        if (!weapon || weapon.lastFireTime > 0) return;
        
        this.fireWeapon(this.playerId, data.angle);
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
        this.eventBus.emit('FORCE_APPLIED', {
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
        this.eventBus.emit('PROJECTILE_CREATED', {
            projectileId: projectileId,
            shooterId: shooterId,
            isCharged: isCharged,
            position: { x: spawnX, y: spawnY }
        });
        
        // Play sound
        this.eventBus.emit('AUDIO_PLAY', { sound: isCharged ? 'explosion' : 'shoot' });
        
        // Request camera shake for charged player shots
        if (isCharged && shooterId === this.playerId) {
            this.eventBus.emit('CAMERA_SHAKE', {
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
            this.eventBus.emit('DESTROY_ENTITY', {
                entityId: projectileId
            });
        });
        this.projectiles.clear();
    }
}

window.WeaponSystem = WeaponSystem;