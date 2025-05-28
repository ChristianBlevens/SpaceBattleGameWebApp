// UIManager.js - Manages HTML UI updates and notifications only
// REFACTORED: Removed all Phaser scene manipulation, now pure HTML UI management

class UIManager {
    constructor(eventBus, gameState) {
        this.eventBus = eventBus;
        this.gameState = gameState;
        this.eventQueue = [];
        this.notificationId = 0;
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start update loop
        this.startUpdateLoop();
    }
    
    init() {
        // No scene reference needed anymore
        // UI Manager ready
    }
    
    setupEventListeners() {
        // Game events that affect UI
        this.eventBus.on('PLAYER_DAMAGED', (data) => {
            this.showDamageIndicator();
        });
        
        this.eventBus.on('PLAYER_HEAL', (data) => {
            this.showHealEffect();
        });
        
        this.eventBus.on('ENEMY_KILLED', (data) => {
            this.showKillNotification(data);
            
            // Update the mission objectives
            const currentMission = this.gameState.get('waves.current');
            const totalEnemies = this.gameState.get('waves.totalEnemies') || 0;
            const enemiesRemaining = this.gameState.get('waves.enemiesRemaining') || 0;
            const enemiesDefeated = totalEnemies - enemiesRemaining;
            
            // Update mission objective
            this.updateMission({
                name: `Wave ${currentMission}`,
                objectives: [
                    {
                        description: 'Defeat all enemies',
                        current: enemiesDefeated,
                        target: totalEnemies,
                        completed: enemiesRemaining === 0
                    }
                ],
                rewards: {
                    credits: 500 * currentMission
                }
            });
            
            // Update the wave tracking state
            window.dispatchEvent(new CustomEvent('gameStateUpdate', {
                detail: {
                    mission: {
                        currentWave: currentMission,
                        waveInProgress: this.gameState.get('waves.waveInProgress'),
                        enemiesDefeated: enemiesDefeated,
                        totalEnemies: totalEnemies
                    }
                }
            }));
        });
        
        this.eventBus.on('COMBO_INCREASE', (data) => {
            this.showComboNotification(data.combo);
        });
        
        this.eventBus.on('COMBO_BREAK', () => {
            // Just update UI state, RenderSystem handles the in-game display
        });
        
        this.eventBus.on('WAVE_START', (data) => {
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
            
            // Update the wave tracking state
            window.dispatchEvent(new CustomEvent('gameStateUpdate', {
                detail: {
                    mission: {
                        currentWave: data.wave,
                        waveInProgress: true,
                        enemiesDefeated: 0,
                        totalEnemies: data.enemies
                    }
                }
            }));
        });
        
        this.eventBus.on('POWERUP_COLLECTED', (data) => {
            this.showPickupNotification(data);
        });
        
        this.eventBus.on('UI_NOTIFICATION', (data) => {
            this.showNotification(data.message, data.type, data.icon);
        });
        
        this.eventBus.on('PLAYER_CHARGE_UPDATE', (data) => {
            this.updateChargeIndicator(data.percent);
        });
        
        this.eventBus.on('UI_CHARGE_UPDATE', (data) => {
            this.updateChargeIndicator(data.percent);
        });
        
        this.eventBus.on('UPGRADE_APPLIED', (data) => {
            this.updateUpgradeDisplay(data);
        });

        this.eventBus.on('GAME_OVER', (data) => {
            this.showGameOverUI(data.victory);
        });
        
        // Listen for UI update events from GameState
        this.eventBus.on('UI_UPDATE', (state) => {
            this.update(state);
        });
        
        this.eventBus.on('UI_SHOW_MESSAGE', (data) => {
            this.showMessage(data.message, data.type, data.duration);
        });
        
        // Disaster events
        this.eventBus.on('disasterWarning', (data) => {
            this.showDisasterWarning(data);
        });
        
        this.eventBus.on('disasterStart', (data) => {
            this.showDisaster(data);
        });
        
        this.eventBus.on('disasterEnd', (data) => {
            this.hideDisaster();
        });
        
        this.eventBus.on('disableAbilities', (disabled) => {
            window.dispatchEvent(new CustomEvent('gameStateUpdate', {
                detail: { abilitiesDisabled: disabled }
            }));
        });
        
        // Boss events
        this.eventBus.on('CREATE_BOSS_HEALTH_BAR', (data) => {
            this.createBossHealthBar(data.name, data.maxHealth);
        });
        
        this.eventBus.on('UPDATE_BOSS_HEALTH_BAR', (data) => {
            this.updateBossHealthBar(data.percent);
        });
        
        this.eventBus.on('BOSS_DEFEATED', () => {
            this.removeBossHealthBar();
            this.showNotification('BOSS DEFEATED!', 'achievement', 'fa-crown');
        });
        
        this.eventBus.on('BOSS_SPAWNED', (data) => {
            this.showNotification(`${data.name} has arrived!`, 'danger', 'fa-skull');
        });
        
        this.eventBus.on('BOSS_PHASE_ANNOUNCEMENT', (data) => {
            this.showNotification(`BOSS INCOMING - Wave ${data.waveNumber} Complete!`, 'warning', 'fa-exclamation-triangle');
        });
        
        this.eventBus.on('BOSS_REWARD', (data) => {
            this.showNotification(`Boss Defeated! +${data.credits} credits, +${data.upgrades} upgrades!`, 'achievement', 'fa-trophy');
        });
        
        this.eventBus.on('REMOVE_BOSS_HEALTH_BAR', () => {
            this.removeBossHealthBar();
        });
    }
    
