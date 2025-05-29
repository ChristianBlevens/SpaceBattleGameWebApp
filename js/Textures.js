// Textures.js - Advanced procedural texture generation system with modular design
// Provides high-quality, easily customizable textures for all game entities

class TextureGenerator {
    constructor(scene) {
        this.scene = scene;
        this.textures = new Map();
        this.graphics = null;
        this.canvas = null;
        this.ctx = null;
    }

    init() {
        // Create a canvas for advanced texture operations
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Create Phaser graphics object for basic shapes
        this.graphics = this.scene.make.graphics({ add: false });
        
        // Generate all textures
        this.generateAllTextures();
    }

    generateAllTextures() {
        // Player textures
        this.generatePlayerTextures();
        
        // Enemy textures
        this.generateEnemyTextures();
        
        // Projectile textures
        this.generateProjectileTextures();
        
        // Powerup textures
        this.generatePowerupTextures();
        
        // Environment textures
        this.generateEnvironmentTextures();
        
        // Effect textures
        this.generateEffectTextures();
        
        // Boss textures
        this.generateBossTextures();
        
        // Clean up
        this.graphics.destroy();
    }

    // ===== PLAYER TEXTURES =====
    
    generatePlayerTextures() {
        const config = {
            player: {
                size: 48,
                baseColor: 0x00ffff,
                accentColor: 0x0099ff,
                glowColor: 0x00ffff,
                shape: 'fighter'
            },
            playerBoost: {
                size: 48,
                baseColor: 0xffff00,
                accentColor: 0xff9900,
                glowColor: 0xffff66,
                shape: 'fighter'
            },
            playerShield: {
                size: 64,
                baseColor: 0x00ffff,
                accentColor: 0x0066ff,
                glowColor: 0x00ccff,
                shape: 'shield'
            }
        };

        Object.entries(config).forEach(([key, cfg]) => {
            this.createAdvancedSprite(key, cfg);
        });
    }

    // ===== ENEMY TEXTURES =====
    
    generateEnemyTextures() {
        const enemyConfigs = {
            'enemy-swarm': {
                size: 32,
                baseColor: 0xff69b4, // Hot pink
                accentColor: 0xff1493, // Deep pink
                glowColor: 0xff69b4,
                shape: 'diamond',
                details: 'aggressive'
            },
            'enemy-sentinel': {
                size: 40,
                baseColor: 0x66ff66,
                accentColor: 0x00cc00,
                glowColor: 0x33ff33,
                shape: 'hexagon',
                details: 'defensive'
            },
            'enemy-phantom': {
                size: 36,
                baseColor: 0x9966ff,
                accentColor: 0x6600cc,
                glowColor: 0xcc99ff,
                shape: 'stealth',
                details: 'angular'
            },
            'enemy-titan': {
                size: 56,
                baseColor: 0xff9966,
                accentColor: 0xcc6600,
                glowColor: 0xffaa77,
                shape: 'heavy',
                details: 'industrial'
            }
        };

        Object.entries(enemyConfigs).forEach(([key, cfg]) => {
            this.createAdvancedSprite(key, cfg);
        });
    }

    // ===== PROJECTILE TEXTURES =====
    
    generateProjectileTextures() {
        // Basic projectile
        this.createEnergyProjectile('projectile-basic', {
            size: 16,
            coreColor: 0xffff00,
            glowColor: 0xffff66,
            trailLength: 3
        });

        // Charged projectile
        this.createEnergyProjectile('projectile-charged', {
            size: 24,
            coreColor: 0x00ffff,
            glowColor: 0x00ccff,
            trailLength: 5,
            rings: true
        });

        // Enemy projectile
        this.createEnergyProjectile('projectile-enemy', {
            size: 12,
            coreColor: 0xff0000,
            glowColor: 0xff6666,
            trailLength: 2
        });

        // Special projectiles
        this.createEnergyProjectile('projectile-plasma', {
            size: 20,
            coreColor: 0x00ff00,
            glowColor: 0x66ff66,
            trailLength: 4,
            plasma: true
        });

        this.createEnergyProjectile('projectile-missile', {
            size: 18,
            coreColor: 0xff6600,
            glowColor: 0xff9900,
            shape: 'missile'
        });
    }

    // ===== POWERUP TEXTURES =====
    
    generatePowerupTextures() {
        // Health powerup
        this.createPowerupTexture('powerup-health', {
            color: 0xff0000,
            icon: 'cross',
            pulseColor: 0xff6666
        });

        // Energy powerup
        this.createPowerupTexture('powerup-energy', {
            color: 0xffff00,
            icon: 'lightning',
            pulseColor: 0xffff99
        });

        // Credits powerup
        this.createPowerupTexture('powerup-credits', {
            color: 0x00ff00,
            icon: 'coin',
            pulseColor: 0x66ff66
        });

        // Special powerups
        this.createPowerupTexture('powerup-shield', {
            color: 0x00ccff,
            icon: 'shield',
            pulseColor: 0x66ddff
        });

        this.createPowerupTexture('powerup-multishot', {
            color: 0xff66ff,
            icon: 'triple',
            pulseColor: 0xff99ff
        });
    }

