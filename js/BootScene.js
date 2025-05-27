// BootScene.js - Initial boot/loading scene

class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'Boot' });
    }
    
    preload() {
        // Create loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Add logo
        const logoText = this.add.text(width / 2, height / 2 - 100, 'GRAVITY WARS', {
            fontSize: '64px',
            fontFamily: 'Orbitron, monospace',
            color: '#00ffff',
            stroke: '#000066',
            strokeThickness: 6,
            padding: { x: 10, y: 10 }
        });
        logoText.setOrigin(0.5);
        
        // Add subtitle
        const subtitleText = this.add.text(width / 2, height / 2 - 40, 'COSMIC ARENA', {
            fontSize: '32px',
            fontFamily: 'Orbitron, monospace',
            color: '#ff00ff',
            stroke: '#660066',
            strokeThickness: 4,
            padding: { x: 10, y: 10 }
        });
        subtitleText.setOrigin(0.5);
        
        // Loading bar background
        const barBg = this.add.rectangle(width / 2, height / 2 + 50, 400, 20, 0x222222);
        barBg.setStrokeStyle(2, 0x00ffff);
        
        // Loading bar fill
        const barFill = this.add.rectangle(width / 2 - 198, height / 2 + 50, 0, 16, 0x00ffff);
        barFill.setOrigin(0, 0.5);
        
        // Loading text
        const loadingText = this.add.text(width / 2, height / 2 + 90, 'INITIALIZING...', {
            fontSize: '20px',
            fontFamily: 'Orbitron, monospace',
            color: '#ffffff',
            padding: { x: 5, y: 5 }
        });
        loadingText.setOrigin(0.5);
        
        // Update loading bar
        this.load.on('progress', (value) => {
            barFill.width = 396 * value;
            
            // Update loading text
            if (value < 0.3) {
                loadingText.setText('LOADING ASSETS...');
            } else if (value < 0.6) {
                loadingText.setText('INITIALIZING PHYSICS...');
            } else if (value < 0.9) {
                loadingText.setText('PREPARING UNIVERSE...');
            } else {
                loadingText.setText('READY TO LAUNCH!');
            }
        });
        
        // When loading completes
        this.load.on('complete', () => {
            // Add some particle effects
            this.createLoadingParticles();
            
            // Transition to menu after a brief delay
            this.time.delayedCall(1000, () => {
                this.cameras.main.fade(1000, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('Menu');
                });
            });
        });
        
        // Load any external assets here
        // For now, we're using procedural textures, so just simulate loading
        this.simulateLoading();
    }
    
    create() {
        // Ensure font is loaded before proceeding
        const testText = this.add.text(-100, -100, 'Test', { fontFamily: 'Orbitron, monospace' });
        this.time.delayedCall(100, () => {
            testText.destroy();
        });
        // Boot scene is complete, preload handles the transition
    }
    
    simulateLoading() {
        // Simulate loading with fake progress
        let progress = 0;
        const loadInterval = setInterval(() => {
            progress += 0.1;
            this.load.emit('progress', Math.min(progress, 1));
            
            if (progress >= 1) {
                clearInterval(loadInterval);
                this.load.emit('complete');
            }
        }, 200);
    }
    
    createLoadingParticles() {
        // Create some particle effects when loading completes
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(width * 0.3, width * 0.7);
            const y = Phaser.Math.Between(height * 0.3, height * 0.7);
            
            const particle = this.add.circle(x, y, 3, 0x00ffff);
            particle.setAlpha(0);
            
            this.tweens.add({
                targets: particle,
                x: x + Phaser.Math.Between(-100, 100),
                y: y + Phaser.Math.Between(-100, 100),
                alpha: { from: 0, to: 1 },
                scale: { from: 0, to: 2 },
                duration: 1000,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: particle,
                        alpha: 0,
                        scale: 0,
                        duration: 500,
                        onComplete: () => particle.destroy()
                    });
                }
            });
        }
    }
}