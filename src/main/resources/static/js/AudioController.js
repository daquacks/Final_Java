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
            this.audioContext = new window.AudioContext(); // Creates an AudioContext element (container for audio elements)
            this.oscillator = this.audioContext.createOscillator(); // Oscillator object generates sound
            this.oscillator.type = 'sawtooth'; // Sawtooth sounds the most like an ambulance
            
            // LFO (Low Frequency Oscillator) for a wailing sound (up and down pitch)
            /**
             * From what I understand of the functioning of this system, the LFO
             * Completes one cycle every 2 seconds (since it is at 0.5Hz). Then
             * the gain (like a knob) is set at 50Hz. This means that when the LFO is coupled,
             * every 2 seconds the oscillator will grow 50Hz and go down 50Hz (sine)
             * in frequency, just like an ambulance does in real life. (Amazing, I know)
             */
            this.sirenLFO = this.audioContext.createOscillator();
            this.sirenLFO.type = 'sine';
            this.sirenLFO.frequency.value = 0.5;
            this.lfoGain = this.audioContext.createGain();
            this.lfoGain.gain.value = 50; 
            
            // Connects LFO to the gain and the gain to the oscillator frequency (essentially LFO->frequency)
            this.sirenLFO.connect(this.lfoGain);
            this.lfoGain.connect(this.oscillator.frequency);

            /**
             * gainNode is a simple volume knob
             * oscillator is connected to this audio knob (contrarily to the LFO knob being CONNECTED TO the oscillator)
             * This means the oscillator controls this final volume knob, which determines how loud the actual audio comes out
             * destination is the actual audio output
             */
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

        // Updates frequency and output sound based on parameters passed in simulation with values from Simulation.js

        if (this.oscillator) {
            this.oscillator.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.1); // We want it to change fast and now
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
             this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1); // quick fade to avoid click if it were 0.0 instead of 0.1
        }
        
        // Also physically suspend the audio context to guarantee silence
        if (this.audioContext.state === 'running') {
            setTimeout(() => {
                this.audioContext.suspend();
            }, 150); // Suspend slightly after the quick fade
        }
    }
}