    // ===== ENVIRONMENT TEXTURES =====
    
    generateEnvironmentTextures() {
        // Generate textures for all planet profiles
        for (const [type, profile] of Object.entries(PLANET_PROFILES)) {
            this.createPlanetTexture(`planet-${type}`, {
                radius: profile.spriteRadius,
                baseColor: profile.baseColor,
                surfaceType: profile.surfaceType,
                atmosphere: profile.atmosphere,
                atmosphereOpacity: profile.atmosphereOpacity || 0.3
            });
        }
        
        // Keep legacy planet textures for compatibility
        this.createPlanetTexture('planet-small', {
            radius: 80,
            baseColor: 0x666666,
            surfaceType: 'rocky',
            atmosphere: 0x333366
        });

        this.createPlanetTexture('planet-medium', {
            radius: 120,
            baseColor: 0x888888,
            surfaceType: 'cratered',
            atmosphere: 0x336633
        });

        this.createPlanetTexture('planet-large', {
            radius: 160,
            baseColor: 0xaaaaaa,
            surfaceType: 'gas',
            atmosphere: 0x663333
        });

        // Space station
        this.createSpaceStation('station', {
            size: 100,
            color: 0x999999,
            style: 'orbital'
        });

        // Asteroid variations
        this.createAsteroid('asteroid-small', { size: 40, color: 0x887766 });
        this.createAsteroid('asteroid-medium', { size: 60, color: 0x998877 });
        this.createAsteroid('asteroid-large', { size: 80, color: 0xaa9988 });
    }

    // ===== EFFECT TEXTURES =====
    
    generateEffectTextures() {
        // Particle effects
        this.createParticleTexture('particle', { size: 8, color: 0xffffff });
        this.createParticleTexture('spark', { size: 6, color: 0xffffaa, sharp: true });
        this.createParticleTexture('smoke', { size: 16, color: 0x666666, soft: true });
        
        // Shockwave effects
        this.createShockwaveTexture('shockwave', { size: 200, color: 0x00ffff });
        this.createShockwaveTexture('shockwave-heavy', { size: 300, color: 0xff6600 });
        
        // Explosion effects
        this.createExplosionTexture('explosion-core', { size: 100, color: 0xffaa00 });
        this.createExplosionTexture('explosion-debris', { size: 20, color: 0xff6600 });
        
        // Trail effects
        this.createTrailTexture('trail-engine', { size: 30, color: 0x00ccff });
        this.createTrailTexture('trail-missile', { size: 20, color: 0xff6600 });
    }

    // ===== BOSS TEXTURES =====
    
    generateBossTextures() {
        // Vortex boss
        this.createVortexTexture('vortex', {
            radius: 150,
            color: 0x9900ff,
            spirals: 5,
            glow: true
        });

        // Other boss variants
        this.createBossTexture('boss-titan', {
            size: 80,
            baseColor: 0xff0000,
            style: 'armored'
        });

        this.createBossTexture('boss-mothership', {
            size: 120,
            baseColor: 0x0099ff,
            style: 'tech'
        });
    }

    // ===== ADVANCED SPRITE CREATION =====
    
    createAdvancedSprite(key, config) {
        const { size, baseColor, accentColor, glowColor, shape, details } = config;
        const padding = 40;
        const totalSize = size + padding * 2;
        
        this.graphics.clear();
        
        // Create glow effect
        this.createGlowEffect(totalSize / 2, totalSize / 2, size / 2, glowColor);
        
        // Create main shape
        this.graphics.fillStyle(baseColor, 1);
        this.graphics.lineStyle(2, accentColor, 1);
        
        switch (shape) {
            case 'fighter':
                this.drawFighterShape(totalSize / 2, totalSize / 2, size);
                break;
            case 'diamond':
                this.drawDiamondShape(totalSize / 2, totalSize / 2, size);
                break;
            case 'hexagon':
                this.drawHexagonShape(totalSize / 2, totalSize / 2, size);
                break;
            case 'stealth':
                this.drawStealthShape(totalSize / 2, totalSize / 2, size);
                break;
            case 'heavy':
                this.drawHeavyShape(totalSize / 2, totalSize / 2, size);
                break;
            case 'shield':
                this.drawShieldShape(totalSize / 2, totalSize / 2, size);
                break;
            default:
                this.graphics.fillCircle(totalSize / 2, totalSize / 2, size / 2);
        }
        
        // Add details
        this.addSpriteDetails(totalSize / 2, totalSize / 2, size, details, accentColor);
        
        // Generate texture
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    // ===== SHAPE DRAWING METHODS =====
    
    drawFighterShape(cx, cy, size) {
        const width = size * 0.8;
        const height = size;
        
        this.graphics.beginPath();
        this.graphics.moveTo(cx + width/2, cy);
        this.graphics.lineTo(cx - width/2, cy - height/3);
        this.graphics.lineTo(cx - width/3, cy);
        this.graphics.lineTo(cx - width/2, cy + height/3);
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();
        
        // Cockpit
        this.graphics.fillStyle(0x003366, 0.5); // Reduced from 0.8 to 0.5
        this.graphics.fillEllipse(cx + width/4, cy, width/6, height/4);
    }

    drawDiamondShape(cx, cy, size) {
        this.graphics.beginPath();
        this.graphics.moveTo(cx, cy - size/2);
        this.graphics.lineTo(cx + size/3, cy);
        this.graphics.lineTo(cx, cy + size/2);
        this.graphics.lineTo(cx - size/3, cy);
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();
    }

    drawHexagonShape(cx, cy, size) {
        const radius = size / 2;
        this.graphics.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (i === 0) {
                this.graphics.moveTo(x, y);
            } else {
                this.graphics.lineTo(x, y);
            }
        }
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();
    }

