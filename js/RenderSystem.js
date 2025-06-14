// RenderSystem.js - Handles ALL sprite rendering, visual updates, effects, and in-game messages
// COMPLETE: Now includes all effects functionality merged from EffectsSystem

class RenderSystem {
    constructor(scene, eventBus, entityManager) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.playerId = null;
        
        // Texture generator
        this.textureGenerator = null;
        
        // Camera settings
        this.cameraZoom = 0.4;
        this.targetZoom = 0.4;
        this.shakeIntensity = 0;
        
        // Active game messages
        this.activeMessages = new Map();
        
        // Active visual effects
        this.activeEffects = [];
        
        // Shield visuals
        this.activeShields = new Map();
        
        // Enemy markers
        this.enemyMarkers = new Map();
        this.markerGraphics = null;
        
        // Gravity well graphics
        this.gravityGraphics = null;
    }
    
    init() {
        // Get player ID
        this.playerId = this.scene.gameState ? this.scene.gameState.getPlayerId() : null;
        
        // Initialize texture generator
        this.textureGenerator = new TextureGenerator(this.scene);
        this.textureGenerator.init();
        
        this.setupCamera();
        this.setupEventListeners();
        
        // Create marker graphics layer
        this.markerGraphics = this.scene.add.graphics();
        this.markerGraphics.setDepth(900); // High depth to render over game but under UI
        
        // Create gravity well graphics layer
        this.gravityGraphics = this.scene.add.graphics();
        this.gravityGraphics.setDepth(10); // Low depth to render behind entities
    }
    
    setupCamera() {
        this.scene.cameras.main.setBounds(0, 0, GameConfig.world.width, GameConfig.world.height);
        this.scene.cameras.main.setZoom(this.cameraZoom);
        
        // Initial camera shake for impact
        this.shake(500, 0.01);
    }
    
    setupEventListeners() {
        // Visual effect events
        this.eventBus.on('POWERUP_CREATED', (data) => {
            this.animatePowerup(data.entityId);
        });
        
        this.eventBus.on('ENEMY_DAMAGED', (data) => {
            this.flashSprite(data.entityId, 0xff0000);
            if (data.position) {
                this.createDamageNumber(
                    data.position.x, 
                    data.position.y, 
                    data.damage
                );
            }
        });
        
        this.eventBus.on('PLAYER_DAMAGED', () => {
            this.shake(200, 0.01);
            this.flash(100, 255, 0, 0, true);
        });
        
        this.eventBus.on('ENEMY_PHASE_CHANGE', (data) => {
            this.setSpriteAlpha(data.entityId, data.alpha);
        });
        
        this.eventBus.on('CAMERA_SHAKE', (data) => {
            this.shake(data.duration, data.intensity);
        });
        
        this.eventBus.on('CAMERA_ZOOM', (data) => {
            // Calculate minimum zoom to prevent seeing outside map
            const viewportWidth = this.scene.cameras.main.width;
            const viewportHeight = this.scene.cameras.main.height;
            const worldWidth = GameConfig.world.width;
            const worldHeight = GameConfig.world.height;
            
            // Minimum zoom is the larger of the two ratios to ensure the entire viewport is filled
            const minZoomX = viewportWidth / worldWidth;
            const minZoomY = viewportHeight / worldHeight;
            const calculatedMinZoom = Math.max(minZoomX, minZoomY) * 1.1; // Add 10% buffer
            
            // Zoom based on scroll direction (flipped)
            const zoomSpeed = 0.2; // Increased speed
            const minZoom = Math.max(0.15, calculatedMinZoom); // Use calculated min or 0.15, whichever is larger
            const maxZoom = 0.4; // Limit zoom in to current default
            
            if (data.delta > 0) {
                // Scroll down - zoom in
                this.targetZoom = Math.max(minZoom, this.targetZoom - zoomSpeed);
            } else {
                // Scroll up - zoom out
                this.targetZoom = Math.min(maxZoom, this.targetZoom + zoomSpeed);
            }
        });
        
        // Game message events
        this.eventBus.on('SHOW_GAME_MESSAGE', (data) => {
            this.createGameMessage(data);
        });
        
        this.eventBus.on('DISMISS_GAME_MESSAGE', (data) => {
            this.dismissGameMessage(data.messageId, data.callback);
        });
        
        // Entity lifecycle events
        this.eventBus.on('ENEMY_SPAWNED', (data) => {
            // Define faction colors inline to avoid dependency issues
            const factionColors = {
                swarm: 0xff69b4,     // Hot pink
                sentinel: 0x66ff66,  // Green
                phantom: 0x9966ff,   // Purple
                titan: 0xff9966      // Orange
            };
            
            const color = factionColors[data.faction] || 0xffffff;
            this.createSpawnEffect(
                data.position.x,
                data.position.y,
                color
            );
        });
        
        this.eventBus.on('CREATE_TRAIL', (data) => {
            const trail = this.scene.add.graphics();
            this.scene.trails.set(data.entityId, trail);
        });
        
        this.eventBus.on('CREATE_SHOCKWAVE_EFFECT', (data) => {
            this.createShockwave(data.x, data.y, data.color);
        });
        
        this.eventBus.on('PLAYER_BOOST_ACTIVATED', (data) => {
            this.setSpriteTint(data.entityId, 0xffff00);
            this.createBoostEffect(data.entityId);
        });
        
        this.eventBus.on('PLAYER_BOOST_DEACTIVATED', (data) => {
            this.clearSpriteTint(data.entityId);
        });
        
        this.eventBus.on('PLAYER_SHIELD_ACTIVATED', (data) => {
            this.createShieldVisual(data.entityId, data.duration);
        });
        
        this.eventBus.on('PLAYER_SHIELD_DEACTIVATED', (data) => {
            this.removeShieldVisual(data.entityId);
        });
        
        this.eventBus.on('PLAYER_NOVA_BLAST', (data) => {
            this.createShockwave(data.x, data.y, 0xff00ff);
        });
        
        this.eventBus.on('CAMERA_FLASH', (data) => {
            this.flash(data.duration, data.color.r, data.color.g, data.color.b);
        });
        
        this.eventBus.on('ENEMY_KILLED', (data) => {
            if (data.position) {
                this.createExplosion(
                    data.position.x, 
                    data.position.y
                );
                this.createDamageNumber(
                    data.position.x, 
                    data.position.y, 
                    data.points, 
                    data.combo > 5
                );
            }
        });
        
        this.eventBus.on('PLAYER_DIED', (data) => {
            this.setSpriteVisible(this.playerId, false);
            if (data.position) {
                this.createExplosion(
                    data.position.x,
                    data.position.y,
                    2.0,
                    0x00ffff
                );
            }
            this.shake(1000, 0.03);
            this.flash(1000, 255, 0, 0);
        });
        
        this.eventBus.on('POWERUP_COLLECTED', (data) => {
            if (data.position) {
                this.createPowerupCollect(
                    data.position.x, 
                    data.position.y, 
                    data.type
                );
            }
        });
        
        this.eventBus.on('PROJECTILE_CREATED', (data) => {
            if (data.position && data.isCharged) {
                // Add glow effect for charged projectiles
                const sprite = this.scene.sprites.get(data.projectileId);
                if (sprite && sprite.body) {
                    this.scene.tweens.add({
                        targets: sprite,
                        scale: { from: 1.5, to: 1.8 },
                        alpha: { from: 1, to: 0.8 },
                        duration: 200,
                        yoyo: true,
                        repeat: -1,
                        onUpdate: () => {
                            // Stop tween if sprite or body is destroyed
                            if (!sprite || !sprite.body || !sprite.active) {
                                this.scene.tweens.killTweensOf(sprite);
                            }
                        }
                    });
                }
            }
        });
        
        this.eventBus.on('PROJECTILE_EXPIRED', (data) => {
            const sprite = this.scene.sprites.get(data.projectileId);
            if (sprite) {
                this.createImpact(sprite.x, sprite.y);
            }
        });
        
        this.eventBus.on('TITAN_SHOCKWAVE', (data) => {
            this.createShockwave(data.x, data.y, 0xff9966);
        });
        
        // Wave announcements
        this.eventBus.on('WAVE_ANNOUNCED', (data) => {
            const messages = [];
            let messageType = 'wave-start';
            
            if (data.isBossWave) {
                messages.push(`BOSS WAVE ${data.waveNumber}`);
                messages.push('TITANS APPROACHING!');
                messageType = 'boss-warning';
            } else {
                messages.push(`WAVE ${data.waveNumber}`);
                messages.push(`${data.enemyCount} ENEMIES INCOMING`);
            }
            
            this.createGameMessage({
                title: messages[0],
                subtitle: messages[1],
                messageType: messageType,
                duration: 3000
            });
        });
        
        this.eventBus.on('WAVE_REWARDS', (data) => {
            // Clear any existing wave messages
            this.clearGameMessages('wave-complete');
            
            this.createGameMessage({
                title: `WAVE ${data.waveNumber} COMPLETE!`,
                subtitle: `+${data.points} POINTS`,
                messageType: 'wave-complete',
                duration: 2500
            });
        });
        
        this.eventBus.on('COMBO_INCREASE', (data) => {
            this.showComboMessage(data.combo);
        });
        
        this.eventBus.on('COMBO_BREAK', () => {
            this.hideComboMessage();
        });
        
        this.eventBus.on('GAME_OVER', (data) => {
            this.createGameMessage({
                title: data.victory ? 'VICTORY!' : 'GAME OVER',
                subtitle: data.victory ? 'ALL WAVES COMPLETED' : 'PRESS R TO RESTART',
                messageType: data.victory ? 'victory' : 'game-over',
                duration: 0 // Don't auto-dismiss
            });
        });
        
        // Entity creation events
        this.eventBus.on('ENTITY_CREATED', (data) => {
            const { entityId, entityType, variant } = data;
            
            // Skip if no sprite component
            const sprite = this.scene.sprites.get(entityId);
            if (!sprite) return;
            
            // Assign appropriate texture
            this.assignEntityTexture(entityId, entityType, variant);
        });
        
        // Entity destruction
        this.eventBus.on('DESTROY_ENTITY', (data) => {
            this.destroySprite(data.entityId);
        });
        
        // Initialize shield storage
        this.activeShields = new Map();
    }
    
    update(deltaTime) {
        // Update all sprite positions from entity transforms
        this.syncSpritesWithEntities();
        
        // Update trails
        this.updateTrails();
        
        // Update camera
        this.updateCamera(deltaTime);
        
        // Update rotation for sprites based on velocity
        this.updateSpriteRotations();
        
        // Update active effects
        this.updateEffects(deltaTime);
        
        // Update enemy markers
        this.updateEnemyMarkers();
        
        // Update gravity wells
        this.updateGravityWells();
        
        // Clean up destroyed sprites
        this.cleanupDestroyedSprites();
    }
    
    syncSpritesWithEntities() {
        this.scene.sprites.forEach((sprite, entityId) => {
            if (!sprite || !sprite.active) return;
            
            const entity = this.entityManager.getEntity(entityId);
            const transform = this.entityManager.getComponent(entityId, 'transform');
            const physics = this.entityManager.getComponent(entityId, 'physics');
            
            if (transform && sprite.body) {
                // Update transform from physics body
                transform.x = sprite.x;
                transform.y = sprite.y;
                
                // Only sync rotation for non-planet entities
                if (entity && entity.type !== 'planet') {
                    transform.rotation = sprite.rotation;
                }
                
                // Sync physics velocity
                if (physics && sprite.body.velocity) {
                    physics.velocity.x = sprite.body.velocity.x;
                    physics.velocity.y = sprite.body.velocity.y;
                }
            }
        });
    }
    
    updateSpriteRotations() {
        const aiEntities = this.entityManager.query('ai', 'transform');
        
        aiEntities.forEach(entityId => {
            const sprite = this.scene.sprites.get(entityId);
            if (!sprite || !sprite.body) return;
            
            const vel = sprite.body.velocity;
            if (Math.abs(vel.x) > 0.1 || Math.abs(vel.y) > 0.1) {
                const targetAngle = Math.atan2(vel.y, vel.x);
                const currentAngle = sprite.rotation;
                
                // Smooth rotation
                let angleDiff = targetAngle - currentAngle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                const turnAmount = Math.min(Math.abs(angleDiff), 0.2);
                sprite.rotation += Math.sign(angleDiff) * turnAmount;
            }
        });
        
        // Also handle player rotation
        if (this.playerId) {
            const playerSprite = this.scene.sprites.get(this.playerId);
            if (playerSprite && playerSprite.body) {
                const vel = playerSprite.body.velocity;
                if (Math.abs(vel.x) > 0.1 || Math.abs(vel.y) > 0.1) {
                    const targetAngle = Math.atan2(vel.y, vel.x);
                    playerSprite.rotation = targetAngle;
                }
            }
        }
    }
    
    updateTrails() {
        this.scene.trails.forEach((trail, entityId) => {
            const sprite = this.scene.sprites.get(entityId);
            if (!sprite || !sprite.active) {
                trail.clear();
                return;
            }
            
            const trailComponent = this.entityManager.getComponent(entityId, 'trail');
            if (!trailComponent) return;
            
            // Add new point
            trailComponent.points.push({ x: sprite.x, y: sprite.y });
            
            // Remove old points
            if (trailComponent.points.length > trailComponent.maxLength) {
                trailComponent.points.shift();
            }
            
            // Redraw trail
            trail.clear();
            if (trailComponent.points.length > 1) {
                for (let i = 1; i < trailComponent.points.length; i++) {
                    const alpha = (i / trailComponent.points.length) * trailComponent.alpha;
                    trail.lineStyle(trailComponent.width, trailComponent.color, alpha);
                    
                    if (i === 1) {
                        trail.beginPath();
                        trail.moveTo(trailComponent.points[0].x, trailComponent.points[0].y);
                    }
                    
                    trail.lineTo(trailComponent.points[i].x, trailComponent.points[i].y);
                }
                trail.strokePath();
            }
        });
    }
    
    updateCamera(deltaTime) {
        const playerSprite = this.scene.sprites.get(this.scene.player);
        if (!playerSprite) return;
        
        // Follow player
        this.scene.cameras.main.startFollow(playerSprite, true, 0.1, 0.1);
        
        // Dynamic zoom based on velocity as a modifier
        if (playerSprite.body) {
            const vel = playerSprite.body.velocity;
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            const dynamicModifier = 1 - (speed / 100) * 0.2; // Zoom out up to 20% when moving fast
            const modifiedZoom = this.targetZoom * dynamicModifier;
            this.cameraZoom += (modifiedZoom - this.cameraZoom) * 0.02;
        } else {
            // Smooth zoom transition without dynamic modifier
            this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.02;
        }
        
        this.scene.cameras.main.setZoom(this.cameraZoom);
        
        // Update shake
        if (this.shakeIntensity > 0) {
            this.shakeIntensity *= 0.9;
            if (this.shakeIntensity < 0.01) {
                this.shakeIntensity = 0;
            }
        }
    }
    
    updateEffects(deltaTime) {
        // Update active effects
        this.activeEffects = this.activeEffects.filter(effect => {
            effect.lifetime -= deltaTime;
            
            if (effect.lifetime <= 0) {
                if (effect.cleanup) {
                    effect.cleanup();
                }
                return false;
            }
            
            if (effect.update) {
                effect.update(deltaTime);
            }
            
            return true;
        });
    }
    
    // ===== EFFECT CREATION METHODS =====
    
    createExplosion(x, y, scale = 1.0, color = 0xff6600) {
        // Create expanding shockwave
        const shockwave = this.scene.add.sprite(x, y, 'shockwave');
        shockwave.setScale(0.1 * scale);
        shockwave.setTint(color);
        shockwave.setBlendMode(Phaser.BlendModes.ADD);
        shockwave.setAlpha(0.8);
        
        this.scene.tweens.add({
            targets: shockwave,
            scale: 3 * scale,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => shockwave.destroy()
        });
        
        // Create particle burst
        for (let i = 0; i < 20 * scale; i++) {
            this.createExplosionParticle(x, y, color);
        }
        
        // Create debris
        for (let i = 0; i < 8 * scale; i++) {
            this.createDebris(x, y, color);
        }
        
        // Screen shake if large explosion
        if (scale > 1.5) {
            this.scene.cameras.main.shake(300, 0.01 * scale);
        }
        
        // Add light flash
        this.createFlash(x, y, scale, color);
    }
    
    createExplosionParticle(x, y, color) {
        const particle = this.scene.add.sprite(x, y, 'particle');
        particle.setTint(color);
        particle.setScale(Phaser.Math.FloatBetween(0.5, 1.5));
        particle.setBlendMode(Phaser.BlendModes.ADD);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Phaser.Math.FloatBetween(100, 400);
        const lifetime = Phaser.Math.FloatBetween(300, 600);
        
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        
        this.scene.tweens.add({
            targets: particle,
            x: particle.x + velocityX * (lifetime / 1000),
            y: particle.y + velocityY * (lifetime / 1000),
            scale: 0,
            alpha: 0,
            duration: lifetime,
            ease: 'Power2',
            onComplete: () => particle.destroy()
        });
    }
    
    createDebris(x, y, color) {
        const debris = this.scene.add.rectangle(
            x, y,
            Phaser.Math.Between(4, 12),
            Phaser.Math.Between(4, 12),
            color
        );
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Phaser.Math.FloatBetween(50, 200);
        const rotationSpeed = Phaser.Math.FloatBetween(-10, 10);
        const lifetime = Phaser.Math.FloatBetween(1000, 2000);
        
        this.scene.tweens.add({
            targets: debris,
            x: debris.x + Math.cos(angle) * speed,
            y: debris.y + Math.sin(angle) * speed + 100, // Gravity effect
            rotation: debris.rotation + rotationSpeed,
            alpha: 0,
            duration: lifetime,
            ease: 'Power2',
            onComplete: () => debris.destroy()
        });
    }
    
    createFlash(x, y, scale, color) {
        const flash = this.scene.add.circle(x, y, 50 * scale, color, 0.8);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        
        this.scene.tweens.add({
            targets: flash,
            scale: 2,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => flash.destroy()
        });
    }
    
    createImpact(x, y, color = 0xffff00) {
        // Small impact effect for projectile hits
        const impact = this.scene.add.sprite(x, y, 'particle');
        impact.setScale(2);
        impact.setTint(color);
        impact.setBlendMode(Phaser.BlendModes.ADD);
        
        this.scene.tweens.add({
            targets: impact,
            scale: 0,
            alpha: 0,
            duration: 200,
            onComplete: () => impact.destroy()
        });
        
        // Sparks
        for (let i = 0; i < 5; i++) {
            const spark = this.scene.add.sprite(x, y, 'particle');
            spark.setScale(0.5);
            spark.setTint(0xffffff);
            spark.setBlendMode(Phaser.BlendModes.ADD);
            
            const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
            const distance = Phaser.Math.FloatBetween(20, 50);
            
            this.scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                scale: 0,
                alpha: 0,
                duration: 300,
                onComplete: () => spark.destroy()
            });
        }
    }
    
    createSpawnEffect(x, y, color) {
        // Portal effect for enemy spawning
        const portal = this.scene.add.sprite(x, y, 'shockwave');
        portal.setScale(0);
        portal.setTint(color);
        portal.setAlpha(0);
        portal.setBlendMode(Phaser.BlendModes.ADD);
        
        this.scene.tweens.add({
            targets: portal,
            scale: 1,
            alpha: 0.6,
            duration: 500,
            yoyo: true,
            onComplete: () => portal.destroy()
        });
        
        // Particles spiraling inward
        for (let i = 0; i < 10; i++) {
            const particle = this.scene.add.sprite(x, y, 'particle');
            particle.setTint(color);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            
            const angle = (Math.PI * 2 * i) / 10;
            const startX = x + Math.cos(angle) * 100;
            const startY = y + Math.sin(angle) * 100;
            
            particle.setPosition(startX, startY);
            
            this.scene.tweens.add({
                targets: particle,
                x: x,
                y: y,
                scale: { from: 1, to: 0 },
                alpha: { from: 0, to: 1 },
                duration: 500,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    createShockwave(x, y, color = 0x00ffff) {
        // Large shockwave effect
        const wave = this.scene.add.sprite(x, y, 'shockwave');
        wave.setScale(0.5);
        wave.setTint(color);
        wave.setBlendMode(Phaser.BlendModes.ADD);
        wave.setAlpha(1);
        
        this.scene.tweens.add({
            targets: wave,
            scale: 4,
            alpha: 0,
            duration: 800,
            ease: 'Power2',
            onComplete: () => wave.destroy()
        });
        
        // Ring of particles
        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const particle = this.scene.add.sprite(x, y, 'particle');
            particle.setTint(color);
            particle.setScale(1.5);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            
            const distance = 300;
            this.scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                scale: 0,
                alpha: 0,
                duration: 600,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    createPowerupCollect(x, y, type) {
        const colors = {
            health: 0xff0000,
            energy: 0xffff00,
            credits: 0x00ff00
        };
        
        const color = colors[type] || 0xffffff;
        
        // Burst effect
        for (let i = 0; i < 10; i++) {
            const particle = this.scene.add.sprite(x, y, 'particle');
            particle.setTint(color);
            particle.setScale(1);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            
            const angle = (Math.PI * 2 * i) / 10;
            const distance = 50;
            
            this.scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                scale: 0,
                alpha: { from: 1, to: 0 },
                duration: 500,
                ease: 'Power2',
                onComplete: () => particle.destroy()
            });
        }
        
        // Rising text
        const text = this.scene.add.text(x, y, `+${type.toUpperCase()}`, {
            fontSize: '24px',
            fontFamily: 'Orbitron',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        text.setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: text,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
    
    createBoostEffect(entityId) {
        const effect = {
            entity: entityId,
            lifetime: 3,
            particleTimer: 0,
            update: (deltaTime) => {
                const sprite = this.scene.sprites.get(entityId);
                if (!sprite || !sprite.active) {
                    effect.lifetime = 0;
                    return;
                }
                
                effect.particleTimer += deltaTime * 1000;
                
                if (effect.particleTimer > 50) {
                    effect.particleTimer = 0;
                    
                    // Create boost particle
                    const particle = this.scene.add.sprite(sprite.x, sprite.y, 'particle');
                    particle.setTint(0xffff00);
                    particle.setScale(1.5);
                    particle.setBlendMode(Phaser.BlendModes.ADD);
                    
                    const angle = sprite.rotation + Math.PI + (Math.random() - 0.5) * 0.5;
                    const distance = 50;
                    
                    this.scene.tweens.add({
                        targets: particle,
                        x: sprite.x + Math.cos(angle) * distance,
                        y: sprite.y + Math.sin(angle) * distance,
                        scale: 0,
                        alpha: 0,
                        duration: 300,
                        onComplete: () => particle.destroy()
                    });
                }
            }
        };
        
        this.activeEffects.push(effect);
    }
    
    createDamageNumber(x, y, damage, isCritical = false) {
        const text = this.scene.add.text(x, y, Math.floor(damage).toString(), {
            fontSize: isCritical ? '32px' : '24px',
            fontFamily: 'Orbitron',
            color: isCritical ? '#ff0000' : '#ffff00',
            stroke: '#000000',
            strokeThickness: 4
        });
        text.setOrigin(0.5);
        
        const endY = y - 80;
        const endX = x + Phaser.Math.Between(-30, 30);
        
        this.scene.tweens.add({
            targets: text,
            x: endX,
            y: endY,
            scale: { from: 1, to: isCritical ? 1.5 : 1.2 },
            alpha: { from: 1, to: 0 },
            duration: 1000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
    
    // ===== GAME MESSAGE METHODS =====
    
    createGameMessage(data) {
        const { title, subtitle, messageType, duration, callback } = data;
        const messageId = `message_${Date.now()}`;
        
        const centerX = this.scene.cameras.main.centerX;
        const centerY = this.scene.cameras.main.centerY;
        
        // Message styling based on type
        const styles = {
            'wave-start': {
                titleColor: '#00ffff',
                titleSize: '64px',
                subtitleColor: '#ffffff',
                subtitleSize: '32px'
            },
            'wave-complete': {
                titleColor: '#00ff00',
                titleSize: '64px',
                subtitleColor: '#ffff00',
                subtitleSize: '32px'
            },
            'boss-warning': {
                titleColor: '#ff0000',
                titleSize: '72px',
                subtitleColor: '#ff6666',
                subtitleSize: '36px'
            },
            'victory': {
                titleColor: '#ffff00',
                titleSize: '80px',
                subtitleColor: '#00ff00',
                subtitleSize: '40px'
            },
            'game-over': {
                titleColor: '#ff0000',
                titleSize: '80px',
                subtitleColor: '#ff6666',
                subtitleSize: '40px'
            },
            'default': {
                titleColor: '#ffffff',
                titleSize: '48px',
                subtitleColor: '#cccccc',
                subtitleSize: '24px'
            }
        };
        
        const style = styles[messageType] || styles.default;
        
        // Create title text
        const titleText = this.scene.add.text(centerX, centerY - 30, title, {
            fontSize: style.titleSize,
            fontFamily: 'Orbitron',
            color: style.titleColor,
            stroke: '#000000',
            strokeThickness: 6
        });
        titleText.setOrigin(0.5);
        titleText.setScrollFactor(0);
        titleText.setScale(0);
        titleText.setDepth(1000);
        
        // Create subtitle if provided
        let subtitleText = null;
        if (subtitle) {
            subtitleText = this.scene.add.text(centerX, centerY + 40, subtitle, {
                fontSize: style.subtitleSize,
                fontFamily: 'Orbitron',
                color: style.subtitleColor,
                stroke: '#000000',
                strokeThickness: 4
            });
            subtitleText.setOrigin(0.5);
            subtitleText.setScrollFactor(0);
            subtitleText.setAlpha(0);
            subtitleText.setDepth(1000);
        }
        
        // Store message reference with type
        this.activeMessages.set(messageId, { titleText, subtitleText, messageType });
        
        // Animate entrance
        this.scene.tweens.add({
            targets: titleText,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        if (subtitleText) {
            this.scene.tweens.add({
                targets: subtitleText,
                alpha: 1,
                delay: 300,
                duration: 500
            });
        }
        
        // Auto-dismiss after duration
        if (duration > 0) {
            // Use a timer event for better reliability
            const timer = this.scene.time.addEvent({
                delay: duration,
                callback: () => {
                    this.dismissGameMessage(messageId, callback);
                },
                callbackScope: this
            });
        }
        
        return messageId;
    }
    
    dismissGameMessage(messageId, callback) {
        const message = this.activeMessages.get(messageId);
        if (!message) return;
        
        const { titleText, subtitleText } = message;
        const targets = subtitleText ? [titleText, subtitleText] : [titleText];
        
        this.scene.tweens.add({
            targets: targets,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                titleText.destroy();
                if (subtitleText) subtitleText.destroy();
                this.activeMessages.delete(messageId);
                if (callback) callback();
            }
        });
    }
    
    showComboMessage(combo) {
        const existingCombo = this.activeMessages.get('combo');
        if (existingCombo) {
            existingCombo.titleText.setText(`COMBO x${combo}!`);
            
            // Refresh animation
            this.scene.tweens.add({
                targets: existingCombo.titleText,
                scale: { from: 1.2, to: 1 },
                duration: 200,
                ease: 'Back.easeOut'
            });
        } else {
            const comboText = this.scene.add.text(
                this.scene.cameras.main.centerX,
                this.scene.cameras.main.height * 0.2,
                `COMBO x${combo}!`,
                {
                    fontSize: '48px',
                    fontFamily: 'Orbitron',
                    color: '#ffff00',
                    stroke: '#ff6600',
                    strokeThickness: 4
                }
            );
            comboText.setOrigin(0.5);
            comboText.setScrollFactor(0);
            comboText.setDepth(999);
            
            this.activeMessages.set('combo', { titleText: comboText });
        }
    }
    
    hideComboMessage() {
        const combo = this.activeMessages.get('combo');
        if (combo) {
            this.scene.tweens.add({
                targets: combo.titleText,
                alpha: 0,
                scale: 0.8,
                duration: 300,
                onComplete: () => {
                    combo.titleText.destroy();
                    this.activeMessages.delete('combo');
                }
            });
        }
    }
    
    // Clear all messages of a specific type
    clearGameMessages(messageType) {
        const toRemove = [];
        this.activeMessages.forEach((message, id) => {
            if (message.messageType === messageType) {
                toRemove.push(id);
            }
        });
        
        toRemove.forEach(id => {
            this.dismissGameMessage(id);
        });
    }
    
    // ===== VISUAL MANAGEMENT METHODS =====
    
    animatePowerup(entityId) {
        const sprite = this.scene.sprites.get(entityId);
        if (!sprite) return;
        
        // Floating animation
        this.scene.tweens.add({
            targets: sprite,
            y: sprite.y - 20,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        // Rotation
        this.scene.tweens.add({
            targets: sprite,
            rotation: Math.PI * 2,
            duration: 3000,
            repeat: -1
        });
    }
    
    createShieldVisual(entityId, duration) {
        const sprite = this.scene.sprites.get(entityId);
        if (!sprite) return;
        
        const transform = this.entityManager.getComponent(entityId, 'transform');
        if (!transform) return;
        
        // Create shield visual
        const shield = this.scene.add.sprite(transform.x, transform.y, 'shockwave');
        shield.setScale(0.8);
        shield.setTint(0x00ffff);
        shield.setAlpha(0.25); // Reduced from 0.5 to 0.25
        shield.setBlendMode(Phaser.BlendModes.ADD);
        
        // Pulsing animation
        this.scene.tweens.add({
            targets: shield,
            scale: { from: 0.8, to: 1 },
            alpha: { from: 0.25, to: 0.15 }, // Reduced from 0.5-0.3 to 0.25-0.15
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // Update shield position
        const updateEvent = this.scene.time.addEvent({
            delay: 16,
            callback: () => {
                const currentTransform = this.entityManager.getComponent(entityId, 'transform');
                if (currentTransform && shield.active) {
                    shield.x = currentTransform.x;
                    shield.y = currentTransform.y;
                }
            },
            repeat: -1
        });
        
        // Store shield reference for cleanup
        this.activeShields.set(entityId, { shield, updateEvent });
    }
    
    removeShieldVisual(entityId) {
        const shieldData = this.activeShields.get(entityId);
        if (shieldData) {
            shieldData.updateEvent.remove();
            shieldData.shield.destroy();
            this.activeShields.delete(entityId);
        }
    }
    
    // ===== SPRITE MANAGEMENT =====
    
    destroySprite(entityId) {
        const sprite = this.scene.sprites.get(entityId);
        if (sprite) {
            // Stop all tweens on this sprite before destroying
            this.scene.tweens.killTweensOf(sprite);
            sprite.destroy();
            this.scene.sprites.delete(entityId);
        }
        
        // Clean up trail if exists
        const trail = this.scene.trails.get(entityId);
        if (trail) {
            trail.destroy();
            this.scene.trails.delete(entityId);
        }
        
        // Clean up shield if exists
        this.removeShieldVisual(entityId);
        
        // Remove from enemy markers if it was an enemy
        this.enemyMarkers.delete(entityId);
    }
    
    cleanupDestroyedSprites() {
        const toRemove = [];
        
        this.scene.sprites.forEach((sprite, entityId) => {
            if (!sprite || !sprite.active) {
                toRemove.push(entityId);
            }
        });
        
        toRemove.forEach(entityId => {
            this.scene.sprites.delete(entityId);
            
            // Clean up trail if exists
            const trail = this.scene.trails.get(entityId);
            if (trail) {
                trail.destroy();
                this.scene.trails.delete(entityId);
            }
        });
    }
    
    // ===== CAMERA EFFECTS =====
    
    shake(duration, intensity) {
        this.scene.cameras.main.shake(duration, intensity);
        this.shakeIntensity = intensity;
    }
    
    flash(duration, red = 255, green = 255, blue = 255, force = false) {
        this.scene.cameras.main.flash(duration, red, green, blue, force);
    }
    
    fade(fadeIn, duration, red = 0, green = 0, blue = 0, callback) {
        if (fadeIn) {
            this.scene.cameras.main.fadeIn(duration, red, green, blue);
        } else {
            this.scene.cameras.main.fadeOut(duration, red, green, blue);
        }
        
        if (callback) {
            this.scene.cameras.main.once(fadeIn ? 'camerafadeincomplete' : 'camerafadeoutcomplete', callback);
        }
    }
    
    // ===== SPRITE EFFECTS =====
    
    flashSprite(entityId, color = 0xffffff, duration = 100) {
        const sprite = this.scene.sprites.get(entityId);
        if (!sprite) return;
        
        sprite.setTint(color);
        this.scene.time.delayedCall(duration, () => {
            if (sprite.active) sprite.clearTint();
        });
    }
    
    setSpriteTint(entityId, color) {
        const sprite = this.scene.sprites.get(entityId);
        if (sprite) sprite.setTint(color);
    }
    
    clearSpriteTint(entityId) {
        const sprite = this.scene.sprites.get(entityId);
        if (sprite) sprite.clearTint();
    }
    
    setSpriteAlpha(entityId, alpha) {
        const sprite = this.scene.sprites.get(entityId);
        if (sprite) sprite.setAlpha(alpha);
    }
    
    setSpriteVisible(entityId, visible) {
        const sprite = this.scene.sprites.get(entityId);
        if (sprite) sprite.setVisible(visible);
    }
    
    // ===== ENEMY MARKER SYSTEM =====
    
    updateEnemyMarkers() {
        if (!this.markerGraphics) return;
        
        // Clear previous markers
        this.markerGraphics.clear();
        
        // Only show markers when C is held
        if (!this.scene.inputSystem || !this.scene.inputSystem.isShiftHeld()) {
            return;
        }
        
        // Get camera info
        const camera = this.scene.cameras.main;
        const screenWidth = camera.width;
        const screenHeight = camera.height;
        const screenCenterX = screenWidth / 2;
        const screenCenterY = screenHeight / 2;
        
        // Screen edge padding
        const padding = 40;
        const markerSize = 20;
        
        // Query all enemies and bosses by type
        const enemies = this.entityManager.getEntitiesByType('enemy');
        const bosses = this.entityManager.getEntitiesByType('boss');
        const allHostiles = [...enemies, ...bosses];
        
        allHostiles.forEach(enemyId => {
            const enemySprite = this.scene.sprites.get(enemyId);
            if (!enemySprite || !enemySprite.active) return;
            
            // Get enemy faction for color
            const entity = this.entityManager.getEntity(enemyId);
            const faction = this.entityManager.getComponent(enemyId, 'faction');
            const factionColors = {
                swarm: 0xff6666,
                sentinel: 0x66ff66,
                phantom: 0x9966ff,
                titan: 0xff9966,
                boss: 0xff0000  // Red for bosses
            };
            // Use red for bosses, faction color for enemies
            const color = entity?.type === 'boss' ? 0xff0000 : (factionColors[faction?.name] || 0xffffff);
            
            // Check if enemy is visible in camera viewport
            const inViewport = camera.worldView.contains(enemySprite.x, enemySprite.y);
            
            if (!inViewport) {
                // Enemy is off-screen, calculate indicator position
                
                // Get camera center in world coordinates
                const cameraCenterX = camera.worldView.centerX;
                const cameraCenterY = camera.worldView.centerY;
                
                // Calculate direction from camera center to enemy
                const dx = enemySprite.x - cameraCenterX;
                const dy = enemySprite.y - cameraCenterY;
                const angle = Math.atan2(dy, dx);
                
                // Calculate the maximum distance from center to edge considering padding
                const effectiveWidth = (screenWidth - 2 * padding) / camera.zoom;
                const effectiveHeight = (screenHeight - 2 * padding) / camera.zoom;
                
                // Find intersection with viewport edge
                let t = Infinity;
                
                // Check horizontal edges
                if (Math.abs(dx) > 0.001) {
                    const tx = effectiveWidth / 2 / Math.abs(dx);
                    t = Math.min(t, tx);
                }
                
                // Check vertical edges
                if (Math.abs(dy) > 0.001) {
                    const ty = effectiveHeight / 2 / Math.abs(dy);
                    t = Math.min(t, ty);
                }
                
                // Calculate indicator position in world coordinates
                const indicatorX = cameraCenterX + dx * t;
                const indicatorY = cameraCenterY + dy * t;
                
                // Draw arrow marker
                this.markerGraphics.lineStyle(3, color, 0.9);
                this.markerGraphics.fillStyle(color, 0.7);
                
                // Create arrow shape pointing towards enemy
                const arrowPoints = [
                    indicatorX + Math.cos(angle) * markerSize,
                    indicatorY + Math.sin(angle) * markerSize,
                    indicatorX + Math.cos(angle - 2.5) * markerSize * 0.7,
                    indicatorY + Math.sin(angle - 2.5) * markerSize * 0.7,
                    indicatorX + Math.cos(angle + 2.5) * markerSize * 0.7,
                    indicatorY + Math.sin(angle + 2.5) * markerSize * 0.7
                ];
                
                this.markerGraphics.fillTriangle(
                    arrowPoints[0], arrowPoints[1],
                    arrowPoints[2], arrowPoints[3],
                    arrowPoints[4], arrowPoints[5]
                );
                
                // Add outer circle for visibility
                this.markerGraphics.lineStyle(2, 0x000000, 0.8);
                this.markerGraphics.strokeCircle(indicatorX, indicatorY, markerSize * 1.2);
                
                // Add extra indicator for bosses
                if (entity?.type === 'boss') {
                    this.markerGraphics.lineStyle(3, color, 1);
                    this.markerGraphics.strokeCircle(indicatorX, indicatorY, markerSize * 1.8);
                    // Add "BOSS" text
                    const bossText = this.scene.add.text(indicatorX, indicatorY - markerSize * 2, 'BOSS', {
                        fontSize: '12px',
                        fontFamily: 'Orbitron, monospace',
                        color: '#ff0000',
                        stroke: '#000000',
                        strokeThickness: 2
                    });
                    bossText.setOrigin(0.5);
                    bossText.setDepth(901);
                    // Remove text next frame
                    this.scene.time.delayedCall(100, () => bossText.destroy());
                }
                
                // Calculate distance
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Add pulsing effect for very far enemies
                if (distance > 3000) {
                    const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
                    this.markerGraphics.lineStyle(3, color, pulse);
                    this.markerGraphics.strokeCircle(indicatorX, indicatorY, markerSize * 1.8);
                }
            } else {
                // Enemy is on-screen - draw triangle above them
                const markerOffset = 50;
                
                this.markerGraphics.lineStyle(2, color, 0.8);
                this.markerGraphics.fillStyle(color, 0.6);
                
                // Draw downward-pointing triangle
                const triangleSize = 15;
                this.markerGraphics.fillTriangle(
                    enemySprite.x, enemySprite.y - markerOffset - triangleSize,
                    enemySprite.x - triangleSize * 0.7, enemySprite.y - markerOffset,
                    enemySprite.x + triangleSize * 0.7, enemySprite.y - markerOffset
                );
                
                // Add outline
                this.markerGraphics.lineStyle(2, 0x000000, 0.5);
                this.markerGraphics.strokeTriangle(
                    enemySprite.x, enemySprite.y - markerOffset - triangleSize,
                    enemySprite.x - triangleSize * 0.7, enemySprite.y - markerOffset,
                    enemySprite.x + triangleSize * 0.7, enemySprite.y - markerOffset
                );
            }
        });
    }
    
    
    // ===== ENVIRONMENT CREATION =====
    
    createEnvironment() {
        this.createBackground();
    }
    
    createBackground() {
        // Gradient background
        const bg = this.scene.add.graphics();
        bg.fillGradientStyle(0x000033, 0x000033, 0x000000, 0x000000, 1);
        bg.fillRect(0, 0, GameConfig.world.width, GameConfig.world.height);
        
        // Nebula clouds
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Between(0, GameConfig.world.width);
            const y = Phaser.Math.Between(0, GameConfig.world.height);
            const radius = Phaser.Math.Between(300, 600);
            const colors = [0x660066, 0x006666, 0x666600];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            const nebula = this.scene.add.graphics();
            nebula.fillStyle(color, 0.05);
            nebula.fillCircle(x, y, radius);
            nebula.setBlendMode(Phaser.BlendModes.ADD);
        }
        
        // Stars
        const stars = this.scene.add.graphics();
        for (let i = 0; i < 1000; i++) {
            const x = Phaser.Math.Between(0, GameConfig.world.width);
            const y = Phaser.Math.Between(0, GameConfig.world.height);
            const size = Math.random() < 0.8 ? 1 : 2;
            const brightness = Phaser.Math.Between(0.3, 1);
            
            stars.fillStyle(0xffffff, brightness);
            stars.fillCircle(x, y, size);
        }
    }
    
    createCatastropheVisual() {
        // This will be called after entities are created to attach visual to the catastrophe entity
        if (!this.scene.catastropheId) return;
        
        const catastropheTransform = this.entityManager.getComponent(this.scene.catastropheId, 'transform');
        if (!catastropheTransform) return;
        
        const spiral = this.scene.add.graphics();
        
        // Store spiral graphics reference
        this.scene.catastropheSpiral = spiral;
        
        // Animate spiral rotation
        this.scene.tweens.add({
            targets: spiral,
            rotation: Math.PI * 2,
            duration: 3000, // Fast rotation
            repeat: -1
        });
    }
    
    // ===== TEXTURE ASSIGNMENT =====
    
    assignEntityTexture(entityId, entityType, variant = null) {
        const sprite = this.scene.sprites.get(entityId);
        if (!sprite) return;
        
        const textureKey = this.textureGenerator.getTextureConfig(entityType, variant);
        if (textureKey && this.scene.textures.exists(textureKey)) {
            sprite.setTexture(textureKey);
            
            // Apply any special visual properties based on entity type
            this.applyEntityVisualProperties(sprite, entityType, variant);
        }
    }
    
    applyEntityVisualProperties(sprite, entityType, variant) {
        // Apply special effects or properties based on entity type
        switch (entityType) {
            case 'player':
                if (variant === 'boost') {
                    sprite.setBlendMode(Phaser.BlendModes.ADD);
                } else if (variant === 'shield') {
                    sprite.setAlpha(0.8);
                    sprite.setBlendMode(Phaser.BlendModes.SCREEN);
                }
                break;
                
            case 'projectile':
                sprite.setBlendMode(Phaser.BlendModes.ADD);
                if (variant === 'charged') {
                    // Add pulsing effect for charged projectiles
                    this.scene.tweens.add({
                        targets: sprite,
                        scale: { from: 1, to: 1.2 },
                        alpha: { from: 1, to: 0.8 },
                        duration: 200,
                        yoyo: true,
                        repeat: -1
                    });
                }
                break;
                
            case 'powerup':
                // Floating animation for powerups
                this.scene.tweens.add({
                    targets: sprite,
                    y: sprite.y - 10,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                
                // Rotation
                this.scene.tweens.add({
                    targets: sprite,
                    rotation: Math.PI * 2,
                    duration: 3000,
                    repeat: -1
                });
                break;
                
            case 'boss':
                // Boss glow effect
                sprite.setBlendMode(Phaser.BlendModes.ADD);
                if (variant === 'vortex') {
                    // Rotating vortex
                    this.scene.tweens.add({
                        targets: sprite,
                        rotation: Math.PI * 2,
                        duration: 3000,
                        repeat: -1
                    });
                }
                break;
        }
    }
    
    // Dynamic texture switching for state changes
    updateEntityTexture(entityId, newVariant) {
        const entity = this.entityManager.getEntity(entityId);
        if (!entity) return;
        
        this.assignEntityTexture(entityId, entity.type, newVariant);
    }
    
    // ===== GRAVITY WELL RENDERING =====
    
    updateGravityWells() {
        if (!this.gravityGraphics) return;
        
        // Clear previous gravity wells
        this.gravityGraphics.clear();
        
        // Get all planets
        const planets = this.entityManager.getEntitiesByType('planet');
        
        planets.forEach(planetId => {
            const transform = this.entityManager.getComponent(planetId, 'transform');
            const physics = this.entityManager.getComponent(planetId, 'physics');
            
            if (!transform || !physics) return;
            
            // Calculate gravity well radius based on mass (2x increase)
            const baseRadius = physics.radius;
            const gravityRadius = baseRadius + (Math.sqrt(physics.mass) * 40); // 2x the visual range
            
            // Draw concentric circles to show gravity field
            for (let i = 0; i < 8; i++) { // More circles for larger range
                const radius = baseRadius + ((gravityRadius - baseRadius) * (i + 1) / 8);
                const alpha = 0.04 * (1 - i / 8); // Reduced from 0.08 to 0.04 (50% reduction)
                
                this.gravityGraphics.lineStyle(2, 0x4444ff, alpha);
                this.gravityGraphics.strokeCircle(transform.x, transform.y, radius);
            }
            
            // Add a subtle glow effect around the planet
            const glowRadius = baseRadius * 1.2;
            this.gravityGraphics.fillStyle(0x6666ff, 0.05); // Reduced from 0.1 to 0.05 (50% reduction)
            this.gravityGraphics.fillCircle(transform.x, transform.y, glowRadius);
        });
    }
}

// RenderSystem will be instantiated by GameInitializer
window.RenderSystem = RenderSystem;