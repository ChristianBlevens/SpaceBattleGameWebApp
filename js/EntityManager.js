// EntityManager.js - Entity Component System (ECS) core
// Manages all game entities and their components using a data-driven approach

class EntityManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.entities = new Map();      // entityId -> entity metadata
        this.components = new Map();     // componentType -> Map(entityId -> data)
        this.systems = [];               // Processing systems
        this.entityGroups = new Map();   // entityType -> Set of entity IDs
        this.nextId = 1;
        this.entityPool = new Map();     // Object pooling (future optimization)
    }
    
    // Create a new entity with specified components
    createEntity(type = 'generic', components = {}) {
        const id = this.nextId++;
        const entity = {
            id: id,
            type: type,
            active: true,
            components: new Set()
        };
        
        this.entities.set(id, entity);
        
        // Track entity by type for fast queries
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
    
    // Add or update a component on an entity
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
    
    // Retrieve component data for an entity
    getComponent(entityId, componentType) {
        const componentMap = this.components.get(componentType);
        if (!componentMap) return null;
        return componentMap.get(entityId);
    }
    
    // Partially update component data
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
    
    // Query entities that have all specified components
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
    
    // Get all active entities of a specific type
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
    
    // Remove entity and clean up all associated data
    destroyEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return;
        
        // Mark as inactive to prevent processing
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
    
    // Register a system for entity processing
    addSystem(system) {
        this.systems.push(system);
        if (system.init) {
            system.init(this);
        }
        return this;
    }
    
    // Process all registered systems
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
    
    // Generate statistics for performance monitoring
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