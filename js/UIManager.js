// UIManager.js - Bridges game systems with Alpine.js UI and handles in-game messages

class UIManager {
    constructor() {
        this.eventQueue = [];
        this.notificationId = 0;
        this.scene = null; // Will be set when scene initializes
        this.activeMessages = new Map();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start update loop
        this.startUpdateLoop();
    }
    
    // Initialize with scene reference
    init(scene) {
        this.scene = scene;
    }
    
    setupEventListeners() {
        // Game events that affect UI
        window.EventBus.on(window.GameEvents.PLAYER_DAMAGE, (data) => {
            this.showDamageIndicator();
        });
        
        window.EventBus.on(window.GameEvents.PLAYER_HEAL, (data) => {
            this.showHealEffect();
        });
        
        window.EventBus.on(window.GameEvents.ENEMY_DEATH, (data) => {
            this.showKillNotification(data);
        });
        
        window.EventBus.on(window.GameEvents.COMBO_INCREASE, (data) => {
            this.showComboEffect(data.combo);
        });
        
        window.EventBus.on(window.GameEvents.WAVE_START, (data) => {
            this.updateMission({
                name: `Wave ${data.wave}`,
                objectives: [
                    {
                        description: 'Defeat all enemies',
                        current: 0,
                        target: data.enemies,
                        completed: false
                    }
                ],
                rewards: {
                    credits: 500 * data.wave
                }
            });
            
            // Show wave start message
            this.showGameMessage(`WAVE ${data.wave}`, 'ENEMIES INCOMING!', 'wave-start');
        });
        
        window.EventBus.on(window.GameEvents.WAVE_COMPLETE, (data) => {
            this.showWaveCompleteMessage(data.waveNumber, data.callback);
        });
        
        window.EventBus.on(window.GameEvents.PICKUP_COLLECT, (data) => {
            this.showPickupNotification(data);
        });
        
        window.EventBus.on(window.GameEvents.UI_NOTIFICATION, (data) => {
            this.showNotification(data.message, data.type, data.icon);
        });
        
        window.EventBus.on(window.GameEvents.GAME_OVER, (data) => {
            this.showGameOverMessage(data.victory);
        });
    }
    
    // In-game message system
    showGameMessage(title, subtitle = '', messageType = 'default', duration = 3000) {
        if (!this.scene) return;
        
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
        this.scene.time.delayedCall(duration, () => {
            this.dismissGameMessage(messageId);
        });
        
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
    
    showWaveCompleteMessage(waveNumber, callback) {
        const messageId = this.showGameMessage(
            `WAVE ${waveNumber} COMPLETE!`,
            `+${1000 * waveNumber} POINTS`,
            'wave-complete',
            2500
        );
        
        // Override the auto-dismiss to use the callback
        this.scene.time.delayedCall(2500, () => {
            this.dismissGameMessage(messageId, callback);
        });
    }
    
    showGameOverMessage(victory = false) {
        if (victory) {
            this.showGameMessage(
                'VICTORY!',
                'ALL WAVES COMPLETED',
                'victory',
                0 // Don't auto-dismiss
            );
        } else {
            this.showGameMessage(
                'GAME OVER',
                'PRESS R TO RESTART',
                'game-over',
                0 // Don't auto-dismiss
            );
        }
    }
    
    // Combo display
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
    
    startUpdateLoop() {
        setInterval(() => {
            this.processEventQueue();
            this.updateComboDisplay();
        }, 16); // 60 FPS
    }
    
    updateComboDisplay() {
        // Hide combo if timer expired
        const comboTimer = window.GameState.get('game.comboTimer');
        if (comboTimer <= 0 && this.activeMessages.has('combo')) {
            this.hideComboMessage();
        }
    }
    
    processEventQueue() {
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift();
            this.dispatchToAlpine(event.type, event.data);
        }
    }
    
    dispatchToAlpine(type, data) {
        window.dispatchEvent(new CustomEvent('uiEvent', {
            detail: { type, ...data }
        }));
    }
    
    queueEvent(type, data) {
        this.eventQueue.push({ type, data });
    }
    
