// EntityManager.js - Entity Component System for game objects

class EntityManager {
    constructor() {
        this.entities = new Map();
        this.components = new Map();
        this.systems = [];
        this.entityGroups = new Map();
        this.nextId = 1;
        this.entityPool = new Map();
    }
    
    // Create a new entity
    createEntity(type = 'generic', components = {}) {
        const id = this.nextId++;
        const entity = {
            id: id,
            type: type,
            active: true,
            components: new Set()
        };
        
        this.entities.set(id, entity);
        
        // Add to type group
        if (!this.entityGroups.has(type)) {
            this.entityGroups.set(type, new Set());
        }
        this.entityGroups.get(type).add(id);
        
        // Add components
        Object.entries(components).forEach(([componentType, data]) => {
            this.addComponent(id, componentType, data);
        });
        
        // Emit creation event
        window.EventBus.emit(window.GameEvents.ENTITY_CREATED, { id, type });
        
        return id;
    }
    
    // Add component to entity
    addComponent(entityId, componentType, data = {}) {
        const entity = this.entities.get(entityId);
        if (!entity) return;
        
        // Initialize component storage if needed
        if (!this.components.has(componentType)) {
            this.components.set(componentType, new Map());
        }
        
        // Add component data
        this.components.get(componentType).set(entityId, data);
        entity.components.add(componentType);
        
        return this;
    }
    
    // Get component data
    getComponent(entityId, componentType) {
        const componentMap = this.components.get(componentType);
        if (!componentMap) return null;
        return componentMap.get(entityId);
    }
    
    // Update component data
    updateComponent(entityId, componentType, updates) {
        const component = this.getComponent(entityId, componentType);
        if (!component) return;
        
        Object.assign(component, updates);
        return this;
    }
    
    // Remove component from entity
    removeComponent(entityId, componentType) {
        const entity = this.entities.get(entityId);
        if (!entity) return;
        
        const componentMap = this.components.get(componentType);
        if (componentMap) {
            componentMap.delete(entityId);
        }
        
        entity.components.delete(componentType);
        return this;
    }
    
    // Query entities by components
    query(...componentTypes) {
        const results = [];
        
        this.entities.forEach((entity, id) => {
            if (!entity.active) return;
            
            const hasAllComponents = componentTypes.every(type => 
                entity.components.has(type)
            );
            
            if (hasAllComponents) {
                results.push(id);
            }
        });
        
        return results;
    }
    
    // Query entities by type
    getEntitiesByType(type) {
        const group = this.entityGroups.get(type);
        if (!group) return [];
        
        return Array.from(group).filter(id => {
            const entity = this.entities.get(id);
            return entity && entity.active;
        });
    }
    
    // Get entity data
    getEntity(entityId) {
        return this.entities.get(entityId);
    }
    
    // Destroy entity
    destroyEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return;
        
        // Mark as inactive first
        entity.active = false;
        
        // Remove from type group
        const group = this.entityGroups.get(entity.type);
        if (group) {
            group.delete(entityId);
        }
        
        // Clean up components
        entity.components.forEach(componentType => {
            const componentMap = this.components.get(componentType);
            if (componentMap) {
                componentMap.delete(entityId);
            }
        });
        
        // Remove entity
        this.entities.delete(entityId);
        
        // Emit destruction event
        window.EventBus.emit(window.GameEvents.ENTITY_DESTROYED, { id: entityId, type: entity.type });
    }
    
    // Add system to process entities
    addSystem(system) {
        this.systems.push(system);
        if (system.init) {
            system.init(this);
        }
        return this;
    }
    
    // Update all systems
    update(deltaTime) {
        this.systems.forEach(system => {
            if (system.update) {
                system.update(deltaTime, this);
            }
        });
    }
    
    // Clear all entities
    clear() {
        this.entities.clear();
        this.components.clear();
        this.entityGroups.clear();
        this.nextId = 1;
    }
    
    // Get stats for debugging
    getStats() {
        const stats = {
            totalEntities: this.entities.size,
            activeEntities: 0,
            entitiesByType: {},
            componentCounts: {}
        };
        
        this.entities.forEach(entity => {
            if (entity.active) stats.activeEntities++;
            
            if (!stats.entitiesByType[entity.type]) {
                stats.entitiesByType[entity.type] = 0;
            }
            stats.entitiesByType[entity.type]++;
        });
        
        this.components.forEach((map, type) => {
            stats.componentCounts[type] = map.size;
        });
        
        return stats;
    }
}

// Component factory functions
const Components = {
    // Transform component
    transform(x = 0, y = 0, rotation = 0, scale = 1) {
        return {
            x: x,
            y: y,
            rotation: rotation,
            scale: scale,
            prevX: x,
            prevY: y
        };
    },
    
    // Physics component
    physics(vx = 0, vy = 0, mass = 1, radius = 20) {
        return {
            velocity: { x: vx, y: vy },
            acceleration: { x: 0, y: 0 },
            mass: mass,
            radius: radius,
            damping: 0.999,
            maxSpeed: 15,
            elasticity: 0.8
        };
    },
    
    // Health component
    health(current = 100, max = 100, regen = 0) {
        return {
            current: current,
            max: max,
            regen: regen,
            invulnerable: false,
            invulnerabilityTime: 0,
            lastDamageTime: 0
        };
    },
    
    // Weapon component
    weapon(damage = 10, fireRate = 500, projectileSpeed = 20) {
        return {
            damage: damage,
            fireRate: fireRate,
            projectileSpeed: projectileSpeed,
            lastFireTime: 0,
            charging: false,
            chargeTime: 0,
            maxChargeTime: 2000,
            ammo: -1, // -1 = infinite
            spread: 0
        };
    },
    
    // AI component
    ai(behavior = 'wander', faction = 'neutral') {
        return {
            behavior: behavior,
            faction: faction,
            target: null,
            state: 'idle',
            memory: {},
            decisionTimer: 0,
            reactionTime: 200,
            aggressionLevel: 0.5,
            fearLevel: 0.3
        };
    },
    
    // Sprite component
    sprite(texture, tint = 0xffffff, alpha = 1) {
        return {
            texture: texture,
            tint: tint,
            alpha: alpha,
            visible: true,
            glow: false,
            glowColor: 0xffffff,
            scale: 1
        };
    },
    
    // Trail component
    trail(length = 10, color = 0x00ffff, width = 2) {
        return {
            points: [],
            maxLength: length,
            color: color,
            width: width,
            alpha: 0.5,
            fadeRate: 0.05
        };
    },
    
    // Faction component
    faction(name, color, friendlyFactions = []) {
        return {
            name: name,
            color: color,
            reputation: 0,
            friendlyWith: new Set(friendlyFactions),
            hostileWith: new Set()
        };
    },
    
    // Powerup component
    powerup(type, value, duration = 0) {
        return {
            type: type, // 'health', 'energy', 'credits', 'buff'
            value: value,
            duration: duration,
            collected: false,
            magnetRange: 100
        };
    },
    
    // Lifetime component
    lifetime(duration) {
        return {
            duration: duration,
            elapsed: 0,
            fadeOut: true,
            destroyOnExpire: true
        };
    }
};

// Create singleton instance
const entityManager = new EntityManager();

// Export for use in other modules
window.EntityManager = entityManager;
window.Components = Components;