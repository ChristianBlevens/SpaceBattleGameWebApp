// InputSystem.js - Handles all player input

class InputSystem {
    constructor(scene, eventBus, entityManager, gameState) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.gameState = gameState;
        this.playerId = null;
        
        // Input states
        this.keys = null;
        this.pointer = null;
        this.touchControls = null;
        
        // Movement vector
        this.moveVector = { x: 0, y: 0 };
        this.aimAngle = 0;
        this.isShooting = false;
    }
    
    init() {
        // Get player ID
        this.playerId = this.gameState.getPlayerId();
        
        this.setupKeyboard();
        this.setupMouse();
        
        if (this.scene.sys.game.device.input.touch) {
            this.setupTouch();
        }
    }
    
    setupKeyboard() {
        this.keys = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            boost: Phaser.Input.Keyboard.KeyCodes.SHIFT,
            brake: Phaser.Input.Keyboard.KeyCodes.SPACE,
            pause: Phaser.Input.Keyboard.KeyCodes.ESC,
            debug: Phaser.Input.Keyboard.KeyCodes.F1,
            ability1: Phaser.Input.Keyboard.KeyCodes.ONE,
            ability2: Phaser.Input.Keyboard.KeyCodes.TWO,
            ability3: Phaser.Input.Keyboard.KeyCodes.THREE
        });
        
        // Pause handler
        this.keys.pause.on('down', () => {
            const paused = !this.gameState.get('game.paused');
            this.gameState.update('game.paused', paused);
            this.eventBus.emit('GAME_PAUSE', { paused });
        });
        
        // Debug toggle
        this.keys.debug.on('down', () => {
            this.eventBus.emit('debug:toggle');
        });
        
        // Ability shortcuts
        this.keys.ability1.on('down', () => {
            this.eventBus.emit('PLAYER_ABILITY', { ability: 'boost' });
        });
        
        this.keys.ability2.on('down', () => {
            this.eventBus.emit('PLAYER_ABILITY', { ability: 'shield' });
        });
        
        this.keys.ability3.on('down', () => {
            this.eventBus.emit('PLAYER_ABILITY', { ability: 'blast' });
        });
    }
    
    setupMouse() {
        this.pointer = this.scene.input.activePointer;
        
        // Track shooting state
        this.scene.input.on('pointerdown', () => {
            this.isShooting = true;
        });
        
        this.scene.input.on('pointerup', () => {
            this.isShooting = false;
        });
    }
    
    setupTouch() {
        // Virtual joystick
        const baseX = 150;
        const baseY = this.scene.cameras.main.height - 150;
        
        const joystickBase = this.scene.add.circle(baseX, baseY, 80, 0x000000, 0.5);
        const joystickThumb = this.scene.add.circle(baseX, baseY, 40, 0x00ffff, 0.8);
        
        joystickBase.setScrollFactor(0);
        joystickThumb.setScrollFactor(0);
        joystickBase.setInteractive();
        
        let joystickDown = false;
        
        this.touchControls = {
            joystickBase,
            joystickThumb,
            vector: { x: 0, y: 0 }
        };
        
        joystickBase.on('pointerdown', () => {
            joystickDown = true;
        });
        
        this.scene.input.on('pointermove', (pointer) => {
            if (joystickDown && pointer.x < 300) {
                const dx = pointer.x - baseX;
                const dy = pointer.y - baseY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= 80) {
                    joystickThumb.x = pointer.x;
                    joystickThumb.y = pointer.y;
                    this.touchControls.vector.x = dx / 80;
                    this.touchControls.vector.y = dy / 80;
                } else {
                    const angle = Math.atan2(dy, dx);
                    joystickThumb.x = baseX + Math.cos(angle) * 80;
                    joystickThumb.y = baseY + Math.sin(angle) * 80;
                    this.touchControls.vector.x = Math.cos(angle);
                    this.touchControls.vector.y = Math.sin(angle);
                }
            }
        });
        
        this.scene.input.on('pointerup', (pointer) => {
            if (pointer.x < 300) {
                joystickDown = false;
                joystickThumb.x = baseX;
                joystickThumb.y = baseY;
                this.touchControls.vector.x = 0;
                this.touchControls.vector.y = 0;
            }
        });
        
        // Fire button for mobile
        const fireButton = this.scene.add.circle(
            this.scene.cameras.main.width - 150,
            this.scene.cameras.main.height - 150,
            60, 0xff0000, 0.8
        );
        fireButton.setScrollFactor(0);
        fireButton.setInteractive();
        
        fireButton.on('pointerdown', () => {
            this.isShooting = true;
        });
        
        fireButton.on('pointerup', () => {
            this.isShooting = false;
        });
    }
    
    update(deltaTime) {
        if (this.gameState.get('game.paused')) return;
        
        // Debug: Check if we have a valid player ID
        if (!this.playerId) {
            this.playerId = this.gameState.getPlayerId();
            if (!this.playerId) {
                console.log('[InputSystem] No player ID available yet');
                return;
            }
            console.log('[InputSystem] Got player ID:', this.playerId);
        }
        
        // Update movement vector
        this.updateMovement();
        
        // Update aim
        this.updateAim();
        
        // Handle shooting
        this.updateShooting(deltaTime);
        
        // Apply movement to player
        this.applyPlayerMovement();
    }
    
    updateMovement() {
        this.moveVector.x = 0;
        this.moveVector.y = 0;
        
        // Keyboard input
        if (this.keys.left.isDown) this.moveVector.x -= 1;
        if (this.keys.right.isDown) this.moveVector.x += 1;
        if (this.keys.up.isDown) this.moveVector.y -= 1;
        if (this.keys.down.isDown) this.moveVector.y += 1;
        
        // Debug log when movement is detected
        if (this.moveVector.x !== 0 || this.moveVector.y !== 0) {
            console.log('[InputSystem] Movement detected:', this.moveVector);
        }
        
        // Touch input
        if (this.touchControls) {
            this.moveVector.x += this.touchControls.vector.x;
            this.moveVector.y += this.touchControls.vector.y;
        }
        
        // Normalize diagonal movement
        const magnitude = Math.sqrt(this.moveVector.x ** 2 + this.moveVector.y ** 2);
        if (magnitude > 1) {
            this.moveVector.x /= magnitude;
            this.moveVector.y /= magnitude;
        }
    }
    
    updateAim() {
        const playerSprite = this.scene.sprites.get(this.playerId);
        if (!playerSprite) return;
        
        // Get world position of pointer
        const worldPoint = this.scene.cameras.main.getWorldPoint(this.pointer.x, this.pointer.y);
        
        // Calculate angle from player to pointer
        this.aimAngle = Phaser.Math.Angle.Between(
            playerSprite.x,
            playerSprite.y,
            worldPoint.x,
            worldPoint.y
        );
        
        // Update player rotation
        playerSprite.setRotation(this.aimAngle);
    }
    
    updateShooting(deltaTime) {
        const weapon = this.entityManager.getComponent(this.playerId, 'weapon');
        if (!weapon) return;
        
        if (this.isShooting) {
            // Charge weapon
            weapon.charging = true;
            weapon.chargeTime += deltaTime * 1000;
            
            // Update charge UI
            const chargePercent = Math.min(100, (weapon.chargeTime / weapon.maxChargeTime) * 100);
            UIManager.showChargeIndicator(chargePercent);
            
            // Emit charging event
            this.eventBus.emit('PLAYER_SHOOT', {
                charging: true,
                chargePercent: chargePercent
            });
        } else if (weapon.charging) {
            // Fire weapon
            this.eventBus.emit('PLAYER_SHOOT', {
                charging: false,
                angle: this.aimAngle,
                chargeTime: weapon.chargeTime
            });
            
            // Reset charge
            weapon.charging = false;
            weapon.chargeTime = 0;
            UIManager.showChargeIndicator(0);
        }
    }
    
    applyPlayerMovement() {
        if (this.moveVector.x === 0 && this.moveVector.y === 0) return;
        
        const playerSprite = this.scene.sprites.get(this.playerId);
        if (!playerSprite) {
            console.log('[InputSystem] No player sprite found for ID:', this.playerId);
            return;
        }
        
        const stats = this.gameState.get('player.stats');
        const force = (stats.speed || GameConfig.player.baseSpeed) * 0.001;
        
        // Apply boost if shift is held
        let boostMultiplier = 1;
        if (this.keys.boost.isDown) {
            const energy = this.gameState.get('player.energy');
            if (energy > 0) {
                boostMultiplier = 1.5;
                this.gameState.update('player.energy', Math.max(0, energy - 0.5));
            }
        }
        
        // Apply force to the Matter.js body
        if (playerSprite.body) {
            const forceVector = {
                x: this.moveVector.x * force * boostMultiplier,
                y: this.moveVector.y * force * boostMultiplier
            };
            Matter.Body.applyForce(playerSprite.body, playerSprite.body.position, forceVector);
        }
    }
    
    getMoveVector() {
        return this.moveVector;
    }
    
    getAimAngle() {
        return this.aimAngle;
    }
    
    isCharging() {
        return this.isShooting;
    }
}

// InputSystem will be instantiated by GameInitializer
window.InputSystem = InputSystem;