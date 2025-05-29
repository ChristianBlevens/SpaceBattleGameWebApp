// Planet profile system for consistent sprite and collider sizes with more variety
const PLANET_PROFILES = {
    // Rocky planets
    mercury: {
        spriteRadius: 60,
        colliderRadius: 60,
        mass: 150,
        baseColor: 0x8B7355,
        surfaceType: 'rocky',
        atmosphere: 0x000000,
        atmosphereOpacity: 0,
        name: 'Mercury-type'
    },
    mars: {
        spriteRadius: 80,
        colliderRadius: 80,
        mass: 200,
        baseColor: 0xCD5C5C,
        surfaceType: 'rocky',
        atmosphere: 0xFF6347,
        atmosphereOpacity: 0.1,
        name: 'Mars-type'
    },
    earth: {
        spriteRadius: 100,
        colliderRadius: 100,
        mass: 400,
        baseColor: 0x4682B4,
        surfaceType: 'rocky',
        atmosphere: 0x87CEEB,
        atmosphereOpacity: 0.3,
        name: 'Earth-type'
    },
    
    // Cratered moons
    moon: {
        spriteRadius: 50,
        colliderRadius: 50,
        mass: 100,
        baseColor: 0xC0C0C0,
        surfaceType: 'cratered',
        atmosphere: 0x000000,
        atmosphereOpacity: 0,
        name: 'Moon-type'
    },
    europa: {
        spriteRadius: 70,
        colliderRadius: 70,
        mass: 180,
        baseColor: 0xE0E0E0,
        surfaceType: 'cratered',
        atmosphere: 0x4169E1,
        atmosphereOpacity: 0.1,
        name: 'Europa-type'
    },
    callisto: {
        spriteRadius: 90,
        colliderRadius: 90,
        mass: 300,
        baseColor: 0x8B7D6B,
        surfaceType: 'cratered',
        atmosphere: 0x696969,
        atmosphereOpacity: 0.05,
        name: 'Callisto-type'
    },
    
    // Gas giants
    neptune: {
        spriteRadius: 120,
        colliderRadius: 120,
        mass: 600,
        baseColor: 0x4169E1,
        surfaceType: 'gas',
        atmosphere: 0x1E90FF,
        atmosphereOpacity: 0.4,
        name: 'Neptune-type'
    },
    jupiter: {
        spriteRadius: 160,
        colliderRadius: 160,
        mass: 1000,
        baseColor: 0xDAA520,
        surfaceType: 'gas',
        atmosphere: 0xFFD700,
        atmosphereOpacity: 0.3,
        name: 'Jupiter-type'
    },
    saturn: {
        spriteRadius: 140,
        colliderRadius: 140,
        mass: 800,
        baseColor: 0xF4A460,
        surfaceType: 'gas',
        atmosphere: 0xFFE4B5,
        atmosphereOpacity: 0.3,
        name: 'Saturn-type'
    },
    
    // Exotic planets
    volcanic: {
        spriteRadius: 85,
        colliderRadius: 85,
        mass: 350,
        baseColor: 0xFF4500,
        surfaceType: 'rocky',
        atmosphere: 0xFF6347,
        atmosphereOpacity: 0.5,
        name: 'Volcanic'
    },
    ice: {
        spriteRadius: 95,
        colliderRadius: 95,
        mass: 250,
        baseColor: 0xADD8E6,
        surfaceType: 'cratered',
        atmosphere: 0xE0FFFF,
        atmosphereOpacity: 0.2,
        name: 'Ice Giant'
    },
    toxic: {
        spriteRadius: 110,
        colliderRadius: 110,
        mass: 500,
        baseColor: 0x9ACD32,
        surfaceType: 'gas',
        atmosphere: 0xADFF2F,
        atmosphereOpacity: 0.6,
        name: 'Toxic'
    },
    metallic: {
        spriteRadius: 75,
        colliderRadius: 75,
        mass: 450,
        baseColor: 0x708090,
        surfaceType: 'rocky',
        atmosphere: 0x778899,
        atmosphereOpacity: 0.1,
        name: 'Metallic'
    },
    crystal: {
        spriteRadius: 65,
        colliderRadius: 65,
        mass: 200,
        baseColor: 0xDDA0DD,
        surfaceType: 'rocky',
        atmosphere: 0xDA70D6,
        atmosphereOpacity: 0.4,
        name: 'Crystal'
    }
};

// Get random planet profile
function getRandomPlanetProfile() {
    const profiles = Object.values(PLANET_PROFILES);
    return profiles[Math.floor(Math.random() * profiles.length)];
}

// Get planet profile by type
function getPlanetProfile(type) {
    return PLANET_PROFILES[type] || PLANET_PROFILES.earth;
}

// Get planet profiles by size category
function getPlanetsBySize(sizeCategory) {
    const profiles = Object.entries(PLANET_PROFILES);
    
    switch(sizeCategory) {
        case 'small':
            return profiles.filter(([key, p]) => p.spriteRadius <= 70).map(([key, p]) => ({...p, type: key}));
        case 'medium':
            return profiles.filter(([key, p]) => p.spriteRadius > 70 && p.spriteRadius <= 110).map(([key, p]) => ({...p, type: key}));
        case 'large':
            return profiles.filter(([key, p]) => p.spriteRadius > 110).map(([key, p]) => ({...p, type: key}));
        default:
            return profiles.map(([key, p]) => ({...p, type: key}));
    }
}