    drawStealthShape(cx, cy, size) {
        const width = size * 0.7;
        const height = size;
        
        this.graphics.beginPath();
        this.graphics.moveTo(cx, cy - height/2);
        this.graphics.lineTo(cx + width/2, cy + height/3);
        this.graphics.lineTo(cx + width/4, cy + height/2);
        this.graphics.lineTo(cx - width/4, cy + height/2);
        this.graphics.lineTo(cx - width/2, cy + height/3);
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();
    }

    drawHeavyShape(cx, cy, size) {
        const width = size * 0.9;
        const height = size * 0.8;
        
        // Main body
        this.graphics.fillRect(cx - width/2, cy - height/2, width, height);
        this.graphics.strokeRect(cx - width/2, cy - height/2, width, height);
        
        // Side panels
        this.graphics.fillRect(cx - width/2 - 8, cy - height/3, 8, height * 2/3);
        this.graphics.fillRect(cx + width/2, cy - height/3, 8, height * 2/3);
    }

    drawShieldShape(cx, cy, size) {
        const numPoints = 8;
        const innerRadius = size * 0.35;
        const outerRadius = size * 0.5;
        
        this.graphics.lineStyle(4, 0x00ffff, 0.8);
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (Math.PI * 2 * i) / numPoints;
            const nextAngle = (Math.PI * 2 * (i + 1)) / numPoints;
            
            const x1 = cx + Math.cos(angle) * outerRadius;
            const y1 = cy + Math.sin(angle) * outerRadius;
            const x2 = cx + Math.cos(nextAngle) * innerRadius;
            const y2 = cy + Math.sin(nextAngle) * innerRadius;
            
            this.graphics.beginPath();
            this.graphics.moveTo(x1, y1);
            this.graphics.lineTo(x2, y2);
            this.graphics.strokePath();
        }
        
