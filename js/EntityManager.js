// EntityManager.js - Entity Component System for game objects

class EntityManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
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
        this.eventBus.emit('ENTITY_CREATED', { id, type });
        
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
        this.eventBus.emit('ENTITY_DESTROYED', { id: entityId, type: entity.type });
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

// Component factory functions are now in Components.js

// EntityManager will be instantiated by GameInitializer
window.EntityManager = EntityManager;