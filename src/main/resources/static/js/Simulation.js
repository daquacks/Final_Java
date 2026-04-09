class Simulation {
    constructor(audioController, waveVisualizer) {
        this.audio = audioController;
        this.waves = waveVisualizer;
        
        // DOM Elements
        this.observerEl = document.getElementById('observer');
        this.observerIcon = document.getElementById('observerIcon'); 
        this.ambulanceEl = document.getElementById('ambulance');
        this.simulationPane = document.getElementById('simulationPane');
        
        // Physics State
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        this.sourceX = -50; 
        this.observerX = 0;
        this.simulationTime = 0; 
        
        // Constants
        this.SPEED_OF_SOUND = 343.0; 
        this.PIXELS_PER_METER = 10; 
        this.PASSING_DISTANCE = 10; 
        this.TIME_SCALE = 0.5; 
        
        // Sprite Animation State
        this.spriteFrameCount = 8; // Walking_1 to Walking_8
        this.currentFrame = 1; // Start at 1
        this.spriteTimer = 0;
        this.spriteAnimationSpeed = 0.1; // Seconds per frame
        
        // UI Callbacks
        this.onUpdateUI = null;
        this.onStop = null;

        this.initObserverDragging();
    }

    initObserverDragging() {
        let isDragging = false;

        this.observerEl.addEventListener('mousedown', () => {
            if (this.isRunning) return; 
            isDragging = true;
            this.observerIcon.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const paneRect = this.simulationPane.getBoundingClientRect();
            let newLeft = e.clientX - paneRect.left;
            
            if (newLeft < 0) newLeft = 0;
            if (newLeft > paneRect.width) newLeft = paneRect.width;
            
            this.observerEl.style.left = `${newLeft}px`;
            
            const centerX = this.simulationPane.offsetWidth / 2;
            this.observerX = (newLeft - centerX) / this.PIXELS_PER_METER;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.observerIcon.style.cursor = 'grab';
            }
        });
    }

    resetPositions() {
        const paneWidth = this.simulationPane.offsetWidth;
        const centerX = paneWidth / 2;
        
        this.observerEl.style.left = `${centerX}px`;
        this.observerX = 0;
        
        this.sourceX = -50;
        const visualSourceX = centerX + (this.sourceX * this.PIXELS_PER_METER);
        this.ambulanceEl.style.left = `${visualSourceX}px`;
        
        this.waves.clear();
        this.simulationTime = 0;
        
        // Reset sprite to idle
        this.currentFrame = 1;
        this.updateSprite(0, 0);
    }

    updateSprite(observerSpeed, dt) {
        // If speed is 0, stay on frame 1 (idle)
        if (Math.abs(observerSpeed) === 0) {
            this.currentFrame = 1;
        } else {
            // Animate through frames
            this.spriteTimer += dt;
            
            // Adjust animation speed based on walking speed
            const actualAnimSpeed = this.spriteAnimationSpeed / (Math.abs(observerSpeed) / 5 || 1);
            
            if (this.spriteTimer > actualAnimSpeed) {
                this.currentFrame++;
                if (this.currentFrame > this.spriteFrameCount) {
                    this.currentFrame = 1;
                }
                this.spriteTimer = 0;
            }
        }
        
        // Ensure the src path matches what Spring Boot is serving.
        // It must be exactly /Sprites/Walking_X.png based on your directory structure
        const newSrc = `/Sprites/Walking_${this.currentFrame}.png`;
        
        // Only update DOM if source actually changed to prevent flickering
        if (!this.observerIcon.src.endsWith(newSrc)) {
            this.observerIcon.src = newSrc;
        }
        
        // Flip sprite if walking left
        if (observerSpeed < 0) {
            this.observerIcon.style.transform = 'scaleX(-1)';
        } else {
            this.observerIcon.style.transform = 'scaleX(1)';
        }
    }

    start(inputs) {
        if (this.isRunning) return;
        this.isRunning = true;
        this.observerIcon.style.cursor = 'not-allowed'; 
        
        this.audio.init();

        const centerX = this.simulationPane.offsetWidth / 2;
        
        if (!this.isPaused) {
            const observerPixelX = parseFloat(this.observerEl.style.left || getComputedStyle(this.observerEl).left);
            this.observerX = (observerPixelX - centerX) / this.PIXELS_PER_METER;
            
            this.sourceX = -50; 
            if (this.sourceX > this.observerX - 20) {
                this.sourceX = this.observerX - 50;
            }
            
            this.waves.clear();
            this.simulationTime = 0;
        }
        
        this.isPaused = false; 
        
        this.loop(inputs);
    }

    async loop(inputs) {
        if (!this.isRunning) return;

        // Note: dt is simulation time, let's use real dt for sprite animation so it's smooth
        const simDt = (1/60) * this.TIME_SCALE;
        const realDt = 1/60;
        
        this.simulationTime += simDt;
        
        this.sourceX += inputs.sourceSpeed * simDt; 
        this.observerX += inputs.observerSpeed * simDt;

        const centerX = this.simulationPane.offsetWidth / 2;
        const visualSourceX = centerX + (this.sourceX * this.PIXELS_PER_METER);
        const visualObserverX = centerX + (this.observerX * this.PIXELS_PER_METER);
        
        this.ambulanceEl.style.left = `${visualSourceX}px`;
        this.observerEl.style.left = `${visualObserverX}px`;
        
        // Update Sprites
        this.updateSprite(inputs.observerSpeed, realDt);
        
        // If ambulance moves left, flip it
        const ambulanceImg = this.ambulanceEl.querySelector('.ambulance-img');
        if (ambulanceImg) {
            ambulanceImg.style.transform = inputs.sourceSpeed < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        }

        this.waves.update(simDt, this.simulationTime, this.isRunning, this.isPaused, this.sourceX, inputs.sourceSpeed);
        this.waves.draw(inputs.sourceSpeed);

        const dx = this.sourceX - this.observerX; 
        const dy = this.PASSING_DISTANCE;    
        const totalDistance = Math.sqrt(dx*dx + dy*dy);
        
        const ux = (this.observerX - this.sourceX) / totalDistance;
        const vSourceRadial = inputs.sourceSpeed * ux;
        const vObserverRadial = inputs.observerSpeed * (-ux);

        try {
            // Call Java Backend
            const freqResponse = await fetch(`/calculate-frequency?sourceFrequency=${inputs.baseFreq}&sourceVelocity=${vSourceRadial}&observerVelocity=${vObserverRadial}`);
            const freqData = await freqResponse.json();
            const observedFreq = freqData.observedFrequency;

            const intResponse = await fetch(`/calculate-intensity?sourcePower=${inputs.sourcePower}&distance=${totalDistance}`);
            const intData = await intResponse.json();
            const intensityWatts = intData.intensity;

            // Audio Volume calculation
            const referenceIntensity = 1.59; 
            let gainValue = intensityWatts / referenceIntensity;
            gainValue = Math.min(gainValue, 1.0); 

            this.audio.updateSound(observedFreq, gainValue);

            if (this.onUpdateUI) {
                this.onUpdateUI({
                    observedFreq, totalDistance, intensityWatts, 
                    baseFreq: inputs.baseFreq, vObserverRadial, vSourceRadial, sourcePower: inputs.sourcePower
                });
            }

        } catch (error) {
            console.error("Error fetching calculation:", error);
        }

        if (visualSourceX > this.simulationPane.offsetWidth + 100 || visualSourceX < -100) {
            this.stop(true); 
        } else {
            this.animationFrameId = requestAnimationFrame(() => this.loop(inputs));
        }
    }

    stop(finished = false) {
        this.isRunning = false;
        this.observerIcon.style.cursor = 'grab'; 
        cancelAnimationFrame(this.animationFrameId);
        
        this.audio.fadeOut();
        
        // Stop animation (return to idle)
        this.updateSprite(0, 0);
        
        this.isPaused = !finished;
        
        if (this.onStop) this.onStop(finished);
    }
}