    // UI Effects
    showDamageIndicator() {
        // Flash screen red
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(ellipse at center, transparent 0%, rgba(255, 0, 0, 0.3) 100%);
            pointer-events: none;
            z-index: 1000;
            animation: damageFlash 0.3s ease-out;
        `;
        
        document.body.appendChild(overlay);
        
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
    
    showHealEffect() {
        // Green healing particles
        const container = document.getElementById('ui-overlay');
        if (!container) return;
        
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            const startX = Math.random() * window.innerWidth;
            const startY = window.innerHeight;
            
            particle.style.cssText = `
                position: fixed;
                left: ${startX}px;
                top: ${startY}px;
                width: 20px;
                height: 20px;
                background: #00ff00;
                border-radius: 50%;
                pointer-events: none;
                z-index: 1001;
                box-shadow: 0 0 10px #00ff00;
            `;
            
            container.appendChild(particle);
            
            // Animate upward
            const animation = particle.animate([
                { 
                    transform: 'translate(0, 0) scale(1)',
                    opacity: 1
                },
                { 
                    transform: `translate(${Math.random() * 100 - 50}px, -200px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration: 1000,
                easing: 'ease-out'
            });
            
            animation.onfinish = () => particle.remove();
        }
    }
    
    showKillNotification(data) {
        const messages = [
            'ELIMINATED!',
            'DESTROYED!',
            'OBLITERATED!',
            'VAPORIZED!',
            'ANNIHILATED!'
        ];
        
        const message = messages[Math.floor(Math.random() * messages.length)];
        this.showNotification(message, 'kill', 'fa-skull');
    }
    
    showComboEffect(combo) {
        // Update in-game combo display
        this.showComboMessage(combo);
        
        // Show special notifications for milestones
        if (combo === 5) {
            this.showNotification('COMBO x5!', 'achievement', 'fa-fire');
        } else if (combo === 10) {
            this.showNotification('COMBO x10! UNSTOPPABLE!', 'achievement', 'fa-fire-flame-curved');
        } else if (combo === 20) {
            this.showNotification('COMBO x20! LEGENDARY!', 'achievement', 'fa-crown');
        }
    }
    
    showPickupNotification(data) {
        const icons = {
            health: 'fa-heart',
            energy: 'fa-bolt',
            credits: 'fa-coins'
        };
        
        this.showNotification(
            `+${data.value} ${data.type.toUpperCase()}`,
            'powerup',
            icons[data.type] || 'fa-star'
        );
    }
    
    showNotification(message, type, icon) {
        this.queueEvent('notification', {
            id: this.notificationId++,
            message: message,
            type: type,
            icon: icon,
            visible: true
        });
    }
    
    updateMission(missionData) {
        this.queueEvent('missionUpdate', {
            mission: missionData
        });
    }
    
    // Static UI updates
    static updateHealthBar(health, maxHealth) {
        const healthBar = document.querySelector('.health-fill');
        if (healthBar) {
            const percent = (health / maxHealth) * 100;
            healthBar.style.width = `${percent}%`;
            
            // Change color based on health
            if (percent < 30) {
                healthBar.classList.add('low');
            } else {
                healthBar.classList.remove('low');
            }
        }
    }
    
    static updateEnergyBar(energy, maxEnergy) {
        const energyBar = document.querySelector('.energy-fill');
        if (energyBar) {
            const percent = (energy / maxEnergy) * 100;
            energyBar.style.width = `${percent}%`;
        }
    }
    
    static showChargeIndicator(percent) {
        const indicator = document.querySelector('.charge-indicator');
        if (indicator) {
            if (percent > 0) {
                indicator.style.display = 'block';
                const progress = indicator.querySelector('.charge-progress');
                if (progress) {
                    const circumference = 283; // 2 * PI * 45 (radius)
                    progress.style.strokeDashoffset = circumference - (circumference * percent / 100);
                }
            } else {
                indicator.style.display = 'none';
            }
        }
    }
    
    // Clean up when scene changes
    destroy() {
        // Clear all active messages
        this.activeMessages.forEach((message, id) => {
            if (message.titleText) message.titleText.destroy();
            if (message.subtitleText) message.subtitleText.destroy();
        });
        this.activeMessages.clear();
        
        // Clear event queue
        this.eventQueue = [];
    }
}

// Initialize UI Manager
const uiManager = new UIManager();

// Export for use in other modules
window.UIManager = uiManager;