        this.graphics.lineStyle(2, 0x00ffff, 1);
        this.graphics.strokeCircle(cx, cy, outerRadius);
        this.graphics.strokeCircle(cx, cy, innerRadius);
    }

    // ===== DETAIL METHODS =====
    
    addSpriteDetails(cx, cy, size, detailType, color) {
        this.graphics.lineStyle(1, color, 0.6);
        
        switch (detailType) {
            case 'aggressive':
                // Add spikes
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI * 2 * i) / 4;
                    const x1 = cx + Math.cos(angle) * size * 0.3;
                    const y1 = cy + Math.sin(angle) * size * 0.3;
                    const x2 = cx + Math.cos(angle) * size * 0.5;
                    const y2 = cy + Math.sin(angle) * size * 0.5;
                    this.graphics.lineBetween(x1, y1, x2, y2);
                }
                break;
                
            case 'defensive':
                // Add armor plates
                this.graphics.strokeCircle(cx, cy, size * 0.35);
                this.graphics.strokeCircle(cx, cy, size * 0.25);
                break;
                
            case 'angular':
                // Add tech lines
                this.graphics.lineBetween(cx - size * 0.3, cy, cx + size * 0.3, cy);
                this.graphics.lineBetween(cx, cy - size * 0.3, cx, cy + size * 0.3);
                break;
                
            case 'industrial':
                // Add vents
                for (let i = -1; i <= 1; i++) {
                    this.graphics.fillRect(cx + i * size * 0.2 - 2, cy - size * 0.4, 4, 8);
                    this.graphics.fillRect(cx + i * size * 0.2 - 2, cy + size * 0.3, 4, 8);
                }
                break;
        }
    }

    // ===== ENERGY PROJECTILE CREATION =====
    
    createEnergyProjectile(key, config) {
        const { size, coreColor, glowColor, trailLength, rings, plasma, shape } = config;
        const padding = 20;
        const totalSize = size + padding * 2;
        
        this.graphics.clear();
        
        if (shape === 'missile') {
            // Missile shape
            this.createGlowEffect(totalSize / 2, totalSize / 2, size / 2, glowColor);
            
            this.graphics.fillStyle(coreColor, 1);
            this.graphics.beginPath();
            this.graphics.moveTo(totalSize / 2 + size / 2, totalSize / 2);
            this.graphics.lineTo(totalSize / 2 - size / 3, totalSize / 2 - size / 3);
            this.graphics.lineTo(totalSize / 2 - size / 2, totalSize / 2);
            this.graphics.lineTo(totalSize / 2 - size / 3, totalSize / 2 + size / 3);
            this.graphics.closePath();
            this.graphics.fillPath();
            
            // Exhaust
            this.graphics.fillStyle(glowColor, 0.7);
            this.graphics.fillCircle(totalSize / 2 - size / 2, totalSize / 2, size / 4);
        } else {
            // Energy ball
            // Outer glow layers
            for (let i = 3; i >= 0; i--) {
                const alpha = 0.15 * (4 - i);
                const radius = size / 2 + (i * 4);
                this.graphics.fillStyle(glowColor, alpha);
                this.graphics.fillCircle(totalSize / 2, totalSize / 2, radius);
            }
            
            // Core
            this.graphics.fillStyle(coreColor, 1);
            this.graphics.fillCircle(totalSize / 2, totalSize / 2, size / 2);
            
            // Inner bright spot
            this.graphics.fillStyle(0xffffff, 0.6); // Reduced from 0.9 to 0.6
            this.graphics.fillCircle(totalSize / 2 - size / 6, totalSize / 2 - size / 6, size / 4);
            
            // Rings
            if (rings) {
                this.graphics.lineStyle(2, coreColor, 0.5);
                this.graphics.strokeCircle(totalSize / 2, totalSize / 2, size * 0.8);
            }
            
            // Plasma effect
            if (plasma) {
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 * i) / 3;
                    const x = totalSize / 2 + Math.cos(angle) * size * 0.3;
                    const y = totalSize / 2 + Math.sin(angle) * size * 0.3;
                    this.graphics.fillStyle(0xffffff, 0.4); // Reduced from 0.6 to 0.4
                    this.graphics.fillCircle(x, y, size / 8);
                }
            }
        }
        
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    // ===== POWERUP TEXTURE CREATION =====
    
    createPowerupTexture(key, config) {
        const { color, icon, pulseColor } = config;
        const size = 40;
        const padding = 20;
        const totalSize = size + padding * 2;
        
        this.graphics.clear();
        
        // Rotating outer ring - subtle
        this.graphics.lineStyle(3, pulseColor, 0.3); // Reduced from 0.6 to 0.3
        this.graphics.strokeCircle(totalSize / 2, totalSize / 2, size / 2 + 5);
        
        // Star background - very subtle
        this.graphics.fillStyle(color, 0.1); // Reduced from 0.3 to 0.1
        this.drawStar(totalSize / 2, totalSize / 2, size / 2, size / 4, 8);
        
        // Main shape
        this.graphics.fillStyle(color, 1);
        this.graphics.lineStyle(2, 0xffffff, 0.8);
        this.drawStar(totalSize / 2, totalSize / 2, size / 2.5, size / 5, 8);
        
        // Icon
        this.graphics.fillStyle(0xffffff, 1);
        this.drawPowerupIcon(totalSize / 2, totalSize / 2, size / 3, icon, color);
        
        // Sparkles
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 * i) / 4 + Math.PI / 8;
            const x = totalSize / 2 + Math.cos(angle) * (size / 2 + 10);
            const y = totalSize / 2 + Math.sin(angle) * (size / 2 + 10);
            this.graphics.fillCircle(x, y, 2);
        }
        
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    drawPowerupIcon(cx, cy, size, icon, color) {
        switch (icon) {
            case 'cross':
                // Health cross
                this.graphics.fillRect(cx - size / 2, cy - size / 6, size, size / 3);
                this.graphics.fillRect(cx - size / 6, cy - size / 2, size / 3, size);
                break;
                
            case 'lightning':
                // Energy bolt
                this.graphics.beginPath();
                this.graphics.moveTo(cx - size / 3, cy - size / 2);
                this.graphics.lineTo(cx, cy);
                this.graphics.lineTo(cx - size / 4, cy);
                this.graphics.lineTo(cx + size / 3, cy + size / 2);
                this.graphics.lineTo(cx, cy);
                this.graphics.lineTo(cx + size / 4, cy);
                this.graphics.closePath();
                this.graphics.fillPath();
                break;
                
            case 'coin':
                // Credit symbol
                this.graphics.fillCircle(cx, cy, size / 2);
                this.graphics.fillStyle(color, 1);
                this.graphics.fillRect(cx - 2, cy - size / 3, 4, size * 2 / 3);
                this.graphics.fillStyle(0xffffff, 1); // Reset to white
                break;
                
            case 'shield':
                // Shield icon
                this.graphics.beginPath();
                this.graphics.moveTo(cx, cy - size / 2);
                this.graphics.lineTo(cx + size / 2, cy - size / 4);
                this.graphics.lineTo(cx + size / 2, cy + size / 4);
                this.graphics.lineTo(cx, cy + size / 2);
                this.graphics.lineTo(cx - size / 2, cy + size / 4);
                this.graphics.lineTo(cx - size / 2, cy - size / 4);
                this.graphics.closePath();
                this.graphics.fillPath();
                break;
                
            case 'triple':
                // Triple shot
                for (let i = -1; i <= 1; i++) {
                    this.graphics.fillCircle(cx + i * size / 3, cy, size / 6);
                }
                break;
        }
    }

    // ===== PLANET TEXTURE CREATION =====
    
    createPlanetTexture(key, config) {
        const { radius, baseColor, surfaceType, atmosphere, atmosphereOpacity = 0.3 } = config;
        const totalSize = radius * 2 + 80; // Extra space for atmosphere
        
        this.canvas.width = totalSize;
        this.canvas.height = totalSize;
        this.ctx.clearRect(0, 0, totalSize, totalSize);
        
        const cx = totalSize / 2;
        const cy = totalSize / 2;
        
        // Atmosphere glow
        const atmosphereGradient = this.ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + 40);
        atmosphereGradient.addColorStop(0, this.hexToRgba(atmosphere, atmosphereOpacity));
        atmosphereGradient.addColorStop(1, this.hexToRgba(atmosphere, 0));
        this.ctx.fillStyle = atmosphereGradient;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius + 40, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Planet base
        const gradient = this.ctx.createRadialGradient(cx - radius/3, cy - radius/3, 0, cx, cy, radius);
        gradient.addColorStop(0, this.hexToRgba(this.lightenColor(baseColor, 40), 1));
        gradient.addColorStop(0.5, this.hexToRgba(baseColor, 1));
        gradient.addColorStop(1, this.hexToRgba(this.darkenColor(baseColor, 40), 1));
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Surface details
        this.addPlanetSurface(cx, cy, radius, surfaceType, baseColor);
        
        // Create texture from canvas
        const texture = this.scene.textures.addCanvas(key, this.canvas);
        
        return texture;
    }

    addPlanetSurface(cx, cy, radius, surfaceType, baseColor) {
        switch (surfaceType) {
            case 'rocky':
                // Add craters
                for (let i = 0; i < 15; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.random() * radius * 0.8;
                    const craterX = cx + Math.cos(angle) * distance;
                    const craterY = cy + Math.sin(angle) * distance;
                    const craterRadius = Math.random() * radius * 0.2 + 5;
                    
                    this.ctx.fillStyle = this.hexToRgba(this.darkenColor(baseColor, 20), 0.5);
                    this.ctx.beginPath();
                    this.ctx.arc(craterX, craterY, craterRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                break;
                
            case 'cratered':
                // Large impact craters
                for (let i = 0; i < 8; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.random() * radius * 0.6;
                    const craterX = cx + Math.cos(angle) * distance;
                    const craterY = cy + Math.sin(angle) * distance;
                    const craterRadius = Math.random() * radius * 0.3 + 10;
                    
                    // Crater rim
                    this.ctx.strokeStyle = this.hexToRgba(this.lightenColor(baseColor, 20), 0.3);
                    this.ctx.lineWidth = 3;
                    this.ctx.beginPath();
                    this.ctx.arc(craterX, craterY, craterRadius, 0, Math.PI * 2);
                    this.ctx.stroke();
                    
                    // Crater shadow
                    this.ctx.fillStyle = this.hexToRgba(this.darkenColor(baseColor, 30), 0.4);
                    this.ctx.beginPath();
                    this.ctx.arc(craterX, craterY, craterRadius * 0.8, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                break;
                
            case 'gas':
                // Swirling gas bands
                for (let i = 0; i < 5; i++) {
                    const y = cy + (i - 2) * radius * 0.3;
                    const bandHeight = radius * 0.2;
                    const bandColor = i % 2 === 0 ? 
                        this.lightenColor(baseColor, 20) : 
                        this.darkenColor(baseColor, 20);
                    
                    this.ctx.fillStyle = this.hexToRgba(bandColor, 0.3);
                    this.ctx.fillRect(cx - radius, y - bandHeight/2, radius * 2, bandHeight);
                    
                    // Add swirls
                    this.ctx.strokeStyle = this.hexToRgba(bandColor, 0.2);
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(cx - radius, y);
                    for (let x = -radius; x < radius; x += 10) {
                        const waveY = y + Math.sin(x * 0.05) * 10;
                        this.ctx.lineTo(cx + x, waveY);
                    }
                    this.ctx.stroke();
                }
                
                // Storm spot
                const stormX = cx + radius * 0.3;
                const stormY = cy - radius * 0.2;
                this.ctx.fillStyle = this.hexToRgba(0xff6666, 0.4);
                this.ctx.beginPath();
                this.ctx.ellipse(stormX, stormY, radius * 0.2, radius * 0.1, 0, 0, Math.PI * 2);
                this.ctx.fill();
                break;
        }
    }

    // ===== SPECIAL TEXTURES =====
    
    createVortexTexture(key, config) {
        const { radius, color, spirals, glow } = config;
        const totalSize = radius * 2 + 100;
        
        this.graphics.clear();
        
        const cx = totalSize / 2;
        const cy = totalSize / 2;
        
        // Glow effect
        if (glow) {
            for (let i = 5; i >= 0; i--) {
                const alpha = 0.05 * (6 - i); // Reduced from 0.1 to 0.05 (50% reduction)
                const r = radius + (i * 15);
                this.graphics.fillStyle(color, alpha);
                this.graphics.fillCircle(cx, cy, r);
            }
        }
        
        // Spiral arms
        this.graphics.lineStyle(4, color, 0.8);
        
        for (let arm = 0; arm < spirals; arm++) {
            const startAngle = (Math.PI * 2 * arm) / spirals;
            this.graphics.beginPath();
            
            for (let i = 0; i <= 100; i++) {
                const t = i / 100;
                const angle = startAngle + t * Math.PI * 4;
                const r = t * radius;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                
                if (i === 0) {
                    this.graphics.moveTo(x, y);
                } else {
                    this.graphics.lineTo(x, y);
                }
            }
            
            this.graphics.strokePath();
        }
        
        // Center core
        this.graphics.fillStyle(0xffffff, 0.6); // Reduced from 0.9 to 0.6
        this.graphics.fillCircle(cx, cy, radius * 0.1);
        
        // Particle field
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const x = cx + Math.cos(angle) * distance;
            const y = cy + Math.sin(angle) * distance;
            const size = Math.random() * 3 + 1;
            
            this.graphics.fillStyle(color, Math.random() * 0.5 + 0.5);
            this.graphics.fillCircle(x, y, size);
        }
        
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    createSpaceStation(key, config) {
        const { size, color, style } = config;
        const totalSize = size + 40;
        
        this.graphics.clear();
        
        const cx = totalSize / 2;
        const cy = totalSize / 2;
        
        // Main structure
        this.graphics.fillStyle(color, 1);
        this.graphics.lineStyle(2, this.lightenColor(color, 20), 1);
        
        // Central hub
        this.graphics.fillCircle(cx, cy, size * 0.3);
        this.graphics.strokeCircle(cx, cy, size * 0.3);
        
        // Ring structure
        this.graphics.lineStyle(8, color, 1);
        this.graphics.strokeCircle(cx, cy, size * 0.4);
        this.graphics.lineStyle(4, this.lightenColor(color, 30), 1);
        this.graphics.strokeCircle(cx, cy, size * 0.4);
        
        // Docking arms
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 * i) / 4;
            const x1 = cx + Math.cos(angle) * size * 0.3;
            const y1 = cy + Math.sin(angle) * size * 0.3;
            const x2 = cx + Math.cos(angle) * size * 0.5;
            const y2 = cy + Math.sin(angle) * size * 0.5;
            
            this.graphics.lineStyle(6, color, 1);
            this.graphics.lineBetween(x1, y1, x2, y2);
            
            // Docking port
            this.graphics.fillStyle(0xff0000, 0.8);
            this.graphics.fillCircle(x2, y2, 4);
        }
        
        // Windows
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const x = cx + Math.cos(angle) * size * 0.25;
            const y = cy + Math.sin(angle) * size * 0.25;
            
            this.graphics.fillStyle(0x00ffff, 0.6);
            this.graphics.fillRect(x - 2, y - 2, 4, 4);
        }
        
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    createAsteroid(key, config) {
        const { size, color } = config;
        const totalSize = size + 20;
        
        this.graphics.clear();
        
        const cx = totalSize / 2;
        const cy = totalSize / 2;
        
        // Irregular shape
        const points = [];
        const numPoints = 8;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (Math.PI * 2 * i) / numPoints;
            const radius = size / 2 + (Math.random() - 0.5) * size * 0.3;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }
        
        // Draw asteroid
        this.graphics.fillStyle(color, 1);
        this.graphics.lineStyle(2, this.darkenColor(color, 20), 1);
        
        this.graphics.beginPath();
        this.graphics.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            this.graphics.lineTo(points[i].x, points[i].y);
        }
        
        this.graphics.closePath();
        this.graphics.fillPath();
        this.graphics.strokePath();
        
        // Surface details
        for (let i = 0; i < 5; i++) {
            const x = cx + (Math.random() - 0.5) * size * 0.6;
            const y = cy + (Math.random() - 0.5) * size * 0.6;
            const craterSize = Math.random() * size * 0.2 + 2;
            
            this.graphics.fillStyle(this.darkenColor(color, 30), 0.5);
            this.graphics.fillCircle(x, y, craterSize);
        }
        
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    createBossTexture(key, config) {
        const { size, baseColor, style } = config;
        const totalSize = size + 60;
        
        this.graphics.clear();
        
        const cx = totalSize / 2;
        const cy = totalSize / 2;
        
        // Boss glow
        this.createGlowEffect(cx, cy, size / 2, baseColor);
        
        // Main body
        this.graphics.fillStyle(baseColor, 1);
        this.graphics.lineStyle(3, this.lightenColor(baseColor, 30), 1);
        
        if (style === 'armored') {
            // Armored boss - angular design
            const points = [
                { x: cx, y: cy - size / 2 },
                { x: cx + size / 2, y: cy - size / 4 },
                { x: cx + size / 2, y: cy + size / 4 },
                { x: cx, y: cy + size / 2 },
                { x: cx - size / 2, y: cy + size / 4 },
                { x: cx - size / 2, y: cy - size / 4 }
            ];
            
            this.graphics.beginPath();
            this.graphics.moveTo(points[0].x, points[0].y);
            points.forEach(p => this.graphics.lineTo(p.x, p.y));
            this.graphics.closePath();
            this.graphics.fillPath();
            this.graphics.strokePath();
            
            // Armor plates
            this.graphics.fillStyle(this.darkenColor(baseColor, 20), 0.8);
            this.graphics.fillRect(cx - size / 3, cy - size / 3, size / 3, size * 2 / 3);
            this.graphics.fillRect(cx, cy - size / 3, size / 3, size * 2 / 3);
            
        } else if (style === 'tech') {
            // Tech boss - circular with components
            this.graphics.fillCircle(cx, cy, size / 2);
            this.graphics.strokeCircle(cx, cy, size / 2);
            
            // Tech rings
            this.graphics.lineStyle(2, this.lightenColor(baseColor, 40), 0.8);
            this.graphics.strokeCircle(cx, cy, size * 0.35);
            this.graphics.strokeCircle(cx, cy, size * 0.25);
            
            // Energy cores
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 * i) / 6;
                const x = cx + Math.cos(angle) * size * 0.35;
                const y = cy + Math.sin(angle) * size * 0.35;
                
                this.graphics.fillStyle(0x00ffff, 0.9);
                this.graphics.fillCircle(x, y, size * 0.08);
            }
        }
        
        // Boss emblem
        this.graphics.fillStyle(0xffffff, 0.8);
        this.drawStar(cx, cy, size * 0.2, size * 0.1, 5);
        
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    // ===== EFFECT TEXTURES =====
    
    createParticleTexture(key, config) {
        const { size, color, sharp, soft } = config;
        const totalSize = size + 10;
        
        this.graphics.clear();
        
        if (soft) {
            // Soft gradient particle
            for (let i = 3; i >= 0; i--) {
                const alpha = 0.25 * (4 - i);
                const radius = size / 2 * (1 + i * 0.3);
                this.graphics.fillStyle(color, alpha);
                this.graphics.fillCircle(totalSize / 2, totalSize / 2, radius);
            }
        } else if (sharp) {
            // Sharp star particle
            this.graphics.fillStyle(color, 1);
            this.drawStar(totalSize / 2, totalSize / 2, size / 2, size / 4, 4);
        } else {
            // Standard particle
            this.graphics.fillStyle(color, 1);
            this.graphics.fillCircle(totalSize / 2, totalSize / 2, size / 2);
            
            // Inner glow
            this.graphics.fillStyle(0xffffff, 0.5);
            this.graphics.fillCircle(totalSize / 2, totalSize / 2, size / 4);
        }
        
        this.graphics.generateTexture(key, totalSize, totalSize);
    }

    createShockwaveTexture(key, config) {
        const { size, color } = config;
        
        this.graphics.clear();
        
        const cx = size / 2;
        const cy = size / 2;
        
        // Multiple rings for depth
        for (let i = 0; i < 3; i++) {
            const radius = (size / 2) * (0.7 + i * 0.1);
            const alpha = 0.3 - i * 0.1;
            const width = 8 - i * 2;
            
            this.graphics.lineStyle(width, color, alpha);
            this.graphics.strokeCircle(cx, cy, radius);
        }
        
        // Inner bright ring
        this.graphics.lineStyle(2, 0xffffff, 0.6);
        this.graphics.strokeCircle(cx, cy, size * 0.35);
        
        this.graphics.generateTexture(key, size, size);
    }

    createExplosionTexture(key, config) {
        const { size, color } = config;
        
        this.graphics.clear();
        
        const cx = size / 2;
        const cy = size / 2;
        
        if (key.includes('core')) {
            // Explosion core - bright center fading outward
            for (let i = 5; i >= 0; i--) {
                const alpha = 1 - (i * 0.15);
                const radius = (size / 2) * (i / 5);
                const currentColor = i < 2 ? 0xffffff : color;
                
                this.graphics.fillStyle(currentColor, alpha);
                this.graphics.fillCircle(cx, cy, radius);
            }
        } else if (key.includes('debris')) {
            // Debris chunk
            this.graphics.fillStyle(color, 1);
            this.graphics.fillRect(cx - size/2, cy - size/3, size, size * 2/3);
            
            // Damage
            this.graphics.fillStyle(this.darkenColor(color, 40), 0.7);
            this.graphics.fillRect(cx - size/3, cy - size/4, size/3, size/2);
        }
        
        this.graphics.generateTexture(key, size, size);
    }

    createTrailTexture(key, config) {
        const { size, color } = config;
        
        this.graphics.clear();
        
        // Gradient trail particle
        for (let i = 3; i >= 0; i--) {
            const alpha = 0.3 * (4 - i);
            const width = size * (1 - i * 0.2);
            const height = size * 0.6 * (1 - i * 0.2);
            
            this.graphics.fillStyle(color, alpha);
            this.graphics.fillEllipse(size / 2, size / 2, width / 2, height / 2);
        }
        
        // Hot core
        this.graphics.fillStyle(0xffffff, 0.8);
        this.graphics.fillEllipse(size / 2, size / 2, size * 0.2, size * 0.15);
        
        this.graphics.generateTexture(key, size, size);
    }

    // ===== UTILITY METHODS =====
    
    createGlowEffect(cx, cy, radius, color) {
        // Much more subtle glow with wider spread
        for (let i = 3; i >= 0; i--) {
            const alpha = 0.02 * (4 - i); // Very subtle: 0.08, 0.06, 0.04, 0.02
            const r = radius + (i * radius * 0.5); // Wider spread
            this.graphics.fillStyle(color, alpha);
            this.graphics.fillCircle(cx, cy, r);
        }
    }

    drawStar(cx, cy, outerRadius, innerRadius, points) {
        this.graphics.beginPath();
        
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * i) / points - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            
            if (i === 0) {
                this.graphics.moveTo(x, y);
            } else {
                this.graphics.lineTo(x, y);
            }
        }
        
        this.graphics.closePath();
        this.graphics.fillPath();
    }

    hexToRgba(hex, alpha) {
        const r = (hex >> 16) & 255;
        const g = (hex >> 8) & 255;
        const b = hex & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    lightenColor(color, percent) {
        const factor = percent / 100;
        const r = Math.min(255, ((color >> 16) & 255) + (255 * factor));
        const g = Math.min(255, ((color >> 8) & 255) + (255 * factor));
        const b = Math.min(255, (color & 255) + (255 * factor));
        return (r << 16) | (g << 8) | b;
    }

    darkenColor(color, percent) {
        const factor = 1 - (percent / 100);
        const r = Math.floor(((color >> 16) & 255) * factor);
        const g = Math.floor(((color >> 8) & 255) * factor);
        const b = Math.floor((color & 255) * factor);
        return (r << 16) | (g << 8) | b;
    }

    // ===== TEXTURE ACCESS =====
    
    getTextureConfig(entityType, variant = null) {
        // Returns the appropriate texture key based on entity type and variant
        const textureMap = {
            player: variant === 'boost' ? 'playerBoost' : variant === 'shield' ? 'playerShield' : 'player',
            enemy: {
                swarm: 'enemy-swarm',
                sentinel: 'enemy-sentinel',
                phantom: 'enemy-phantom',
                titan: 'enemy-titan'
            },
            boss: {
                vortex: 'vortex',
                titan: 'boss-titan',
                mothership: 'boss-mothership'
            },
            projectile: {
                basic: 'projectile-basic',
                charged: 'projectile-charged',
                enemy: 'projectile-enemy',
                plasma: 'projectile-plasma',
                missile: 'projectile-missile'
            },
            powerup: {
                health: 'powerup-health',
                energy: 'powerup-energy',
                credits: 'powerup-credits',
                shield: 'powerup-shield',
                multishot: 'powerup-multishot'
            },
            planet: {
                small: 'planet-small',
                medium: 'planet-medium',
                large: 'planet-large'
            },
            environment: {
                station: 'station',
                asteroidSmall: 'asteroid-small',
                asteroidMedium: 'asteroid-medium',
                asteroidLarge: 'asteroid-large'
            }
        };

        if (typeof textureMap[entityType] === 'string') {
            return textureMap[entityType];
        } else if (textureMap[entityType] && variant) {
            return textureMap[entityType][variant];
        }
        
        return null;
    }
}

// Export for use in other modules
window.TextureGenerator = TextureGenerator;