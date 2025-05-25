// MenuScene.js - Main menu scene

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Menu' });
        this.menuItems = [];
        this.selectedIndex = 0;
        this.stars = [];
        this.menuReady = false;
    }
    
    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Create animated starfield background
        this.createAnimatedBackground();
        
        // Create floating planets
        this.createFloatingPlanets();
        
        // Main title with animation
        const titleText = this.add.text(width / 2, height * 0.2, 'GRAVITY WARS', {
            fontSize: '72px',
            fontFamily: 'Orbitron',
            color: '#00ffff',
            stroke: '#000066',
            strokeThickness: 8
        });
        titleText.setOrigin(0.5);
        titleText.setScale(0);
        
        // Subtitle
        const subtitleText = this.add.text(width / 2, height * 0.3, 'COSMIC ARENA', {
            fontSize: '36px',
            fontFamily: 'Orbitron',
            color: '#ff00ff',
            stroke: '#660066',
            strokeThickness: 4
        });
        subtitleText.setOrigin(0.5);
        subtitleText.setAlpha(0);
        
        // Animate title entrance
        this.tweens.add({
            targets: titleText,
            scale: 1,
            duration: 1000,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Pulse effect
                this.tweens.add({
                    targets: titleText,
                    scale: 1.05,
                    duration: 2000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        });
        
        this.tweens.add({
            targets: subtitleText,
            alpha: 1,
            delay: 500,
            duration: 1000
        });
        
        // Create menu items
        this.createMenuItems();
        
        // Setup keyboard navigation
        this.setupKeyboardNavigation();
        
        // Setup mouse interaction
        this.setupMouseInteraction();
        
        // Add version text
        const versionText = this.add.text(10, height - 30, 'v1.0.0', {
            fontSize: '16px',
            fontFamily: 'Orbitron',
            color: '#666666'
        });
        
        // Add controls hint
        const controlsText = this.add.text(width - 10, height - 30, 'WASD: Move | Mouse: Aim | Click: Shoot', {
            fontSize: '16px',
            fontFamily: 'Orbitron',
            color: '#666666'
        });
        controlsText.setOrigin(1, 1);
        
        // Play menu music
        if (!AudioManager.music.playing()) {
            AudioManager.playMusic();
        }
        
        // Enable menu after animations
        this.time.delayedCall(1500, () => {
            this.menuReady = true;
        });
    }
    
    createAnimatedBackground() {
        // Create gradient background
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x000033, 0x000033, 0x000000, 0x000000, 1);
        bg.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        
        // Create animated stars
        for (let i = 0; i < 200; i++) {
            const star = this.add.circle(
                Phaser.Math.Between(0, this.cameras.main.width),
                Phaser.Math.Between(0, this.cameras.main.height),
                Phaser.Math.Between(1, 3),
                0xffffff,
                Phaser.Math.FloatBetween(0.3, 1)
            );
            
            // Twinkle animation
            this.tweens.add({
                targets: star,
                alpha: { from: star.alpha, to: star.alpha * 0.3 },
                duration: Phaser.Math.Between(1000, 3000),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000)
            });
            
            this.stars.push(star);
        }
        
        // Create nebula effect
        for (let i = 0; i < 3; i++) {
            const nebula = this.add.graphics();
            const x = Phaser.Math.Between(200, this.cameras.main.width - 200);
            const y = Phaser.Math.Between(200, this.cameras.main.height - 200);
            const color = Phaser.Math.Pick([0x6600ff, 0x0066ff, 0xff0066]);
            
            nebula.fillStyle(color, 0.05);
            nebula.fillCircle(x, y, 150);
            nebula.setBlendMode(Phaser.BlendModes.ADD);
            
            // Slow rotation
            this.tweens.add({
                targets: nebula,
                rotation: Math.PI * 2,
                duration: 60000,
                repeat: -1
            });
        }
    }
    
    createFloatingPlanets() {
        // Create small floating planets in the background
        const planetColors = [0xff6666, 0x66ff66, 0x6666ff, 0xffff66];
        
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Between(100, this.cameras.main.width - 100);
            const y = Phaser.Math.Between(100, this.cameras.main.height - 100);
            const size = Phaser.Math.Between(20, 40);
            const color = Phaser.Math.Pick(planetColors);
            
            // Planet body
            const planet = this.add.circle(x, y, size, color, 0.3);
            
            // Glow effect
            const glow = this.add.circle(x, y, size + 10, color, 0.1);
            
            // Float animation
            this.tweens.add({
                targets: [planet, glow],
                y: y + Phaser.Math.Between(-30, 30),
                duration: Phaser.Math.Between(3000, 5000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Rotation
            this.tweens.add({
                targets: planet,
                rotation: Math.PI * 2,
                duration: Phaser.Math.Between(20000, 40000),
                repeat: -1
            });
        }
    }
    
    createMenuItems() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const startY = height * 0.5;
        const spacing = 60;
        
        const menuOptions = [
            { text: 'NEW GAME', action: () => this.startGame() },
            { text: 'CONTINUE', action: () => this.continueGame(), disabled: !this.hasSaveGame() },
            { text: 'OPTIONS', action: () => this.showOptions() },
            { text: 'CREDITS', action: () => this.showCredits() }
        ];
        
        menuOptions.forEach((option, index) => {
            const menuItem = this.add.text(width / 2, startY + (index * spacing), option.text, {
                fontSize: '32px',
                fontFamily: 'Orbitron',
                color: option.disabled ? '#666666' : '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            });
            menuItem.setOrigin(0.5);
            menuItem.setInteractive({ useHandCursor: !option.disabled });
            menuItem.setAlpha(0);
            menuItem.setScale(0.8);
            
            // Store menu item data
            menuItem.optionData = option;
            menuItem.baseScale = 1;
            menuItem.disabled = option.disabled || false;
            
            // Animate menu item entrance
            this.tweens.add({
                targets: menuItem,
                alpha: option.disabled ? 0.5 : 1,
                scale: 1,
                delay: 800 + (index * 100),
                duration: 500,
                ease: 'Back.easeOut'
            });
            
            // Mouse hover effects
            if (!option.disabled) {
                menuItem.on('pointerover', () => {
                    if (!this.menuReady) return;
                    this.selectMenuItem(index);
                    AudioManager.play('hit');
                });
                
                menuItem.on('pointerdown', () => {
                    if (!this.menuReady) return;
                    this.activateMenuItem(index);
                });
            }
            
            this.menuItems.push(menuItem);
        });
        
        // Select first available item
        this.selectMenuItem(0);
    }
    
    setupKeyboardNavigation() {
        // Arrow keys for navigation
        this.input.keyboard.on('keydown-UP', () => {
            if (!this.menuReady) return;
            this.navigateMenu(-1);
        });
        
        this.input.keyboard.on('keydown-DOWN', () => {
            if (!this.menuReady) return;
            this.navigateMenu(1);
        });
        
        // Enter or Space to select
        this.input.keyboard.on('keydown-ENTER', () => {
            if (!this.menuReady) return;
            this.activateMenuItem(this.selectedIndex);
        });
        
        this.input.keyboard.on('keydown-SPACE', () => {
            if (!this.menuReady) return;
            this.activateMenuItem(this.selectedIndex);
        });
    }
    
    setupMouseInteraction() {
        // Track mouse movement for dynamic effects
        this.input.on('pointermove', (pointer) => {
            // Parallax effect for stars
            const centerX = this.cameras.main.width / 2;
            const centerY = this.cameras.main.height / 2;
            const dx = (pointer.x - centerX) / centerX;
            const dy = (pointer.y - centerY) / centerY;
            
            this.stars.forEach((star, index) => {
                const parallaxFactor = 0.02 * (index % 3 + 1);
                star.x += dx * parallaxFactor;
                star.y += dy * parallaxFactor;
            });
        });
    }
    
    navigateMenu(direction) {
        let newIndex = this.selectedIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = this.menuItems.length - 1;
        if (newIndex >= this.menuItems.length) newIndex = 0;
        
        // Skip disabled items
        while (this.menuItems[newIndex].disabled) {
            newIndex += direction;
            if (newIndex < 0) newIndex = this.menuItems.length - 1;
            if (newIndex >= this.menuItems.length) newIndex = 0;
            
            // Prevent infinite loop if all items are disabled
            if (newIndex === this.selectedIndex) break;
        }
        
        this.selectMenuItem(newIndex);
        AudioManager.play('hit');
    }
    
    selectMenuItem(index) {
        // Deselect previous item
        if (this.menuItems[this.selectedIndex]) {
            const prevItem = this.menuItems[this.selectedIndex];
            this.tweens.add({
                targets: prevItem,
                scale: prevItem.baseScale,
                duration: 200,
                ease: 'Power2'
            });
            prevItem.setColor('#ffffff');
        }
        
        // Select new item
        this.selectedIndex = index;
        const selectedItem = this.menuItems[this.selectedIndex];
        
        if (!selectedItem.disabled) {
            this.tweens.add({
                targets: selectedItem,
                scale: selectedItem.baseScale * 1.2,
                duration: 200,
                ease: 'Back.easeOut'
            });
            selectedItem.setColor('#00ffff');
            
            // Add glow effect
            if (!selectedItem.glowEffect) {
                selectedItem.glowEffect = this.add.rectangle(
                    selectedItem.x,
                    selectedItem.y,
                    selectedItem.width + 40,
                    selectedItem.height + 10,
                    0x00ffff,
                    0
                );
                selectedItem.glowEffect.setStrokeStyle(2, 0x00ffff, 0.5);
            }
            
            this.tweens.add({
                targets: selectedItem.glowEffect,
                alpha: { from: 0.5, to: 0.2 },
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
        }
    }
    
    activateMenuItem(index) {
        const menuItem = this.menuItems[index];
        if (!menuItem || menuItem.disabled) return;
        
        // Play selection sound
        AudioManager.play('shoot');
        
        // Visual feedback
        this.tweens.add({
            targets: menuItem,
            scale: menuItem.baseScale * 0.8,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                // Execute action
                if (menuItem.optionData && menuItem.optionData.action) {
                    menuItem.optionData.action();
                }
            }
        });
    }
    
    startGame() {
        // Fade out menu
        this.cameras.main.fade(1000, 0, 0, 0);
        
        // Stop menu music
        AudioManager.stopMusic();
        
        // Transition to game
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Game');
        });
    }
    
    continueGame() {
        // Load saved game state
        if (window.GameState && window.GameState.load()) {
            this.startGame();
        } else {
            this.showMessage('No save game found!');
        }
    }
    
    showOptions() {
        // Create options overlay
        const overlay = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            600,
            400,
            0x000000,
            0.9
        );
        overlay.setStrokeStyle(2, 0x00ffff);
        
        const optionsTitle = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 150,
            'OPTIONS',
            {
                fontSize: '36px',
                fontFamily: 'Orbitron',
                color: '#00ffff'
            }
        );
        optionsTitle.setOrigin(0.5);
        
        // Sound options
        const soundEnabled = !this.sound.mute;
        const soundText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 50,
            `Sound: ${soundEnabled ? 'ON' : 'OFF'}`,
            {
                fontSize: '24px',
                fontFamily: 'Orbitron',
                color: '#ffffff'
            }
        );
        soundText.setOrigin(0.5);
        soundText.setInteractive({ useHandCursor: true });
        
        soundText.on('pointerdown', () => {
            this.sound.mute = !this.sound.mute;
            soundText.setText(`Sound: ${!this.sound.mute ? 'ON' : 'OFF'}`);
            AudioManager.play('hit');
        });
        
        // Quality options
        const qualityText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            'Quality: HIGH',
            {
                fontSize: '24px',
                fontFamily: 'Orbitron',
                color: '#ffffff'
            }
        );
        qualityText.setOrigin(0.5);
        qualityText.setInteractive({ useHandCursor: true });
        
        // Back button
        const backButton = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 100,
            'BACK',
            {
                fontSize: '28px',
                fontFamily: 'Orbitron',
                color: '#ffffff',
                backgroundColor: '#000066',
                padding: { x: 20, y: 10 }
            }
        );
        backButton.setOrigin(0.5);
        backButton.setInteractive({ useHandCursor: true });
        
        backButton.on('pointerdown', () => {
            AudioManager.play('hit');
            overlay.destroy();
            optionsTitle.destroy();
            soundText.destroy();
            qualityText.destroy();
            backButton.destroy();
        });
    }
    
    showCredits() {
        // Create credits overlay
        const overlay = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            700,
            500,
            0x000000,
            0.9
        );
        overlay.setStrokeStyle(2, 0xff00ff);
        
        const creditsTitle = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 200,
            'CREDITS',
            {
                fontSize: '36px',
                fontFamily: 'Orbitron',
                color: '#ff00ff'
            }
        );
        creditsTitle.setOrigin(0.5);
        
        const creditsContent = [
            'GRAVITY WARS: COSMIC ARENA',
            '',
            'A game about orbital mechanics and destruction',
            '',
            'Built with Phaser 3',
            'Music and Sound powered by Howler.js',
            'UI powered by Alpine.js',
            'Effects powered by GSAP',
            '',
            'Thank you for playing!'
        ];
        
        const creditsText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            creditsContent.join('\n'),
            {
                fontSize: '18px',
                fontFamily: 'Orbitron',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 10
            }
        );
        creditsText.setOrigin(0.5);
        
        // Back button
        const backButton = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 200,
            'BACK',
            {
                fontSize: '28px',
                fontFamily: 'Orbitron',
                color: '#ffffff',
                backgroundColor: '#660066',
                padding: { x: 20, y: 10 }
            }
        );
        backButton.setOrigin(0.5);
        backButton.setInteractive({ useHandCursor: true });
        
        backButton.on('pointerdown', () => {
            AudioManager.play('hit');
            overlay.destroy();
            creditsTitle.destroy();
            creditsText.destroy();
            backButton.destroy();
        });
    }
    
    showMessage(text) {
        const message = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 100,
            text,
            {
                fontSize: '24px',
                fontFamily: 'Orbitron',
                color: '#ff0000',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        message.setOrigin(0.5);
        message.setAlpha(0);
        
        this.tweens.add({
            targets: message,
            alpha: 1,
            duration: 500,
            hold: 2000,
            yoyo: true,
            onComplete: () => message.destroy()
        });
    }
    
    hasSaveGame() {
        return localStorage.getItem('gravityWars_autosave') !== null;
    }
    
    update() {
        // Slowly rotate background stars
        this.stars.forEach((star, index) => {
            const speed = 0.0001 * (index % 3 + 1);
            star.rotation += speed;
        });
    }
}