    startUpdateLoop() {
        setInterval(() => {
            this.processEventQueue();
        }, 16); // 60 FPS
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
    
    showComboNotification(combo) {
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
    
    updateChargeIndicator(percent) {
        // Update via Alpine.js data
        window.dispatchEvent(new CustomEvent('gameStateUpdate', {
            detail: {
                charging: percent > 0,
                chargePercent: percent
            }
        }));
    }
    
    updateUpgradeDisplay(data) {
        this.queueEvent('upgradeApplied', {
            upgradeType: data.upgradeType,
            newLevel: data.newLevel,
            newValue: data.newValue
        });
    }
    
    showGameOverUI(victory) {
        this.queueEvent('gameOver', {
            victory: victory,
            finalScore: this.gameState.get('game.score'),
            wavesCompleted: this.gameState.get('waves.current') - 1,
            totalKills: this.gameState.get('game.totalKills')
        });
    }
    
    update(state) {
        // Update UI elements based on state
        if (state.player) {
            UIManager.updateHealthBar(state.player.health, state.player.maxHealth);
            UIManager.updateEnergyBar(state.player.energy, state.player.maxEnergy);
        }
    }
    
    showMessage(message, type, duration = 3000) {
        this.showNotification(message, type || 'info', 'fa-info-circle');
        if (duration > 0) {
            setTimeout(() => {
                this.queueEvent('dismissNotification', { id: this.notificationId - 1 });
            }, duration);
        }
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
    
    // Disaster UI methods
    showDisasterWarning(data) {
        window.dispatchEvent(new CustomEvent('gameStateUpdate', {
            detail: { 
                disasterWarning: true,
                disasterWarningMessage: data.message || 'Disaster Incoming!'
            }
        }));
        
        // Hide warning after specified time
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('gameStateUpdate', {
                detail: { disasterWarning: false }
            }));
        }, data.time || 3000);
    }
    
    showDisaster(data) {
        window.dispatchEvent(new CustomEvent('gameStateUpdate', {
            detail: { 
                activeDisaster: {
                    type: data.type,
                    name: data.name,
                    duration: data.duration,
                    elapsed: 0
                }
            }
        }));
        
        // Show notification
        this.showNotification(`${data.name} Active!`, 'danger', 'fa-radiation');
        
        // Update elapsed time
        this.disasterUpdateInterval = setInterval(() => {
            window.dispatchEvent(new CustomEvent('gameStateUpdate', {
                detail: { 
                    activeDisaster: {
                        type: data.type,
                        name: data.name,
                        duration: data.duration,
                        elapsed: (Date.now() - this.disasterStartTime)
                    }
                }
            }));
        }, 100);
        
        this.disasterStartTime = Date.now();
    }
    
