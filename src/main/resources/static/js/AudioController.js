class AudioController {
    constructor() {
        this.audioContext = null;
        this.oscillator = null;
        this.gainNode = null;
        this.sirenLFO = null;
        this.lfoGain = null;
        this.isInitialized = false;
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Main tone
            this.oscillator = this.audioContext.createOscillator();
            this.oscillator.type = 'sawtooth'; 
            
            // LFO for the "Wail" (up and down pitch)
            this.sirenLFO = this.audioContext.createOscillator();
            this.sirenLFO.type = 'sine';
            this.sirenLFO.frequency.value = 0.5; 
            
            this.lfoGain = this.audioContext.createGain();
            this.lfoGain.gain.value = 50; 
            
            // Connect LFO to the main oscillator's frequency
            this.sirenLFO.connect(this.lfoGain);
            this.lfoGain.connect(this.oscillator.frequency);
            
            // Volume control
            this.gainNode = this.audioContext.createGain();
            
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
            
            this.oscillator.start();
            this.sirenLFO.start();
            this.isInitialized = true;
        } else if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    updateSound(frequency, gainValue) {
        if (!this.isInitialized) return;
        
        if (this.oscillator) {
            this.oscillator.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.1);
        }
        
        if (this.gainNode) {
            this.gainNode.gain.setTargetAtTime(gainValue, this.audioContext.currentTime, 0.1);
        }
    }

    fadeOut(duration = 0.5) {
        if (!this.isInitialized || !this.audioContext) return;
        
        // Ensure gainNode is defined
        if (this.gainNode) {
             // Instead of fading out over time, we completely silence it immediately
             // This prevents the sound from bleeding through after pause/stop
             this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
             this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext.currentTime);
             this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1); // quick fade to avoid click
        }
        
        // Also physically suspend the audio context to guarantee silence
        if (this.audioContext.state === 'running') {
            setTimeout(() => {
                this.audioContext.suspend();
            }, 150); // Suspend slightly after the quick fade
        }
    }
}
