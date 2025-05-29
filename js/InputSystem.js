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
        
        // Dash cooldown
        this.dashCooldown = 0;
        this.dashCooldownTime = 5000; // 5 seconds
        this.dashSpeed = 25; // Minimum dash speed
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
            markers: Phaser.Input.Keyboard.KeyCodes.C,
            dash: Phaser.Input.Keyboard.KeyCodes.SPACE,
            pause: Phaser.Input.Keyboard.KeyCodes.ESC,
            pauseKey: Phaser.Input.Keyboard.KeyCodes.P,
            debug: Phaser.Input.Keyboard.KeyCodes.F1,
            ability1: Phaser.Input.Keyboard.KeyCodes.ONE,
            ability2: Phaser.Input.Keyboard.KeyCodes.TWO,
            ability3: Phaser.Input.Keyboard.KeyCodes.THREE
        });
        
        // ESC handler - pause game
        this.keys.pause.on('down', () => {
            const paused = !this.gameState.get('game.paused');
            this.gameState.update('game.paused', paused);
            this.eventBus.emit('GAME_PAUSE', { paused });
        });
        
        // P key for killing all enemies (testing)
        this.keys.pauseKey.on('down', () => {
            // Debug key activated - eliminate all hostiles
            
            // Get all enemy entities
            const enemies = this.entityManager.getEntitiesByType('enemy');
            const bosses = this.entityManager.getEntitiesByType('boss');
            const allHostiles = [...enemies, ...bosses];
            
            // Process entity elimination
            
            // Kill each hostile entity properly through the combat system
            allHostiles.forEach(entityId => {
                const health = this.entityManager.getComponent(entityId, 'health');
                const transform = this.entityManager.getComponent(entityId, 'transform');
                
                if (health) {
                    // Set health to 0 to trigger proper death
                    health.current = 0;
                    
                    // Emit proper enemy death event
                    if (bosses.includes(entityId)) {
                        // Boss death
                        this.eventBus.emit('ENTITY_DESTROYED', {
                            id: entityId
                        });
                    } else {
                        // Regular enemy death - this will handle wave completion
                        this.eventBus.emit('COMBAT_ENEMY_DEATH', {
                            entityId: entityId,
                            transform: transform
                        });
                    }
                }
            });
            
            // All hostile entities eliminated
        });
        
        // Debug toggle
        this.keys.debug.on('down', () => {
            this.eventBus.emit('debug:toggle');
        });
        
        // Dash on space bar
        this.keys.dash.on('down', () => {
            this.eventBus.emit('PLAYER_ABILITY', { ability: 'dash' });
        });
        
        // Ability shortcuts for shop abilities (1-4)
        this.keys.ability1.on('down', () => {
            this.eventBus.emit('USE_ABILITY', { slot: 0 });
        });
        
        this.keys.ability2.on('down', () => {
            this.eventBus.emit('USE_ABILITY', { slot: 1 });
        });
        
        this.keys.ability3.on('down', () => {
            this.eventBus.emit('USE_ABILITY', { slot: 2 });
        });
        
        // Add ability4 key for 4th slot
        this.keys.ability4 = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
        this.keys.ability4.on('down', () => {
            this.eventBus.emit('USE_ABILITY', { slot: 3 });
        });
        
    }
    
    isShiftHeld() {
        return this.keys && this.keys.markers && this.keys.markers.isDown;
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
        
        // Scroll wheel zoom
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            this.eventBus.emit('CAMERA_ZOOM', {
                delta: deltaY
            });
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
                // Player ID not yet initialized
                return;
            }
            // Player ID acquired
        }
        
        // Update dash cooldown
        if (this.dashCooldown > 0) {
            this.dashCooldown -= deltaTime * 1000;
        }
        
        // Update movement vector
        this.updateMovement();
        
        // Update aim
        this.updateAim();
        
        // Handle shooting
        this.updateShooting(deltaTime);
        
        // Apply movement to player
        this.applyPlayerMovement();
        
        // Handle dash
        this.handleDash();
    }
    
    updateMovement() {
        this.moveVector.x = 0;
        this.moveVector.y = 0;
        
        // Keyboard input
        if (this.keys.left.isDown) this.moveVector.x -= 1;
        if (this.keys.right.isDown) this.moveVector.x += 1;
        if (this.keys.up.isDown) this.moveVector.y -= 1;
        if (this.keys.down.isDown) this.moveVector.y += 1;
        
        
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
            this.eventBus.emit('UI_CHARGE_UPDATE', { percent: chargePercent });
            
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
            this.eventBus.emit('UI_CHARGE_UPDATE', { percent: 0 });
        }
    }
    
    applyPlayerMovement() {
        const playerSprite = this.scene.sprites.get(this.playerId);
        if (!playerSprite || !playerSprite.body) {
            if (!playerSprite) {
                // Player sprite not found
            }
            return;
        }
        
        const physics = this.entityManager.getComponent(this.playerId, 'physics');
        if (!physics) return;
        
        // Normal movement force calculation
        const stats = this.gameState.get('player.stats');
        const baseForce = (stats.speed || GameConfig.player.baseSpeed) * 0.5; // Much stronger force
        
        // Better acceleration from stop
        const currentSpeed = Math.sqrt(physics.velocity.x ** 2 + physics.velocity.y ** 2);
        const accelerationBoost = currentSpeed < 2 ? 2.0 : 1.0;
        
        // Apply boost if shift is held
        let boostMultiplier = 1;
        if (this.keys.boost.isDown) {
            const energy = this.gameState.get('player.energy');
            if (energy > 0) {
                boostMultiplier = 1.5;
                this.gameState.update('player.energy', Math.max(0, energy - 0.5));
            }
        }
        
        // Apply movement force if there's input
        if (this.moveVector.x !== 0 || this.moveVector.y !== 0) {
            const forceX = this.moveVector.x * baseForce * boostMultiplier * accelerationBoost;
            const forceY = this.moveVector.y * baseForce * boostMultiplier * accelerationBoost;
            
            // DIRECTLY SET VELOCITY ON PHYSICS COMPONENT
            physics.velocity.x += forceX;
            physics.velocity.y += forceY;
            
            // Apply velocity to sprite immediately
            playerSprite.setVelocity(physics.velocity.x, physics.velocity.y);
        }
        
    }
    
    handleDash() {
        if (!this.keys.dash.isDown || this.dashCooldown > 0) return;
        
        const playerSprite = this.scene.sprites.get(this.playerId);
        if (!playerSprite || !playerSprite.body) return;
        
        const physics = this.entityManager.getComponent(this.playerId, 'physics');
        if (!physics) return;
        
        // Set cooldown
        this.dashCooldown = this.dashCooldownTime;
        
        // Calculate dash direction from input or current velocity
        let dashX = this.moveVector.x;
        let dashY = this.moveVector.y;
        
        // If no input, dash in current movement direction
        if (dashX === 0 && dashY === 0) {
            const speed = Math.sqrt(physics.velocity.x ** 2 + physics.velocity.y ** 2);
            if (speed > 0.1) {
                dashX = physics.velocity.x / speed;
                dashY = physics.velocity.y / speed;
            } else {
                // No input and not moving, dash forward
                dashX = Math.cos(playerSprite.rotation);
                dashY = Math.sin(playerSprite.rotation);
            }
        }
        
        // Normalize dash direction
        const dashMag = Math.sqrt(dashX * dashX + dashY * dashY);
        if (dashMag > 0) {
            dashX /= dashMag;
            dashY /= dashMag;
        }
        
        // Calculate current speed in dash direction
        const currentSpeedInDashDir = physics.velocity.x * dashX + physics.velocity.y * dashY;
        
        // If going slower than dash speed in that direction, set to dash speed
        if (currentSpeedInDashDir < this.dashSpeed) {
            physics.velocity.x = dashX * this.dashSpeed;
            physics.velocity.y = dashY * this.dashSpeed;
        } else {
            // Already going fast, add boost
            physics.velocity.x += dashX * 10;
            physics.velocity.y += dashY * 10;
        }
        
        // Apply new velocity to sprite
        playerSprite.setVelocity(physics.velocity.x, physics.velocity.y);
        
        // Emit dash event for visual effects
        this.eventBus.emit('PLAYER_DASH', {
            x: playerSprite.x,
            y: playerSprite.y,
            angle: Math.atan2(dashY, dashX)
        });
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