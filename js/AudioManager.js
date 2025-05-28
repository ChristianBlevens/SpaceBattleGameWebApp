// AudioManager.js - Handles all game audio

class AudioManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.sounds = {};
        this.music = null;
        this.initialized = false;
        this.muted = false;
        this.musicVolume = 0.3;
        this.effectsVolume = 0.5;
    }
    
    init() {
        // Initialize basic sounds using Web Audio API for procedural generation
        this.initializeSounds();
        
        // Listen for audio events
        this.eventBus.on('AUDIO_PLAY', (data) => {
            this.play(data.sound, data.options);
        });
        
        this.eventBus.on('AUDIO_STOP', (data) => {
            this.stop(data.sound);
        });
        
        this.eventBus.on('AUDIO_VOLUME', (data) => {
            this.setVolume(data.type, data.volume);
        });
        
        this.eventBus.on('AUDIO_PLAY_MUSIC', (data) => {
            const track = data && data.track ? data.track : 'gameMusic';
            this.playMusic(track);
        });
        
        this.eventBus.on('AUDIO_STOP_MUSIC', () => {
            this.stopMusic();
        });
        
        this.eventBus.on('AUDIO_SET_MUTE', (data) => {
            this.setMute(data.muted);
        });
        
        this.initialized = true;
    }
    
    initializeSounds() {
        // Create placeholder sound definitions
        // In a real implementation, these would be actual audio files or procedural audio
        this.sounds = {
            shoot: { duration: 0.1, frequency: 800, type: 'sawtooth' },
            explosion: { duration: 0.5, frequency: 150, type: 'noise' },
            powerup: { duration: 0.3, frequency: 1200, type: 'sine' },
            hit: { duration: 0.1, frequency: 400, type: 'square' },
            boost: { duration: 0.2, frequency: 600, type: 'triangle' },
            shield: { duration: 0.4, frequency: 500, type: 'sine' },
            wave: { duration: 1.0, frequency: 300, type: 'sine' }
        };
    }
    
    play(soundName, options = {}) {
        if (!this.initialized || this.muted) return;
        
        const volume = options.volume || 1.0;
        
        // Log sound play
        //console.log(`[AudioManager] Playing sound: ${soundName}`);
        
        // In a real implementation, this would play the actual sound
        // For now, we just simulate it
        const sound = this.sounds[soundName];
        if (sound) {
            // Placeholder for actual audio playback
            this.simulateSound(sound, volume * this.effectsVolume);
        }
    }
    
    simulateSound(soundDef, volume) {
        // This would be replaced with actual Web Audio API or Howler.js implementation
        // For now, just log it
        //console.log(`[AudioManager] Sound: ${JSON.stringify(soundDef)} at volume ${volume}`);
    }
    
    playMusic(track) {
        if (!this.initialized || this.muted) return;
        
        //console.log(`[AudioManager] Playing background music: ${track || 'default'}`);
        // Placeholder for music playback
        this.music = {
            playing: true,
            volume: this.musicVolume,
            track: track || 'default'
        };
    }
    
    stopMusic() {
        if (!this.initialized) return;
        
        //console.log('[AudioManager] Stopping background music');
        if (this.music) {
            this.music.playing = false;
        }
    }
    
    stop(soundName) {
        if (!this.initialized) return;
        
        //console.log(`[AudioManager] Stopping sound: ${soundName}`);
        // Placeholder for stopping specific sounds
    }
    
    setVolume(type, volume) {
        if (type === 'music') {
            this.musicVolume = Math.max(0, Math.min(1, volume));
            //console.log(`[AudioManager] Music volume set to ${this.musicVolume}`);
        } else if (type === 'effects') {
            this.effectsVolume = Math.max(0, Math.min(1, volume));
            //console.log(`[AudioManager] Effects volume set to ${this.effectsVolume}`);
        }
    }
    
    setMute(muted) {
        this.muted = muted;
        //console.log(`[AudioManager] Mute: ${muted}`);
        
        if (muted && this.music && this.music.playing) {
            this.stopMusic();
        }
    }
    
    // Helper method to check if music is playing
    isMusicPlaying() {
        return this.music && this.music.playing;
    }
    
    // Cleanup method
    destroy() {
        this.stopMusic();
        this.initialized = false;
    }
}

// AudioManager will be instantiated by GameInitializer
window.AudioManager = AudioManager;