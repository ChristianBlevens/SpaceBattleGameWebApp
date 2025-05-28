// GameScene.js - Main game scene coordinator
// REFACTORED: Now acts purely as a coordinator, delegating all logic to systems

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Game' });
        
        // Game initializer will manage all systems
        this.gameInitializer = null;
        
        // Entity collections
        this.sprites = new Map();
        this.trails = new Map();
        this.enemyGroup = null;
        this.powerupGroup = null;
        this.projectileGroup = null;
    }
    
    preload() {
        // Create textures for the game
        this.createTextures();
    }
    
    create() {
        // Add game-active class to body for CSS styling
        document.body.classList.add('game-active');
        
        // Initialize collections
        this.sprites = new Map();
        this.trails = new Map();
        this.enemyGroup = this.add.group();
        this.powerupGroup = this.add.group();
        this.projectileGroup = this.add.group();
        
        // Configure physics world
        this.matter.world.setBounds(0, 0, GameConfig.world.width, GameConfig.world.height);
        this.matter.world.setGravity(0, 0);
        
        // Initialize game systems using GameInitializer
        this.gameInitializer = new GameInitializer(this);
        this.gameInitializer.initializeAllSystems();
        
        // Get references to core systems
        const { eventBus, renderSystem, waveSystem, entityFactory, audioManager, inputSystem } = this.gameInitializer;
        
        // Store inputSystem reference for RenderSystem
        this.inputSystem = inputSystem;
        
        // Create environment through RenderSystem
        renderSystem.createEnvironment();
        
        // Set scene for entity factory
        entityFactory.setScene(this);
        
        // Create initial entities through factory
        this.createInitialEntities(entityFactory);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start game
        eventBus.emit('GAME_START');
        
        // Start first wave after delay
        this.time.delayedCall(2000, () => {
            // Initialize first wave
            // Ensure wave state is clean before starting
            this.gameInitializer.gameState.update('waves.waveInProgress', false);
            waveSystem.startWave(1);
        });
        
        // Start UI updates
        this.startUIUpdates();
        
        // Play music
        eventBus.emit('AUDIO_PLAY_MUSIC');
    }
    
    update(time, delta) {
        if (this.gameInitializer.gameState.get('game.paused')) return;
        
        const dt = delta / 1000;
        
        // Update all systems through initializer
        this.gameInitializer.updateAllSystems(dt);
        
        // Update game time
        const playTime = this.gameInitializer.gameState.get('game.playTime') + delta;
        this.gameInitializer.gameState.update('game.playTime', playTime);
    }
    
    createTextures() {
        // Create enhanced geometric textures with better visual effects
        const graphics = this.add.graphics();
        
        // Player ship (triangle) - Enhanced with metallic sheen and engine glow
        // Base hull with metallic gradient
        graphics.fillStyle(0x00ffff, 1);
        graphics.fillTriangle(0, 16, 32, 8, 0, 0);
        
        // Metallic highlight strips
        graphics.fillStyle(0x66ffff, 0.8);
        graphics.fillTriangle(2, 14, 28, 8, 2, 2);
        
        // Cockpit window
        graphics.fillStyle(0x0099cc, 1);
        graphics.fillTriangle(20, 8, 28, 10, 28, 6);
        
        // Engine core glow
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(6, 8, 3);
        graphics.fillStyle(0x00ffff, 0.6);
        graphics.fillCircle(6, 8, 5);
        
        // Hull details - panel lines
        graphics.lineStyle(1, 0x0099cc, 0.5);
        graphics.lineBetween(8, 12, 24, 8);
        graphics.lineBetween(8, 4, 24, 8);
        
        graphics.generateTexture('player', 32, 16);
        graphics.clear();
        
        // Enemy ship (generic) - Enhanced with hull details
        graphics.fillStyle(0xff0066, 1);
        graphics.fillTriangle(0, 0, 32, 8, 0, 16);
        graphics.fillStyle(0xff3388, 0.7);
        graphics.fillTriangle(3, 3, 26, 8, 3, 13);
        graphics.generateTexture('enemy', 32, 16);
        graphics.clear();
        
        // Faction-specific enemy textures with enhanced details
        // Swarm enemy - Organic bio-ship design with pulsing energy
        graphics.fillStyle(0xff69b4, 1); // Hot pink base
        graphics.fillTriangle(0, 0, 24, 6, 0, 12);
        
        // Bio-organic texture overlay
        graphics.fillStyle(0xff1493, 0.8);
        graphics.fillTriangle(2, 2, 20, 6, 2, 10);
        
        // Pulsing energy core with multiple layers
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(8, 6, 2);
        graphics.fillStyle(0xff69b4, 0.5);
        graphics.fillCircle(8, 6, 4);
        graphics.fillStyle(0xff1493, 0.3);
        graphics.fillCircle(8, 6, 6);
        
        // Organic veins
        graphics.lineStyle(1, 0xff1493, 0.6);
        graphics.lineBetween(8, 6, 2, 2);
        graphics.lineBetween(8, 6, 2, 10);
        graphics.lineBetween(8, 6, 20, 6);
        
        graphics.generateTexture('enemy-swarm', 24, 12);
        graphics.clear();
        
        // Sentinel enemy - Heavy armored fortress design
        graphics.fillStyle(0x66ff66, 1);
        graphics.fillRect(0, 0, 28, 20);
        
        // Multi-layer armor plating
        graphics.fillStyle(0x44dd44, 1);
        graphics.fillRect(2, 2, 24, 16);
        graphics.fillStyle(0x55ee55, 0.9);
        graphics.fillRect(4, 4, 20, 12);
        graphics.fillStyle(0x77ff77, 0.8);
        graphics.fillRect(6, 6, 16, 8);
        
        // Shield generator nodes
        graphics.fillStyle(0xaaffaa, 1);
        graphics.fillCircle(7, 10, 2);
        graphics.fillCircle(21, 10, 2);
        
        // Armor panel lines
        graphics.lineStyle(1, 0x33cc33, 0.8);
        graphics.lineBetween(14, 2, 14, 18);
        graphics.lineBetween(2, 10, 26, 10);
        
        graphics.generateTexture('enemy-sentinel', 28, 20);
        graphics.clear();
        
        // Phantom enemy - Stealth fighter with phase-shift technology
        graphics.fillStyle(0x9966ff, 1);
        graphics.fillTriangle(0, 8, 16, 0, 32, 8);
        graphics.fillTriangle(0, 8, 32, 8, 16, 16);
        
        // Phase-shift energy layers
        graphics.fillStyle(0xbb88ff, 0.7);
        graphics.fillTriangle(3, 8, 16, 3, 29, 8);
        graphics.fillTriangle(3, 8, 29, 8, 16, 13);
        
        // Cloaking field emitters
        graphics.fillStyle(0xddccff, 0.9);
        graphics.fillCircle(8, 8, 2);
        graphics.fillCircle(24, 8, 2);
        graphics.fillCircle(16, 8, 2);
        
        // Energy conduits
        graphics.lineStyle(1, 0xccaaff, 0.6);
        graphics.lineBetween(8, 8, 16, 0);
        graphics.lineBetween(24, 8, 16, 0);
        graphics.lineBetween(8, 8, 16, 16);
        graphics.lineBetween(24, 8, 16, 16);
        
        graphics.generateTexture('enemy-phantom', 32, 16);
        graphics.clear();
        
        // Titan enemy - Massive dreadnought with heavy weaponry
        graphics.fillStyle(0xff9966, 1);
        graphics.fillRect(0, 0, 40, 32);
        graphics.fillCircle(20, 16, 12);
        
        // Heavy armor segments with battle damage
        graphics.fillStyle(0xcc6644, 1);
        graphics.fillRect(4, 4, 32, 24);
        graphics.fillStyle(0xdd7755, 0.9);
        graphics.fillRect(8, 8, 24, 16);
        graphics.fillCircle(20, 16, 8);
        
        // Weapon hardpoints
        graphics.fillStyle(0x994422, 1);
        graphics.fillRect(2, 8, 6, 4);
        graphics.fillRect(32, 8, 6, 4);
        graphics.fillRect(2, 20, 6, 4);
        graphics.fillRect(32, 20, 6, 4);
        
        // Power core
        graphics.fillStyle(0xffaa88, 1);
        graphics.fillCircle(20, 16, 4);
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(20, 16, 2);
        
        // Hull plating lines
        graphics.lineStyle(2, 0x663322, 0.6);
        graphics.lineBetween(0, 16, 40, 16);
        graphics.lineBetween(20, 0, 20, 32);
        
        graphics.generateTexture('enemy-titan', 40, 32);
        graphics.clear();
        
        // Projectiles with enhanced glow effects
        // Basic projectile - Energy bullet with plasma core
        graphics.clear();
        // Outer glow
        graphics.fillStyle(0xffff00, 0.3);
        graphics.fillCircle(4, 4, 4);
        // Mid glow
        graphics.fillStyle(0xffff00, 0.6);
        graphics.fillCircle(4, 4, 3);
        // Inner core
        graphics.fillStyle(0xffff88, 0.9);
        graphics.fillCircle(4, 4, 2);
        // Bright center
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(4, 4, 1);
        graphics.generateTexture('projectile', 8, 8);
        graphics.generateTexture('projectile-basic', 8, 8);
        graphics.clear();
        
        // Enemy projectile - Red plasma bolt
        // Outer glow
        graphics.fillStyle(0xff0000, 0.3);
        graphics.fillCircle(4, 4, 4);
        // Mid glow
        graphics.fillStyle(0xff6666, 0.6);
        graphics.fillCircle(4, 4, 3);
        // Inner core
        graphics.fillStyle(0xff9999, 0.9);
        graphics.fillCircle(4, 4, 2);
        // Hot center
        graphics.fillStyle(0xffcccc, 1);
        graphics.fillCircle(4, 4, 1);
        graphics.generateTexture('projectile-enemy', 8, 8);
        graphics.clear();
        
        // Charged projectile - Powerful energy orb
        // Large outer aura
        graphics.fillStyle(0x0088ff, 0.2);
        graphics.fillCircle(6, 6, 6);
        // Energy field
        graphics.fillStyle(0x00aaff, 0.4);
        graphics.fillCircle(6, 6, 5);
        // Plasma layer
        graphics.fillStyle(0x00ccff, 0.6);
        graphics.fillCircle(6, 6, 4);
        // Energy core
        graphics.fillStyle(0x00eeff, 0.8);
        graphics.fillCircle(6, 6, 3);
        // Bright inner core
        graphics.fillStyle(0x88ffff, 1);
        graphics.fillCircle(6, 6, 2);
        // White hot center
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(6, 6, 1);
        
        // Add energy crackling effect
        graphics.lineStyle(1, 0x00ffff, 0.8);
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const x1 = 6 + Math.cos(angle) * 2;
            const y1 = 6 + Math.sin(angle) * 2;
            const x2 = 6 + Math.cos(angle) * 5;
            const y2 = 6 + Math.sin(angle) * 5;
            graphics.lineBetween(x1, y1, x2, y2);
        }
        
        graphics.generateTexture('projectile-charged', 12, 12);
        graphics.clear();
        
        // Powerups with enhanced visual effects
        // Health powerup - Glowing medical cross
        graphics.clear();
        // Outer pulse effect
        graphics.fillStyle(0xff0000, 0.2);
        graphics.fillCircle(8, 8, 8);
        // Glow effect
        graphics.fillStyle(0xff4444, 0.4);
        graphics.fillCircle(8, 8, 6);
        // Main cross shape
        graphics.fillStyle(0xff0000, 1);
        graphics.fillRect(6, 2, 4, 12);
        graphics.fillRect(2, 6, 12, 4);
        // Highlight
        graphics.fillStyle(0xff6666, 0.8);
        graphics.fillRect(7, 3, 2, 10);
        graphics.fillRect(3, 7, 10, 2);
        // Center gem
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(8, 8, 2);
        graphics.generateTexture('powerup-health', 16, 16);
        graphics.clear();
        
        // Energy powerup - Lightning bolt with electric aura
        // Outer electric field
        graphics.fillStyle(0x0088ff, 0.2);
        graphics.fillCircle(8, 8, 8);
        // Electric aura
        graphics.fillStyle(0x00aaff, 0.4);
        graphics.fillCircle(8, 8, 6);
        // Lightning bolt shape
        graphics.fillStyle(0x00ffff, 1);
        graphics.beginPath();
        graphics.moveTo(8, 0);
        graphics.lineTo(4, 6);
        graphics.lineTo(7, 6);
        graphics.lineTo(5, 10);
        graphics.lineTo(8, 10);
        graphics.lineTo(6, 16);
        graphics.lineTo(10, 8);
        graphics.lineTo(7, 8);
        graphics.lineTo(9, 4);
        graphics.lineTo(6, 4);
        graphics.closePath();
        graphics.fillPath();
        // Energy highlight
        graphics.fillStyle(0x88ffff, 0.8);
        graphics.beginPath();
        graphics.moveTo(8, 2);
        graphics.lineTo(6, 6);
        graphics.lineTo(7, 6);
        graphics.lineTo(6, 9);
        graphics.lineTo(7, 9);
        graphics.lineTo(6, 12);
        graphics.lineTo(8, 8);
        graphics.closePath();
        graphics.fillPath();
        // Sparks
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(5, 5, 1);
        graphics.fillCircle(11, 9, 1);
        graphics.generateTexture('powerup-energy', 16, 16);
        graphics.clear();
        
        // Credits powerup - Golden coin with shine
        // Outer golden glow
        graphics.fillStyle(0xffcc00, 0.3);
        graphics.fillCircle(8, 8, 8);
        // Mid glow
        graphics.fillStyle(0xffdd00, 0.5);
        graphics.fillCircle(8, 8, 7);
        // Main coin body
        graphics.fillStyle(0xffdd00, 1);
        graphics.fillCircle(8, 8, 6);
        // Inner ring
        graphics.lineStyle(1, 0xddaa00, 1);
        graphics.strokeCircle(8, 8, 5);
        // Credit symbol
        graphics.fillStyle(0xddaa00, 1);
        graphics.beginPath();
        graphics.moveTo(8, 4);
        graphics.lineTo(8, 12);
        graphics.moveTo(6, 6);
        graphics.lineTo(10, 6);
        graphics.moveTo(6, 10);
        graphics.lineTo(10, 10);
        graphics.stroke();
        // Shine effect
        graphics.fillStyle(0xffffff, 0.7);
        graphics.fillEllipse(6, 5, 3, 2);
        // Sparkle
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(10, 6, 1);
        graphics.generateTexture('powerup-credits', 16, 16);
        graphics.clear();
        
        // Generic powerup - Mystery box with question mark
        // Outer mystery aura
        graphics.fillStyle(0x00ff00, 0.2);
        graphics.fillCircle(8, 8, 8);
        // Glow
        graphics.fillStyle(0x44ff44, 0.4);
        graphics.fillRect(2, 2, 12, 12);
        // Main box
        graphics.fillStyle(0x00ff00, 1);
        graphics.fillRect(3, 3, 10, 10);
        // Inner detail
        graphics.fillStyle(0x00cc00, 0.8);
        graphics.fillRect(4, 4, 8, 8);
        // Question mark
        graphics.fillStyle(0xffffff, 1);
        graphics.beginPath();
        graphics.arc(8, 7, 3, Math.PI, 0, true);
        graphics.lineTo(8, 9);
        graphics.stroke();
        graphics.fillCircle(8, 11, 1);
        // Corner highlights
        graphics.fillStyle(0x88ff88, 0.8);
        graphics.fillRect(3, 3, 2, 2);
        graphics.fillRect(11, 3, 2, 2);
        graphics.generateTexture('powerup', 16, 16);
        graphics.clear();
        
        // ==================== PLANET TEXTURES - COMPLETE RECREATION ====================
        // Remove any existing planet textures
        ['planet-small', 'planet-medium', 'planet-large', 'planet'].forEach(key => {
            if (this.textures.exists(key)) this.textures.remove(key);
        });
        
        // ==================== SMALL PLANET (40 radius) - VOLCANIC WORLD ====================
        graphics.clear();
        
        // Dark volcanic base
        graphics.fillStyle(0x1a1a1a, 1);
        graphics.fillCircle(40, 40, 40);
        
        // Rocky surface layer
        graphics.fillStyle(0x2d2d2d, 1);
        graphics.fillCircle(40, 40, 38);
        
        // Lava cracks pattern
        graphics.lineStyle(2, 0xff3300, 0.9);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const startR = 10 + Math.random() * 10;
            const endR = 30 + Math.random() * 8;
            graphics.lineBetween(
                40 + Math.cos(angle) * startR,
                40 + Math.sin(angle) * startR,
                40 + Math.cos(angle + 0.1) * endR,
                40 + Math.sin(angle + 0.1) * endR
            );
        }
        
        // Lava pools
        graphics.fillStyle(0xff4400, 1);
        graphics.fillCircle(25, 30, 5);
        graphics.fillCircle(50, 35, 4);
        graphics.fillCircle(35, 50, 6);
        
        // Glowing lava centers
        graphics.fillStyle(0xffaa00, 0.8);
        graphics.fillCircle(25, 30, 3);
        graphics.fillCircle(50, 35, 2);
        graphics.fillCircle(35, 50, 4);
        
        // Volcanic ash patches
        graphics.fillStyle(0x444444, 0.6);
        for (let i = 0; i < 20; i++) {
            const x = 20 + Math.random() * 40;
            const y = 20 + Math.random() * 40;
            const size = Math.random() * 3 + 1;
            graphics.fillCircle(x, y, size);
        }
        
        // Thin toxic atmosphere
        graphics.lineStyle(3, 0xff6600, 0.2);
        graphics.strokeCircle(40, 40, 42);
        graphics.lineStyle(2, 0xffaa00, 0.1);
        graphics.strokeCircle(40, 40, 44);
        
        graphics.generateTexture('planet-small', 80, 80);
        
        // ==================== MEDIUM PLANET (60 radius) - ICE WORLD ====================
        graphics.clear();
        
        // Ice base
        graphics.fillStyle(0xd0e7ff, 1);
        graphics.fillCircle(60, 60, 60);
        
        // Ice layers
        graphics.fillStyle(0xe8f4ff, 1);
        graphics.fillCircle(60, 60, 55);
        graphics.fillStyle(0xf5faff, 1);
        graphics.fillCircle(60, 60, 45);
        
        // Frozen ocean areas
        graphics.fillStyle(0x9ec5ff, 0.8);
        graphics.beginPath();
        graphics.arc(60, 60, 50, 0, Math.PI * 0.7);
        graphics.arc(60, 60, 40, Math.PI * 0.7, 0, true);
        graphics.closePath();
        graphics.fillPath();
        
        // Ice formations and glaciers
        graphics.fillStyle(0xffffff, 0.9);
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 25;
            const x = 60 + Math.cos(angle) * dist;
            const y = 60 + Math.sin(angle) * dist;
            graphics.fillEllipse(x, y, 8 + Math.random() * 6, 5 + Math.random() * 4);
        }
        
        // Cracks in ice
        graphics.lineStyle(1, 0x7eb6ff, 0.7);
        for (let i = 0; i < 12; i++) {
            const x1 = 30 + Math.random() * 60;
            const y1 = 30 + Math.random() * 60;
            const x2 = x1 + (Math.random() - 0.5) * 20;
            const y2 = y1 + (Math.random() - 0.5) * 20;
            graphics.lineBetween(x1, y1, x2, y2);
        }
        
        // Snow drifts
        graphics.fillStyle(0xffffff, 0.6);
        for (let i = 0; i < 30; i++) {
            const x = 20 + Math.random() * 80;
            const y = 20 + Math.random() * 80;
            const size = Math.random() * 2 + 0.5;
            graphics.fillCircle(x, y, size);
        }
        
        // Frozen atmosphere with aurora effect
        graphics.lineStyle(4, 0x00ff88, 0.2);
        graphics.strokeCircle(60, 60, 63);
        graphics.lineStyle(3, 0x00ffff, 0.15);
        graphics.strokeCircle(60, 60, 66);
        graphics.lineStyle(2, 0xaaffff, 0.1);
        graphics.strokeCircle(60, 60, 69);
        
        graphics.generateTexture('planet-medium', 120, 120);
        graphics.generateTexture('planet', 120, 120);
        
        // ==================== LARGE PLANET (80 radius) - STORM GIANT ====================
        graphics.clear();
        
        // Deep purple base
        graphics.fillStyle(0x2d1b69, 1);
        graphics.fillCircle(80, 80, 80);
        
        // Purple gradient layers
        graphics.fillStyle(0x3d2b79, 1);
        graphics.fillCircle(80, 80, 70);
        graphics.fillStyle(0x4d3b89, 1);
        graphics.fillCircle(80, 80, 55);
        
        // Swirling storm bands
        for (let i = 0; i < 6; i++) {
            const y = 20 + i * 20;
            const color = i % 2 === 0 ? 0x6b4ba9 : 0x5b3b99;
            graphics.fillStyle(color, 0.8);
            
            graphics.beginPath();
            graphics.moveTo(0, y);
            for (let x = 0; x <= 160; x += 5) {
                const wave = Math.sin(x * 0.05 + i) * 4 + Math.sin(x * 0.1 + i * 2) * 2;
                graphics.lineTo(x, y + wave);
            }
            graphics.lineTo(160, y + 10);
            for (let x = 160; x >= 0; x -= 5) {
                const wave = Math.sin(x * 0.05 + i + Math.PI) * 4 + Math.sin(x * 0.1 + i * 2 + Math.PI) * 2;
                graphics.lineTo(x, y + 10 + wave);
            }
            graphics.closePath();
            graphics.fillPath();
        }
        
        // Giant storm eye (like Jupiter's red spot but purple)
        graphics.fillStyle(0x9b2bff, 1);
        graphics.fillEllipse(100, 65, 25, 18);
        
        // Storm eye details
        graphics.fillStyle(0xbb4bff, 0.7);
        graphics.fillEllipse(100, 65, 20, 14);
        graphics.fillStyle(0xdd6bff, 0.5);
        graphics.fillEllipse(100, 65, 15, 10);
        
        // Lightning in the storms
        graphics.lineStyle(1, 0xffffff, 0.9);
        for (let i = 0; i < 5; i++) {
            const x = 20 + Math.random() * 120;
            const y = 20 + Math.random() * 120;
            const endX = x + (Math.random() - 0.5) * 15;
            const endY = y + 10 + Math.random() * 10;
            
            // Zigzag lightning
            graphics.lineBetween(x, y, x + 3, y + 5);
            graphics.lineBetween(x + 3, y + 5, x - 2, y + 10);
            graphics.lineBetween(x - 2, y + 10, endX, endY);
        }
        
        // Multiple atmospheric layers
        graphics.lineStyle(8, 0x8b4ba9, 0.3);
        graphics.strokeCircle(80, 80, 84);
        graphics.lineStyle(6, 0xab6bc9, 0.2);
        graphics.strokeCircle(80, 80, 89);
        graphics.lineStyle(4, 0xcb8be9, 0.1);
        graphics.strokeCircle(80, 80, 94);
        
        graphics.generateTexture('planet-large', 160, 160);
        
        graphics.clear();
        
        // Star
        graphics.fillStyle(0xffffaa, 1);
        graphics.fillCircle(64, 64, 64);
        graphics.generateTexture('star', 128, 128);
        graphics.clear();
        
        // Vortex - spiral pattern
        const vortexSize = 256;
        const cx = vortexSize / 2;
        const cy = vortexSize / 2;
        
        // Clear and create background
        graphics.clear();
        
        // Create dark center
        graphics.fillStyle(0x000000, 0.8);
        graphics.fillCircle(cx, cy, vortexSize / 2);
        
        // Create spiral arms
        for (let arm = 0; arm < 3; arm++) {
            const baseAngle = (arm * Math.PI * 2) / 3;
            
            for (let i = 0; i < 30; i++) {
                const t = i / 30;
                const radius = t * (vortexSize / 2 - 20);
                const angle = baseAngle + t * Math.PI * 3;
                const alpha = (1 - t) * 0.8;
                const width = (1 - t) * 15 + 2;
                
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;
                
                graphics.fillStyle(0xff00ff, alpha);
                graphics.fillCircle(x, y, width);
                
                // Add glow
                graphics.fillStyle(0xff88ff, alpha * 0.5);
                graphics.fillCircle(x, y, width * 1.5);
            }
        }
        
        // Add swirling particles
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (vortexSize / 2 - 30) + 20;
            const size = Math.random() * 3 + 1;
            
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            
            graphics.fillStyle(0xffccff, Math.random() * 0.6 + 0.2);
            graphics.fillCircle(x, y, size);
        }
        
        // Add bright center core
        graphics.fillStyle(0xff00ff, 1);
        graphics.fillCircle(cx, cy, 15);
        graphics.fillStyle(0xffffff, 0.8);
        graphics.fillCircle(cx, cy, 8);
        
        // Generate the vortex texture
        graphics.generateTexture('vortex', vortexSize, vortexSize);
        graphics.clear();
        
        // Clean up
        graphics.destroy();
    }
    
    createInitialEntities(entityFactory) {
        // Create player
        const startX = GameConfig.world.width * 0.2;
        const startY = GameConfig.world.height * 0.5;
        const playerId = entityFactory.createPlayer(startX, startY);
        
        // Store player ID in game state and scene
        this.gameInitializer.gameState.setPlayerId(playerId);
        this.player = playerId;
        
        // Create orbital systems
        const orbitalSystems = [
            { x: GameConfig.world.centerX, y: GameConfig.world.centerY, planets: 5, size: 'large' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.25, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.25, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.25, y: GameConfig.world.height * 0.75, planets: 3, size: 'medium' },
            { x: GameConfig.world.width * 0.75, y: GameConfig.world.height * 0.75, planets: 3, size: 'medium' }
        ];
        
        orbitalSystems.forEach(system => {
            entityFactory.createOrbitalSystem(system.x, system.y, system.planets, system.size);
        });
        
        // Create wandering planets
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(1000, GameConfig.world.width - 1000);
            const y = Phaser.Math.Between(1000, GameConfig.world.height - 1000);
            const sizes = ['small', 'medium'];
			const size = sizes[Math.floor(Math.random() * sizes.length)];
            
            const planet = entityFactory.createPlanet(x, y, size);
            
            // Random velocity
            const angle = Math.random() * Math.PI * 2;
            const speed = Phaser.Math.Between(1, 3);
            const physics = this.gameInitializer.entityManager.getComponent(planet, 'physics');
            if (physics) {
                physics.velocity.x = Math.cos(angle) * speed;
                physics.velocity.y = Math.sin(angle) * speed;
            }
        }
        
        // Create single wandering catastrophe (combined vortex + spiral)
        const catastropheX = Phaser.Math.Between(2000, GameConfig.world.width - 2000);
        const catastropheY = Phaser.Math.Between(2000, GameConfig.world.height - 2000);
        this.catastropheId = entityFactory.createCatastrophe(catastropheX, catastropheY);
    }
    
    setupEventListeners() {
        const { eventBus, entityManager, entityFactory } = this.gameInitializer;
        
        // Game state events
        eventBus.on('GAME_PAUSE', (data) => {
            this.handlePause(data.paused);
        });
        
        // Wave events
        eventBus.on('WAVE_COMPLETE', () => {
            this.handleWaveComplete();
        });
        
        // Entity lifecycle events
        eventBus.on('DESTROY_ENTITY', (data) => {
            entityManager.destroyEntity(data.entityId);
        });
        
        // Powerup spawning
        eventBus.on('SPAWN_POWERUP', (data) => {
            entityFactory.createPowerup(data.x, data.y, data.type);
        });
        
        // UI commands
        window.addEventListener('gameCommand', (event) => {
            this.handleUICommand(event.detail);
        });
    }
    
    handlePause(paused) {
        this.gameInitializer.gameState.update('game.paused', paused);
        
        if (paused) {
            this.matter.world.pause();
        } else {
            this.matter.world.resume();
        }
    }
    
    handleWaveComplete() {
        const { gameState, combatSystem, waveSystem } = this.gameInitializer;
        const currentWave = gameState.get('waves.current');
        
        // Let CombatSystem handle rewards
        combatSystem.processWaveRewards(currentWave);
        
        // Start next wave after delay
        this.time.delayedCall(3000, () => {
            waveSystem.startWave(currentWave + 1);
        });
    }
    
    handleUICommand(data) {
        const { eventBus, gameState } = this.gameInitializer;
        
        const commands = {
            pause: () => {
                // Don't allow pausing/unpausing if game is over
                if (gameState.get('game.gameOver')) return;
                
                const paused = !gameState.get('game.paused');
                eventBus.emit('GAME_PAUSE', { paused });
            },
            restart: () => {
                // Clear UI states before restarting
                gameState.update('game.paused', false);
                gameState.update('game.gameOver', false);
                
                // Directly update Alpine.js data
                const alpineData = Alpine.$data(document.querySelector('[x-data="gameUI"]'));
                if (alpineData) {
                    alpineData.paused = false;
                    alpineData.gameOver = false;
                }
                
                this.scene.restart();
            },
            menu: () => {
                // Clear all UI states before returning to menu
                gameState.update('game.paused', false);
                gameState.update('game.gameOver', false);
                
                // Directly update Alpine.js data
                const alpineData = Alpine.$data(document.querySelector('[x-data="gameUI"]'));
                if (alpineData) {
                    alpineData.paused = false;
                    alpineData.gameOver = false;
                }
                
                // Stop the game properly before returning to menu
                eventBus.emit('AUDIO_STOP_MUSIC');
                this.matter.world.pause();
                this.scene.stop();
                this.scene.start('Menu');
            },
            upgrade: () => {
                eventBus.emit('UPGRADE_REQUEST', {
                    upgradeType: data.upgradeType
                });
            },
            sound: () => {
                this.sound.mute = !data.value;
                eventBus.emit('AUDIO_SET_MUTE', { muted: !data.value });
            }
        };
        
        if (commands[data.command]) {
            commands[data.command]();
        }
    }
    
    startUIUpdates() {
        const { gameState, abilitySystem } = this.gameInitializer;
        
        // Update UI periodically
        this.time.addEvent({
            delay: 100,
            repeat: -1,
            callback: () => {
                // Always send UI updates, even when paused
                const waveInProgress = gameState.get('waves.waveInProgress');
                // Get dash cooldown from ability system
                let dashCooldown = 0;
                if (this.gameInitializer.abilitySystem) {
                    dashCooldown = this.gameInitializer.abilitySystem.cooldowns.get('dash') || 0;
                }
                
                const state = {
                    player: {
                        health: gameState.get('player.health'),
                        maxHealth: gameState.get('player.maxHealth'),
                        energy: gameState.get('player.energy'),
                        maxEnergy: gameState.get('player.maxEnergy'),
                        alive: gameState.get('player.alive'),
                        dashCooldown: dashCooldown
                    },
                    game: {
                        credits: gameState.get('game.credits'),
                        score: gameState.get('game.score'),
                        combo: gameState.get('game.combo'),
                        comboTimer: gameState.get('game.comboTimer'),
                        paused: gameState.get('game.paused'),
                        gameOver: gameState.get('game.gameOver')
                    },
                    mission: {
                        currentWave: gameState.get('waves.current'),
                        waveInProgress: waveInProgress,
                        enemiesDefeated: gameState.get('waves.totalEnemies') - gameState.get('waves.enemiesRemaining'),
                        totalEnemies: gameState.get('waves.totalEnemies')
                    },
                    upgrades: abilitySystem.getAllUpgradeInfo()
                };
                    
                    // Debug log wave state changes
                    if (this.lastWaveInProgress !== waveInProgress) {
                        // Wave state transition detected
                        this.lastWaveInProgress = waveInProgress;
                    }
                    
                    // Add upgrade costs
                    const upgrades = {
                        damage: this.gameInitializer.upgradeSystem.getUpgradeCost('damage'),
                        speed: this.gameInitializer.upgradeSystem.getUpgradeCost('speed'),
                        defense: this.gameInitializer.upgradeSystem.getUpgradeCost('defense'),
                        energy: this.gameInitializer.upgradeSystem.getUpgradeCost('energy')
                    };
                state.upgrades = upgrades;
                
                window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: state }));
            }
        });
    }
    
    destroy() {
        // Remove game-active class from body
        document.body.classList.remove('game-active');
        
        // Release pointer lock if active
        if (this.input.mouse.locked) {
            this.input.mouse.releasePointerLock();
        }
        
        // Clean up event listeners
        window.removeEventListener('gameCommand', this.handleUICommand);
        
        // Stop music
        this.gameInitializer.eventBus.emit('AUDIO_STOP_MUSIC');
        
        // Clear collections
        this.sprites.clear();
        this.trails.clear();
        
        // Destroy game initializer (which will clean up all systems)
        this.gameInitializer.destroy();
        
        // Clear UI messages
        this.gameInitializer.uiManager.destroy();
    }
}