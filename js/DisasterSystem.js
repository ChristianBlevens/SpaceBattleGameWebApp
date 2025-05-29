class DisasterSystem {
    constructor(scene) {
        this.scene = scene;
        this.eventBus = null;
        this.entityManager = null;
        this.renderSystem = null;
        this.currentDisaster = null;
        this.disasterTimer = 0;
        this.nextDisasterTime = GameConstants.DISASTERS.MIN_INTERVAL + Math.random() * (GameConstants.DISASTERS.MAX_INTERVAL - GameConstants.DISASTERS.MIN_INTERVAL);
        this.disasters = [
            'meteorShower',
            'blackHole', 
            'solarFlare',
            'gravityStorm',
            'asteroidField',
            'ionStorm',
            'spaceTornado',
            'cosmicRift'
        ];
        this.warningTime = 3000; // 3 second warning
        this.warningActive = false;
        
        // Disaster-specific entities
        this.disasterEntities = [];
    }
    
    init() {
        //console.log('[DisasterSystem] Initializing...');
        // Get references to other systems
        this.entityManager = this.scene.gameInitializer?.entityManager;
        this.renderSystem = this.scene.gameInitializer?.renderSystem;
        
        // Set up eventBus if not already set
        if (!this.eventBus && this.scene.gameInitializer) {
            this.eventBus = this.scene.gameInitializer.eventBus;
        }
        
        //console.log('[DisasterSystem] Init complete. Next disaster in:', this.nextDisasterTime, 'ms');
        //console.log('[DisasterSystem] EntityManager:', !!this.entityManager);
        //console.log('[DisasterSystem] EventBus:', !!this.eventBus);
        //console.log('[DisasterSystem] Scene:', !!this.scene);
        //console.log('[DisasterSystem] Scene.sprites:', !!this.scene?.sprites);
        //console.log('[DisasterSystem] Scene.matter:', !!this.scene?.matter);
    }
    
    update(delta) {
        // Convert delta from milliseconds to match nextDisasterTime
        this.disasterTimer += delta * 1000;
        
        // Debug log every 2 seconds
        //if (Math.floor(this.disasterTimer / 2000) > Math.floor((this.disasterTimer - delta * 1000) / 2000)) {
            //console.log('[DisasterSystem] Timer:', Math.floor(this.disasterTimer / 1000), 's / Next at:', Math.floor(this.nextDisasterTime / 1000), 's');
            //console.log('[DisasterSystem] EntityManager available:', !!this.entityManager);
            //console.log('[DisasterSystem] EventBus available:', !!this.eventBus);
        //}
        
        // Check if it's time for a new disaster
        if (!this.currentDisaster && this.disasterTimer >= this.nextDisasterTime) {
            //console.log('[DisasterSystem] Starting random disaster!');
            //console.log('[DisasterSystem] Timer:', this.disasterTimer, 'NextTime:', this.nextDisasterTime);
            this.startRandomDisaster();
        }
        
        // Update warning
        if (this.warningActive && this.disasterTimer >= this.nextDisasterTime - this.warningTime) {
            this.warningActive = false;
        }
        
        // Update current disaster
        if (this.currentDisaster) {
            this.updateDisaster(delta * 1000);
        }
        
        // Show warning when disaster is approaching
        if (!this.warningActive && !this.currentDisaster && 
            this.disasterTimer >= this.nextDisasterTime - this.warningTime) {
            this.showWarning();
            this.warningActive = true;
        }
    }
    
    startRandomDisaster() {
        const disasterType = this.disasters[Math.floor(Math.random() * this.disasters.length)];
        //console.log('[DisasterSystem] Selected disaster type:', disasterType);
        this.startDisaster(disasterType);
    }
    
    startDisaster(type) {
        //console.log('[DisasterSystem] Starting disaster:', type);
        //console.log('[DisasterSystem] Scene available:', !!this.scene);
        //console.log('[DisasterSystem] Scene.sprites available:', !!this.scene?.sprites);
        //console.log('[DisasterSystem] Scene.matter available:', !!this.scene?.matter);
        
        this.currentDisaster = {
            type: type,
            timer: 0,
            duration: this.getDisasterDuration(type),
            data: {}
        };
        
        //console.log('[DisasterSystem] Disaster duration:', this.currentDisaster.duration);
        
        // Notify UI
        if (this.eventBus) {
            //console.log('[DisasterSystem] Emitting disasterStart event');
            this.eventBus.emit('disasterStart', {
                type: type,
                name: this.getDisasterName(type),
                duration: this.currentDisaster.duration
            });
        } else {
            //console.error('[DisasterSystem] No eventBus available!');
        }
        
        // Initialize specific disaster
        switch(type) {
            case 'meteorShower':
                this.startMeteorShower();
                break;
            case 'blackHole':
                this.startBlackHole();
                break;
            case 'solarFlare':
                this.startSolarFlare();
                break;
            case 'gravityStorm':
                this.startGravityStorm();
                break;
            case 'asteroidField':
                this.startAsteroidField();
                break;
            case 'ionStorm':
                this.startIonStorm();
                break;
            case 'spaceTornado':
                this.startSpaceTornado();
                break;
            case 'cosmicRift':
                this.startCosmicRift();
                break;
        }
    }
    
    updateDisaster(delta) {
        this.currentDisaster.timer += delta;
        
        // Debug log
        if (!this.currentDisaster.updateLogged) {
            //console.log('[DisasterSystem] updateDisaster called - type:', this.currentDisaster.type, 'delta:', delta);
            this.currentDisaster.updateLogged = true;
        }
        
        // Update specific disaster
        switch(this.currentDisaster.type) {
            case 'meteorShower':
                this.updateMeteorShower(delta);
                break;
            case 'blackHole':
                this.updateBlackHole(delta);
                break;
            case 'solarFlare':
                this.updateSolarFlare(delta);
                break;
            case 'gravityStorm':
                this.updateGravityStorm(delta);
                break;
            case 'asteroidField':
                this.updateAsteroidField(delta);
                break;
            case 'ionStorm':
                this.updateIonStorm(delta);
                break;
            case 'spaceTornado':
                this.updateSpaceTornado(delta);
                break;
            case 'cosmicRift':
                this.updateCosmicRift(delta);
                break;
        }
        
        // Check if disaster should end
        if (this.currentDisaster.timer >= this.currentDisaster.duration) {
            this.endDisaster();
        }
    }
    
    endDisaster() {
        // Clean up disaster-specific effects
        switch(this.currentDisaster.type) {
            case 'blackHole':
                this.endBlackHole();
                break;
            case 'solarFlare':
                this.endSolarFlare();
                break;
            case 'gravityStorm':
                this.endGravityStorm();
                break;
            case 'ionStorm':
                this.endIonStorm();
                break;
            case 'spaceTornado':
                this.endSpaceTornado();
                break;
            case 'cosmicRift':
                this.endCosmicRift();
                break;
        }
        
        // Clean up all disaster entities
        this.disasterEntities.forEach(entity => {
            if (entity.type === 'meteor') {
                if (entity.meteor && entity.meteor.active) entity.meteor.destroy();
                if (entity.glow && entity.glow.active) entity.glow.destroy();
            } else if (entity.type === 'blackHole') {
                if (entity.blackHole && entity.blackHole.active) entity.blackHole.destroy();
                if (entity.rings) {
                    entity.rings.forEach(ring => {
                        if (ring && ring.active) ring.destroy();
                    });
                }
            } else if (typeof entity === 'number') {
                // Old style entity ID - clean up sprite
                const sprite = this.scene.sprites.get(entity);
                if (sprite) {
                    sprite.destroy();
                    this.scene.sprites.delete(entity);
                }
                this.entityManager.destroyEntity(entity);
            }
        });
        this.disasterEntities = [];
        
        // Notify UI
        this.eventBus.emit('disasterEnd', {
            type: this.currentDisaster.type
        });
        
        // Reset for next disaster
        this.currentDisaster = null;
        this.disasterTimer = 0;
        this.nextDisasterTime = 120000 + Math.random() * 60000; // 2-3 minutes (normal)
        this.warningActive = false;
    }
    
    // Meteor Shower - rains down meteors that damage on impact
    startMeteorShower() {
        //console.log('[DisasterSystem] Starting Meteor Shower');
        this.currentDisaster.data.nextMeteor = 0;
        this.currentDisaster.data.meteorInterval = 200; // Spawn meteor every 200ms
        this.currentDisaster.data.meteorCount = 0;
    }
    
    updateMeteorShower(delta) {
        this.currentDisaster.data.nextMeteor -= delta;
        
        // Debug log
        if (!this.currentDisaster.data.loggedOnce) {
            //console.log('[DisasterSystem] updateMeteorShower - delta:', delta, 'nextMeteor:', this.currentDisaster.data.nextMeteor);
            this.currentDisaster.data.loggedOnce = true;
        }
        
        if (this.currentDisaster.data.nextMeteor <= 0) {
            this.spawnMeteor();
            this.currentDisaster.data.nextMeteor = this.currentDisaster.data.meteorInterval;
        }
    }
    
    spawnMeteor() {
        this.currentDisaster.data.meteorCount++;
        //console.log('[DisasterSystem] Spawning meteor #', this.currentDisaster.data.meteorCount);
        
        const startX = Math.random() * this.scene.sys.game.config.width;
        const startY = -50;
        const targetX = startX + (Math.random() - 0.5) * 400;
        const targetY = this.scene.sys.game.config.height + 50;
        
        const angle = Math.atan2(targetY - startY, targetX - startX);
        const speed = 3 + Math.random() * 2; // Reduced speed for visibility
        
        const scale = 2 + Math.random(); // Larger scale
        
        // Create visual meteor using simple graphics
        const meteor = this.scene.add.circle(startX, startY, 15 * scale, 0xff6600);
        meteor.setDepth(30);
        
        // Add glow effect
        const glow = this.scene.add.circle(startX, startY, 20 * scale, 0xff6600, 0.3);
        glow.setDepth(29);
        
        // Store for cleanup
        this.disasterEntities.push({ meteor, glow, type: 'meteor' });
        
        // Simple movement
        this.scene.tweens.add({
            targets: [meteor, glow],
            x: targetX,
            y: targetY,
            duration: 3000,
            onComplete: () => {
                meteor.destroy();
                glow.destroy();
            }
        });
        
        // Check collision with player manually
        const checkCollision = () => {
            if (!meteor.active) return;
            
            const playerSprite = this.scene.sprites.get(this.scene.player);
            if (playerSprite) {
                const dx = meteor.x - playerSprite.x;
                const dy = meteor.y - playerSprite.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 30 * scale) {
                    // Use area damage for meteor impact
                    this.eventBus.emit('AREA_DAMAGE', {
                        x: meteor.x,
                        y: meteor.y,
                        radius: 60 * scale,
                        damage: GameConstants.DISASTERS.METEOR_SHOWER.DAMAGE,
                        sourceId: null,
                        options: {
                            falloff: true,
                            knockback: 200,
                            damageType: 'meteor'
                        }
                    });
                    
                    // Create explosion effect
                    this.createExplosionEffect(meteor.x, meteor.y, 0xff6600, scale);
                    
                    // Destroy meteor
                    meteor.destroy();
                    glow.destroy();
                    return;
                }
            }
            
            // Continue checking
            if (meteor.active) {
                this.scene.time.delayedCall(50, checkCollision);
            }
        };
        
        checkCollision();
    }
    
    // Black Hole - pulls everything toward center
    startBlackHole() {
        const centerX = this.scene.sys.game.config.width / 2;
        const centerY = this.scene.sys.game.config.height / 2;
        
        // Create visual black hole using graphics
        const blackHole = this.scene.add.circle(centerX, centerY, 50, 0x000000);
        blackHole.setDepth(5);
        
        // Add swirling effect rings
        const rings = [];
        for (let i = 0; i < 3; i++) {
            const ring = this.scene.add.circle(centerX, centerY, 80 + i * 40, 0x6600ff, 0.3 - i * 0.1);
            ring.setDepth(4);
            rings.push(ring);
            
            // Animate rings
            this.scene.tweens.add({
                targets: ring,
                scaleX: 1.5,
                scaleY: 1.5,
                alpha: 0,
                duration: 2000,
                repeat: -1,
                delay: i * 500
            });
        }
        
        // Add rotation animation to black hole
        this.scene.tweens.add({
            targets: blackHole,
            angle: 360,
            duration: 3000,
            repeat: -1
        });
        
        // Store for cleanup and effects
        this.currentDisaster.data.blackHole = blackHole;
        this.currentDisaster.data.rings = rings;
        this.currentDisaster.data.centerX = centerX;
        this.currentDisaster.data.centerY = centerY;
        this.currentDisaster.data.force = 200;
        this.currentDisaster.data.damageRadius = 80;
        this.currentDisaster.data.damage = 10;
        
        this.disasterEntities.push({ blackHole, rings, type: 'blackHole' });
    }
    
    updateBlackHole(delta) {
        if (!this.currentDisaster.data.blackHole) return;
        
        const centerX = this.currentDisaster.data.centerX;
        const centerY = this.currentDisaster.data.centerY;
        const force = this.currentDisaster.data.force;
        const damageRadius = this.currentDisaster.data.damageRadius;
        const damage = this.currentDisaster.data.damage;
        
        // Apply pull to player
        const playerSprite = this.scene.sprites.get(this.scene.player);
        if (playerSprite && playerSprite.body) {
            const dx = centerX - playerSprite.x;
            const dy = centerY - playerSprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 20) { // Don't pull if too close
                // Apply gravitational pull
                const pullForce = force * (300 / Math.max(distance, 100)); // Stronger pull when closer
                const forceX = (dx / distance) * pullForce * (delta / 1000);
                const forceY = (dy / distance) * pullForce * (delta / 1000);
                
                playerSprite.setVelocity(
                    playerSprite.body.velocity.x + forceX,
                    playerSprite.body.velocity.y + forceY
                );
            }
            
            // Apply damage if too close
            if (distance < damageRadius) {
                const damageAmount = GameConstants.DISASTERS.BLACK_HOLE.DAMAGE * (delta / 1000) * (1 - distance / damageRadius);
                const playerId = this.entityManager.getEntitiesByType('player')[0];
                if (playerId) {
                    this.eventBus.emit('DAMAGE_ENTITY', { 
                        entityId: playerId, 
                        damage: damageAmount, 
                        sourceId: null 
                    });
                }
            }
        }
        
        // Apply pull to enemies
        this.scene.enemyGroup.children.entries.forEach(enemy => {
            if (!enemy.active) return;
            
            const dx = centerX - enemy.x;
            const dy = centerY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 20) {
                const pullForce = force * 0.5 * (300 / Math.max(distance, 100));
                const forceX = (dx / distance) * pullForce * (delta / 1000);
                const forceY = (dy / distance) * pullForce * (delta / 1000);
                
                enemy.setVelocity(
                    enemy.body.velocity.x + forceX,
                    enemy.body.velocity.y + forceY
                );
            }
        });
    }
    
    endBlackHole() {
        // Visual effect on collapse
        if (this.currentDisaster.data.blackHole) {
            this.createExplosionEffect(
                this.currentDisaster.data.centerX, 
                this.currentDisaster.data.centerY, 
                0x9900ff, 
                3
            );
            
            // Clean up visuals
            this.currentDisaster.data.blackHole.destroy();
            this.currentDisaster.data.rings.forEach(ring => ring.destroy());
        }
    }
    
    // Solar Flare - screen-wide damage wave
    startSolarFlare() {
        this.currentDisaster.data.waveCount = 0;
        this.currentDisaster.data.nextWave = 0;
        this.currentDisaster.data.waveInterval = 3000;
        
        // Visual warning
        this.scene.cameras.main.flash(500, 255, 200, 0);
    }
    
    updateSolarFlare(delta) {
        this.currentDisaster.data.nextWave -= delta;
        
        if (this.currentDisaster.data.nextWave <= 0) {
            this.createSolarWave();
            this.currentDisaster.data.nextWave = this.currentDisaster.data.waveInterval;
            this.currentDisaster.data.waveCount++;
        }
    }
    
    createSolarWave() {
        // Flash effect
        this.scene.cameras.main.flash(500, 255, 200, 0);
        
        // Create visual wave effect
        const wave = this.scene.add.circle(
            this.scene.sys.game.config.width / 2,
            this.scene.sys.game.config.height / 2,
            50,
            0xffaa00,
            0.8
        );
        wave.setDepth(100);
        
        // Expand wave
        this.scene.tweens.add({
            targets: wave,
            scaleX: 30,
            scaleY: 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => wave.destroy()
        });
        
        // Damage player
        const playerHealth = this.scene.gameInitializer?.gameState?.get('player.health');
        if (playerHealth) {
            const playerId = this.entityManager.getEntitiesByType('player')[0];
            if (playerId) {
                this.eventBus.emit('DAMAGE_ENTITY', { 
                    entityId: playerId, 
                    damage: GameConstants.DISASTERS.SOLAR_FLARE.WAVE_DAMAGE, 
                    sourceId: null 
                });
            }
        }
        
        // Damage enemies
        this.scene.enemyGroup.children.entries.forEach(enemy => {
            if (enemy.active) {
                const entityId = enemy.getData('entityId');
                if (entityId) {
                    const health = this.entityManager.getComponent(entityId, 'health');
                    if (health) {
                        health.current -= 10;
                    }
                }
            }
        });
    }
    
    endSolarFlare() {
        // No cleanup needed
    }
    
    // Gravity Storm - reverses/randomizes gravity
    startGravityStorm() {
        this.currentDisaster.data.lastChange = 0;
        this.currentDisaster.data.changeInterval = 2000;
        // Note: Gravity manipulation disabled as it's not compatible with current physics system
        // Would need to implement custom gravity effects through velocity modifications
        
        // Visual effect to indicate gravity distortion
        this.scene.cameras.main.shake(300, 0.005);
    }
    
    updateGravityStorm(delta) {
        this.currentDisaster.data.lastChange += delta;
        
        if (this.currentDisaster.data.lastChange >= this.currentDisaster.data.changeInterval) {
            // Apply random velocity changes to simulate gravity shifts
            const entities = this.entityManager.query('position', 'velocity');
            const angle = Math.random() * Math.PI * 2;
            const strength = 20 + Math.random() * 30;
            
            entities.forEach(entityId => {
                const vel = this.entityManager.getComponent(entityId, 'velocity');
                if (vel) {
                    vel.x += Math.cos(angle) * strength;
                    vel.y += Math.sin(angle) * strength;
                }
            });
            
            // Camera shake for visual effect
            this.scene.cameras.main.shake(200, 0.003);
            
            this.currentDisaster.data.lastChange = 0;
        }
    }
    
    endGravityStorm() {
        // No cleanup needed - velocities will normalize naturally
    }
    
    // Asteroid Field - multiple slow-moving obstacles
    startAsteroidField() {
        const asteroidCount = 15 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < asteroidCount; i++) {
            this.spawnAsteroid();
        }
    }
    
    updateAsteroidField(delta) {
        // Asteroids just drift, no special update needed
    }
    
    spawnAsteroid() {
        const asteroidId = this.entityManager.createEntity();
        this.disasterEntities.push(asteroidId);
        
        // Spawn from edges
        const side = Math.floor(Math.random() * 4);
        let x, y, vx, vy;
        
        switch(side) {
            case 0: // Top
                x = Math.random() * this.scene.sys.game.config.width;
                y = -50;
                vx = (Math.random() - 0.5) * 50;
                vy = 20 + Math.random() * 30;
                break;
            case 1: // Right
                x = this.scene.sys.game.config.width + 50;
                y = Math.random() * this.scene.sys.game.config.height;
                vx = -(20 + Math.random() * 30);
                vy = (Math.random() - 0.5) * 50;
                break;
            case 2: // Bottom
                x = Math.random() * this.scene.sys.game.config.width;
                y = this.scene.sys.game.config.height + 50;
                vx = (Math.random() - 0.5) * 50;
                vy = -(20 + Math.random() * 30);
                break;
            case 3: // Left
                x = -50;
                y = Math.random() * this.scene.sys.game.config.height;
                vx = 20 + Math.random() * 30;
                vy = (Math.random() - 0.5) * 50;
                break;
        }
        
        this.entityManager.addComponent(asteroidId, 'position', { x, y });
        this.entityManager.addComponent(asteroidId, 'velocity', { x: vx, y: vy });
        
        const size = 1 + Math.random() * 2;
        this.entityManager.addComponent(asteroidId, 'sprite', {
            texture: 'enemy',
            tint: 0x8b7355,
            scale: size
        });
        
        this.entityManager.addComponent(asteroidId, 'collider', {
            radius: 15 * size,
            type: 'asteroid',
            damage: 10 * size
        });
        
        this.entityManager.addComponent(asteroidId, 'health', {
            current: 50 * size,
            max: 50 * size
        });
        
        this.entityManager.addComponent(asteroidId, 'rotation', {
            angle: 0,
            speed: (Math.random() - 0.5) * 2
        });
    }
    
    // Ion Storm - disables abilities and slows movement
    startIonStorm() {
        this.currentDisaster.data.lightningTimer = 0;
        this.currentDisaster.data.lightningInterval = 500;
        
        // Apply debuffs
        const playerEntities = this.entityManager.query('tag');
        const player = playerEntities.find(id => {
            const tag = this.entityManager.getComponent(id, 'tag');
            return tag && tag.value === 'player';
        });
        
        if (player) {
            const movement = this.entityManager.getComponent(player, 'movement');
            if (movement) {
                movement.speedMultiplier = 0.5;
            }
        }
        
        // Disable abilities
        this.eventBus.emit('disableAbilities', true);
        
        // Visual effect
        this.scene.cameras.main.shake(this.currentDisaster.duration, 0.002);
    }
    
    updateIonStorm(delta) {
        this.currentDisaster.data.lightningTimer += delta;
        
        if (this.currentDisaster.data.lightningTimer >= this.currentDisaster.data.lightningInterval) {
            // Create lightning effect
            const x1 = Math.random() * this.scene.sys.game.config.width;
            const y1 = 0;
            const x2 = x1 + (Math.random() - 0.5) * 200;
            const y2 = this.scene.sys.game.config.height;
            
            // Create lightning effect
            this.createLightningEffect(x1, y1, x2, y2);
            this.currentDisaster.data.lightningTimer = 0;
        }
    }
    
    endIonStorm() {
        // Remove debuffs
        const playerEntities = this.entityManager.query('tag');
        const player = playerEntities.find(id => {
            const tag = this.entityManager.getComponent(id, 'tag');
            return tag && tag.value === 'player';
        });
        
        if (player) {
            const movement = this.entityManager.getComponent(player, 'movement');
            if (movement) {
                movement.speedMultiplier = 1;
            }
        }
        
        // Re-enable abilities
        this.eventBus.emit('disableAbilities', false);
    }
    
    // Space Tornado - spinning vortex that moves around
    startSpaceTornado() {
        const tornadoId = this.entityManager.createEntity();
        this.disasterEntities.push(tornadoId);
        
        this.entityManager.addComponent(tornadoId, 'position', {
            x: Math.random() * this.scene.sys.game.config.width,
            y: Math.random() * this.scene.sys.game.config.height
        });
        
        this.entityManager.addComponent(tornadoId, 'velocity', {
            x: (Math.random() - 0.5) * 100,
            y: (Math.random() - 0.5) * 100
        });
        
        this.entityManager.addComponent(tornadoId, 'tornado', {
            force: 200,
            radius: 200,
            rotationSpeed: 5
        });
        
        this.entityManager.addComponent(tornadoId, 'sprite', {
            texture: 'projectile',
            tint: 0x666666,
            scale: 8,
            alpha: 0.3
        });
        
        this.currentDisaster.data.tornadoId = tornadoId;
    }
    
    updateSpaceTornado(delta) {
        const tornado = this.entityManager.getComponent(this.currentDisaster.data.tornadoId, 'tornado');
        const tornadoPos = this.entityManager.getComponent(this.currentDisaster.data.tornadoId, 'position');
        const tornadoVel = this.entityManager.getComponent(this.currentDisaster.data.tornadoId, 'velocity');
        
        if (!tornado || !tornadoPos || !tornadoVel) return;
        
        // Bounce off walls
        if (tornadoPos.x < 50 || tornadoPos.x > this.scene.sys.game.config.width - 50) {
            tornadoVel.x *= -1;
        }
        if (tornadoPos.y < 50 || tornadoPos.y > this.scene.sys.game.config.height - 50) {
            tornadoVel.y *= -1;
        }
        
        // Apply spinning force to nearby entities
        const entities = this.entityManager.query('position', 'velocity');
        
        entities.forEach(entityId => {
            if (entityId === this.currentDisaster.data.tornadoId) return;
            
            const pos = this.entityManager.getComponent(entityId, 'position');
            const vel = this.entityManager.getComponent(entityId, 'velocity');
            
            const dx = pos.x - tornadoPos.x;
            const dy = pos.y - tornadoPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < tornado.radius && distance > 0) {
                // Circular motion around tornado
                const angle = Math.atan2(dy, dx) + tornado.rotationSpeed * (delta / 1000);
                const force = tornado.force * (1 - distance / tornado.radius);
                
                const targetX = tornadoPos.x + Math.cos(angle) * distance;
                const targetY = tornadoPos.y + Math.sin(angle) * distance;
                
                vel.x += (targetX - pos.x) * force * (delta / 1000);
                vel.y += (targetY - pos.y) * force * (delta / 1000);
            }
        });
    }
    
    endSpaceTornado() {
        // No cleanup needed
    }
    
    // Cosmic Rift - creates damaging rifts in space
    startCosmicRift() {
        this.currentDisaster.data.nextRift = 0;
        this.currentDisaster.data.riftInterval = 2000;
        this.currentDisaster.data.rifts = [];
    }
    
    updateCosmicRift(delta) {
        this.currentDisaster.data.nextRift -= delta;
        
        if (this.currentDisaster.data.nextRift <= 0) {
            this.createRift();
            this.currentDisaster.data.nextRift = this.currentDisaster.data.riftInterval;
        }
        
        // Update rifts
        this.currentDisaster.data.rifts.forEach(riftId => {
            const rift = this.entityManager.getComponent(riftId, 'rift');
            if (rift) {
                rift.age += delta;
                
                // Check for entities crossing the rift
                const entities = this.entityManager.query('position', 'health');
                entities.forEach(entityId => {
                    const pos = this.entityManager.getComponent(entityId, 'position');
                    const health = this.entityManager.getComponent(entityId, 'health');
                    
                    // Check if entity crosses the rift line
                    const dist = this.pointToLineDistance(
                        pos.x, pos.y,
                        rift.x1, rift.y1,
                        rift.x2, rift.y2
                    );
                    
                    if (dist < 20) {
                        const damage = GameConstants.DISASTERS.COSMIC_RIFT.DAMAGE * (delta / 1000);
                        this.eventBus.emit('DAMAGE_ENTITY', { 
                            entityId: entityId, 
                            damage: damage, 
                            sourceId: null 
                        });
                    }
                });
            }
        });
    }
    
    createRift() {
        const riftId = this.entityManager.createEntity();
        this.disasterEntities.push(riftId);
        this.currentDisaster.data.rifts.push(riftId);
        
        const x1 = Math.random() * this.scene.sys.game.config.width;
        const y1 = Math.random() * this.scene.sys.game.config.height;
        const angle = Math.random() * Math.PI * 2;
        const length = 100 + Math.random() * 200;
        
        const x2 = x1 + Math.cos(angle) * length;
        const y2 = y1 + Math.sin(angle) * length;
        
        this.entityManager.addComponent(riftId, 'rift', {
            x1, y1, x2, y2,
            damage: GameConstants.DISASTERS.COSMIC_RIFT.DAMAGE,
            age: 0
        });
        
        // Visual representation
        this.entityManager.addComponent(riftId, 'lineSprite', {
            x1, y1, x2, y2,
            color: 0xff00ff,
            width: 3,
            alpha: 0.8
        });
    }
    
    endCosmicRift() {
        // No cleanup needed
    }
    
    // Helper functions
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    showWarning() {
        //console.log('[DisasterSystem] Showing disaster warning');
        if (this.eventBus) {
            this.eventBus.emit('disasterWarning', {
                message: 'Disaster Incoming!',
                time: this.warningTime
            });
        } else {
            //console.error('[DisasterSystem] No eventBus for warning!');
        }
    }
    
    getDisasterDuration(type) {
        const durations = {
            meteorShower: 15000,
            blackHole: 20000,
            solarFlare: 12000,
            gravityStorm: 18000,
            asteroidField: 25000,
            ionStorm: 15000,
            spaceTornado: 20000,
            cosmicRift: 15000
        };
        return durations[type] || 15000;
    }
    
    getDisasterName(type) {
        const names = {
            meteorShower: 'Meteor Shower',
            blackHole: 'Black Hole',
            solarFlare: 'Solar Flare',
            gravityStorm: 'Gravity Storm',
            asteroidField: 'Asteroid Field',
            ionStorm: 'Ion Storm',
            spaceTornado: 'Space Tornado',
            cosmicRift: 'Cosmic Rift'
        };
        return names[type] || 'Unknown Disaster';
    }
    
    // Visual effect helpers
    createExplosionEffect(x, y, color, scale) {
        // Create expanding circles
        for (let i = 0; i < 3; i++) {
            const circle = this.scene.add.circle(x, y, 10, color, 0.8);
            circle.setDepth(100);
            
            this.scene.tweens.add({
                targets: circle,
                scaleX: scale * (i + 1),
                scaleY: scale * (i + 1),
                alpha: 0,
                duration: 500 + i * 200,
                ease: 'Power2',
                onComplete: () => circle.destroy()
            });
        }
    }
    
    createLightningEffect(x1, y1, x2, y2) {
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(3, 0x00ffff, 1);
        graphics.setDepth(100);
        
        // Create jagged lightning path
        const segments = 8;
        graphics.moveTo(x1, y1);
        
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 50;
            const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 50;
            graphics.lineTo(x, y);
        }
        
        graphics.lineTo(x2, y2);
        graphics.strokePath();
        
        // Flash and fade
        this.scene.tweens.add({
            targets: graphics,
            alpha: 0,
            duration: 300,
            onComplete: () => graphics.destroy()
        });
    }
}