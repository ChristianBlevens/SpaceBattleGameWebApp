// RenderSystem.js - Handles ALL sprite rendering, visual updates, effects, and in-game messages
// COMPLETE: Now includes all effects functionality merged from EffectsSystem

class RenderSystem {
    constructor(scene, eventBus, entityManager) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.playerId = null;
        
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
    }
    
    init() {
        // Get player ID
        this.playerId = this.scene.gameState ? this.scene.gameState.getPlayerId() : null;
        
        this.setupCamera();
        this.setupEventListeners();
        this.createTextures();
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
        
        // Game message events
        this.eventBus.on('SHOW_GAME_MESSAGE', (data) => {
            this.createGameMessage(data);
        });
        
        this.eventBus.on('DISMISS_GAME_MESSAGE', (data) => {
            this.dismissGameMessage(data.messageId, data.callback);
        });
        
        // Entity lifecycle events
        this.eventBus.on('ENEMY_SPAWNED', (data) => {
            this.createSpawnEffect(
                data.position.x,
                data.position.y,
                GameConfig.factions[data.faction].color
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
                        repeat: -1
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
        
        // Clean up destroyed sprites
        this.cleanupDestroyedSprites();
    }
    
    syncSpritesWithEntities() {
        this.scene.sprites.forEach((sprite, entityId) => {
            if (!sprite || !sprite.active) return;
            
            const transform = this.entityManager.getComponent(entityId, 'transform');
            const physics = this.entityManager.getComponent(entityId, 'physics');
            
            if (transform && sprite.body) {
                // Update transform from physics body
                transform.x = sprite.x;
                transform.y = sprite.y;
                transform.rotation = sprite.rotation;
                
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
        
        // Dynamic zoom based on velocity
        if (playerSprite.body) {
            const vel = playerSprite.body.velocity;
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            this.targetZoom = 0.4 - (speed / 100) * 0.1; // Zoom out when moving fast
            this.targetZoom = Math.max(0.25, Math.min(0.5, this.targetZoom));
        }
        
        // Smooth zoom transition
        this.cameraZoom += (this.targetZoom - this.cameraZoom) * 0.02;
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
        
        // Store message reference
        this.activeMessages.set(messageId, { titleText, subtitleText });
        
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
            this.scene.time.delayedCall(duration, () => {
                this.dismissGameMessage(messageId, callback);
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
        shield.setAlpha(0.5);
        shield.setBlendMode(Phaser.BlendModes.ADD);
        
        // Pulsing animation
        this.scene.tweens.add({
            targets: shield,
            scale: { from: 0.8, to: 1 },
            alpha: { from: 0.5, to: 0.3 },
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
    
    // ===== ENVIRONMENT CREATION =====
    
    createEnvironment() {
        this.createBackground();
        this.createGalacticSpiral();
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
    
    createGalacticSpiral() {
        const centerX = GameConfig.world.centerX;
        const centerY = GameConfig.world.centerY;
        
        const spiral = this.scene.add.graphics();
        spiral.lineStyle(3, 0x6600ff, 0.3);
        
        // Create spiral arms
        for (let arm = 0; arm < 3; arm++) {
            const angleOffset = (arm * Math.PI * 2) / 3;
            spiral.beginPath();
            
            for (let i = 0; i < 200; i++) {
                const angle = angleOffset + (i * 0.05);
                const radius = 100 + (i * 8);
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                
                if (i === 0) {
                    spiral.moveTo(x, y);
                } else {
                    spiral.lineTo(x, y);
                }
                
                // Add glowing stars
                if (i % 10 === 0) {
                    const star = this.scene.add.sprite(x, y, 'particle');
                    star.setScale(2);
                    star.setTint(0x9966ff);
                    star.setAlpha(0.5);
                    
                    this.scene.tweens.add({
                        targets: star,
                        alpha: { from: 0.5, to: 0.2 },
                        scale: { from: 2, to: 3 },
                        duration: 2000,
                        yoyo: true,
                        repeat: -1,
                        delay: Math.random() * 2000
                    });
                }
            }
            
            spiral.strokePath();
        }
        
        // Animate spiral rotation
        this.scene.tweens.add({
            targets: spiral,
            rotation: Math.PI * 2,
            duration: 120000,
            repeat: -1
        });
        
        // Central black hole
        const blackHole = this.scene.add.sprite(centerX, centerY, 'shockwave');
        blackHole.setScale(2);
        blackHole.setTint(0x000000);
        blackHole.setAlpha(0.8);
        
        this.scene.tweens.add({
            targets: blackHole,
            scale: { from: 2, to: 2.5 },
            alpha: { from: 0.8, to: 0.5 },
            duration: 3000,
            yoyo: true,
            repeat: -1
        });
    }
    
    // ===== TEXTURE CREATION =====
    
    createTextures() {
        const scene = this.scene;
        const graphics = scene.make.graphics({ add: false });
        
        // Player
        this.createGlowTexture(graphics, 'player', 40, 0x00ffff, 0x0066ff);
        
        // Enemies
        this.createGlowTexture(graphics, 'enemy-swarm', 25, 0xff6666, 0xcc0000);
        this.createGlowTexture(graphics, 'enemy-sentinel', 35, 0x66ff66, 0x00cc00);
        this.createGlowTexture(graphics, 'enemy-phantom', 30, 0x9966ff, 0x6600cc);
        this.createGlowTexture(graphics, 'enemy-titan', 50, 0xff9966, 0xcc6600);
        
        // Projectiles
        this.createProjectileTexture(graphics, 'projectile-basic', 8, 0xffff00);
        this.createProjectileTexture(graphics, 'projectile-charged', 12, 0x00ffff);
        this.createProjectileTexture(graphics, 'projectile-enemy', 6, 0xff0000);
        
        // Powerups
        this.createPowerupTexture(graphics, 'powerup-health', 0xff0000);
        this.createPowerupTexture(graphics, 'powerup-energy', 0xffff00);
        this.createPowerupTexture(graphics, 'powerup-credits', 0x00ff00);
        
        // Planets
        this.createPlanetTexture(graphics, 'planet-small', 80, 0x666666);
        this.createPlanetTexture(graphics, 'planet-medium', 120, 0x888888);
        this.createPlanetTexture(graphics, 'planet-large', 160, 0xaaaaaa);
        
        // Effects
        this.createCircleTexture(graphics, 'particle', 4, 0xffffff);
        this.createCircleTexture(graphics, 'shockwave', 100, 0x00ffff, 0.3);
        
        graphics.destroy();
    }
    
    createGlowTexture(graphics, key, radius, color, glowColor) {
        graphics.clear();
        
        // Outer glow
        for (let i = 3; i >= 0; i--) {
            const alpha = 0.1 * (4 - i);
            const r = radius + (i * 10);
            graphics.fillStyle(glowColor || color, alpha);
            graphics.fillCircle(radius + 30, radius + 30, r);
        }
        
        // Main body
        graphics.fillStyle(color, 1);
        graphics.fillCircle(radius + 30, radius + 30, radius);
        
        // Inner highlight
        graphics.fillStyle(0xffffff, 0.3);
        graphics.fillCircle(radius + 20, radius + 20, radius * 0.4);
        
        graphics.generateTexture(key, (radius + 30) * 2, (radius + 30) * 2);
    }
    
    createProjectileTexture(graphics, key, radius, color) {
        graphics.clear();
        
        // Glow
        graphics.fillStyle(color, 0.3);
        graphics.fillCircle(radius + 10, radius + 10, radius + 5);
        
        // Core
        graphics.fillStyle(color, 1);
        graphics.fillCircle(radius + 10, radius + 10, radius);
        
        // Bright center
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(radius + 10, radius + 10, radius * 0.5);
        
        graphics.generateTexture(key, (radius + 10) * 2, (radius + 10) * 2);
    }
    
    createPowerupTexture(graphics, key, color) {
        graphics.clear();
        
        const size = 30;
        const cx = size;
        const cy = size;
        
        // Background
        graphics.fillStyle(color, 0.3);
        graphics.fillRect(cx - size/2, cy - size/2, size, size);
        
        // Star shape
        graphics.fillStyle(color, 1);
        graphics.beginPath();
        
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 * i) / 10;
            const radius = i % 2 === 0 ? size * 0.6 : size * 0.3;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            
            if (i === 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }
        
        graphics.closePath();
        graphics.fillPath();
        
        graphics.generateTexture(key, size * 2, size * 2);
    }
    
    createPlanetTexture(graphics, key, radius, color) {
        graphics.clear();
        
        // Atmosphere
        graphics.fillStyle(color, 0.1);
        graphics.fillCircle(radius, radius, radius + 20);
        
        // Planet layers
        for (let i = 0; i < 5; i++) {
            const r = radius - (i * radius * 0.2);
            const brightness = 0.4 + (i * 0.15);
            graphics.fillStyle(color, brightness);
            graphics.fillCircle(radius, radius, r);
        }
        
        // Surface features
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
            const dist = radius * (0.3 + Math.random() * 0.4);
            const size = radius * (0.1 + Math.random() * 0.2);
            
            graphics.fillStyle(color, 0.7);
            graphics.fillCircle(
                radius + Math.cos(angle) * dist,
                radius + Math.sin(angle) * dist,
                size
            );
        }
        
        graphics.generateTexture(key, radius * 2, radius * 2);
    }
    
    createCircleTexture(graphics, key, radius, color, alpha = 1) {
        graphics.clear();
        graphics.fillStyle(color, alpha);
        graphics.fillCircle(radius, radius, radius);
        graphics.generateTexture(key, radius * 2, radius * 2);
    }
}

// RenderSystem will be instantiated by GameInitializer
window.RenderSystem = RenderSystem;