    hideDisaster() {
        if (this.disasterUpdateInterval) {
            clearInterval(this.disasterUpdateInterval);
            this.disasterUpdateInterval = null;
        }
        
        window.dispatchEvent(new CustomEvent('gameStateUpdate', {
            detail: { activeDisaster: null }
        }));
        
        this.showNotification('Disaster Ended', 'success', 'fa-check-circle');
    }
    
    // Clean up
    destroy() {
        // Clear event queue
        this.eventQueue = [];
        
        // Clear disaster interval
        if (this.disasterUpdateInterval) {
            clearInterval(this.disasterUpdateInterval);
        }
    }
    
    // Static method to show charge indicator (called from InputSystem)
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
    
    // Boss health bar methods
    createBossHealthBar(name, maxHealth) {
        // Create boss health bar container
        let bossHealthContainer = document.getElementById('boss-health-container');
        if (!bossHealthContainer) {
            bossHealthContainer = document.createElement('div');
            bossHealthContainer.id = 'boss-health-container';
            bossHealthContainer.style.cssText = `
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                width: 60%;
                max-width: 600px;
                background: rgba(0, 0, 0, 0.8);
                border: 3px solid #ff0000;
                border-radius: 10px;
                padding: 10px;
                z-index: 1000;
                display: none;
                box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
            `;
            document.body.appendChild(bossHealthContainer);
        }
        
        // Create boss health bar content
        bossHealthContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 10px;">
                <h2 style="color: #ff0000; margin: 0; font-family: 'Orbitron', monospace; font-size: 24px; text-shadow: 0 0 10px #ff0000;">
                    <i class="fa fa-skull"></i> ${name} <i class="fa fa-skull"></i>
                </h2>
            </div>
            <div style="position: relative; height: 30px; background: #111; border: 2px solid #ff0000; border-radius: 15px; overflow: hidden;">
                <div id="boss-health-fill" style="
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, #ff0000, #ff4444);
                    transition: width 0.3s ease;
                    box-shadow: 0 0 10px #ff0000;
                "></div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-family: 'Orbitron', monospace;">
                    <span id="boss-health-text">100%</span>
                </div>
            </div>
        `;
        
        // Show with animation
        bossHealthContainer.style.display = 'block';
        bossHealthContainer.animate([
            { opacity: 0, transform: 'translateX(-50%) translateY(-20px)' },
            { opacity: 1, transform: 'translateX(-50%) translateY(0)' }
        ], {
            duration: 500,
            easing: 'ease-out'
        });
        
        // Store max health for percentage calculations
        this.bossMaxHealth = maxHealth;
    }
    
    updateBossHealthBar(healthPercent) {
        const healthFill = document.getElementById('boss-health-fill');
        const healthText = document.getElementById('boss-health-text');
        
        if (healthFill && healthText) {
            healthFill.style.width = `${healthPercent * 100}%`;
            healthText.textContent = `${Math.floor(healthPercent * 100)}%`;
            
            // Change color based on health
            if (healthPercent < 0.25) {
                healthFill.style.background = 'linear-gradient(90deg, #ff0000, #880000)';
            } else if (healthPercent < 0.5) {
                healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
            }
        }
    }
    
    removeBossHealthBar() {
        const bossHealthContainer = document.getElementById('boss-health-container');
        if (bossHealthContainer) {
            bossHealthContainer.animate([
                { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
                { opacity: 0, transform: 'translateX(-50%) translateY(-20px)' }
            ], {
                duration: 500,
                easing: 'ease-in'
            }).onfinish = () => bossHealthContainer.remove();
        }
    }
}

// UIManager will be instantiated by GameInitializer
window.UIManager = UIManager;