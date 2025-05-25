// EffectsSystem.js - Handles all visual effects and particles

class EffectsSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = [];
    }
    
    init(entityManager) {
        this.entityManager = entityManager;
    }
    
    update(deltaTime, entityManager) {
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
        
        // Update entity-based effects (like damage flash)
        const entities = entityManager.query('sprite');
        entities.forEach(entityId => {
            const sprite = this.scene.sprites.get(entityId);
            if (!sprite) return;
            
            // Handle damage tint fade
            if (sprite.tintTopLeft === 0xff0000) {
                sprite.clearTint();
            }
        });
    }
    
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
    
    createTrail(entity, color = 0x00ffff, width = 2, length = 20) {
        const trail = {
            entity: entity,
            points: [],
            maxLength: length,
            color: color,
            width: width,
            graphics: this.scene.add.graphics(),
            lifetime: Infinity,
            update: (deltaTime) => {
                const sprite = this.scene.sprites.get(entity);
                if (!sprite || !sprite.active) {
                    trail.lifetime = 0;
                    return;
                }
                
                // Add new point
                trail.points.push({ x: sprite.x, y: sprite.y });
                
                // Remove old points
                if (trail.points.length > trail.maxLength) {
                    trail.points.shift();
                }
                
                // Draw trail
                trail.graphics.clear();
                if (trail.points.length > 1) {
                    for (let i = 1; i < trail.points.length; i++) {
                        const alpha = (i / trail.points.length) * 0.5;
                        trail.graphics.lineStyle(trail.width, trail.color, alpha);
                        trail.graphics.beginPath();
                        trail.graphics.moveTo(trail.points[i - 1].x, trail.points[i - 1].y);
                        trail.graphics.lineTo(trail.points[i].x, trail.points[i].y);
                        trail.graphics.strokePath();
                    }
                }
            },
            cleanup: () => {
                trail.graphics.destroy();
            }
        };
        
        this.activeEffects.push(trail);
        return trail;
    }
    
    createBoostEffect(entity) {
        const sprite = this.scene.sprites.get(entity);
        if (!sprite) return;
        
        // Create boost particles
        const effect = {
            entity: entity,
            lifetime: 3000,
            particleTimer: 0,
            update: (deltaTime) => {
                const sprite = this.scene.sprites.get(entity);
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
}