// RenderSystem.js - Handles all sprite rendering and visual updates

class RenderSystem {
    constructor(scene) {
        this.scene = scene;
        this.entityManager = window.EntityManager;
        
        // Camera settings
        this.cameraZoom = 0.4;
        this.targetZoom = 0.4;
        this.shakeIntensity = 0;
    }
    
    init() {
        this.setupCamera();
    }
    
    setupCamera() {
        this.scene.cameras.main.setBounds(0, 0, GameConfig.world.width, GameConfig.world.height);
        this.scene.cameras.main.setZoom(this.cameraZoom);
        
        // Initial camera shake for impact
        this.shake(500, 0.01);
    }
    
    update(deltaTime) {
        // Update all sprite positions from entity transforms
        this.syncSpritesWithEntities();
        
        // Update trails
        this.updateTrails();
        
        // Update camera
        this.updateCamera(deltaTime);
        
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
	
	// Sprite management
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
    
    // Camera effects
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
    
    // Sprite effects
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
	
	// Environment creation
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
            const color = Phaser.Math.Pick([0x660066, 0x006666, 0x666600]);
            
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
    
    // Texture creation methods
    static createTextures(scene) {
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
    
    static createGlowTexture(graphics, key, radius, color, glowColor) {
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
    
    static createProjectileTexture(graphics, key, radius, color) {
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
    
    static createPowerupTexture(graphics, key, color) {
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
    
    static createPlanetTexture(graphics, key, radius, color) {
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
    
    static createCircleTexture(graphics, key, radius, color, alpha = 1) {
        graphics.clear();
        graphics.fillStyle(color, alpha);
        graphics.fillCircle(radius, radius, radius);
        graphics.generateTexture(key, radius * 2, radius * 2);
    }
}

// Export for use
window.RenderSystem = RenderSystem;