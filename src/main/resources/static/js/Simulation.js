class Simulation {
    constructor(audioController, waveVisualizer) {
        this.audio = audioController;
        this.waves = waveVisualizer;
        
        // DOM elements (allow dynamic interaction)
        this.observerEl = document.getElementById('observer');
        this.observerIcon = document.getElementById('observerIcon'); 
        this.ambulanceEl = document.getElementById('ambulance');
        this.simulationPane = document.getElementById('simulationPane');
        
        // Physics state
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;
        this.sourceX = -25;
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
        
        // UI parameters
        this.onUpdateUI = null;
        this.onStop = null;

        this.initObserverDragging();
    }

    initObserverDragging() {
        let isDragging = false;

        // Checks if the observer is running; if he isn't, it lets the user drag him
        this.observerEl.addEventListener('mousedown', () => {
            if (this.isRunning) return; 
            isDragging = true;
            this.observerIcon.style.cursor = 'grabbing';
        });

        // Works only if the observer is not running. The event listener checks whether the mouse is moving now.
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            // getBoundingClientRect returns DOMRect object, with contains the HTML object (including padding and border)
            const paneRect = this.simulationPane.getBoundingClientRect();
            let newLeft = e.clientX - paneRect.left; //
            
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
        
        const newSrc = `/Sprites/Walking_${this.currentFrame}.png`;
        
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
            
            // Fixed starting position logic:
            // If source is moving right (>0), it should start to the LEFT of the observer
            // If source is moving left (<0), it should start to the RIGHT of the observer
            if (inputs.sourceSpeed >= 0) {
                this.sourceX = this.observerX - 50; 
            } else {
                this.sourceX = this.observerX + 50;
            }
            
            this.waves.clear();
            this.simulationTime = 0;
        }
        
        this.isPaused = false; 
        
        this.loop(inputs);
    }

    async loop(inputs) {
        if (!this.isRunning) return;

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
        
        this.updateSprite(inputs.observerSpeed, realDt);
        
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
            const freqResponse = await fetch(`/calculate-frequency?sourceFrequency=${inputs.baseFreq}&sourceVelocity=${vSourceRadial}&observerVelocity=${vObserverRadial}`);
            const freqData = await freqResponse.json();
            const observedFreq = freqData.observedFrequency;

            const intResponse = await fetch(`/calculate-intensity?sourcePower=${inputs.sourcePower}&distance=${totalDistance}`);
            const intData = await intResponse.json();
            const intensityWatts = intData.intensity;

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

        // --- FIXED END CONDITION ---
        let isFinished = false;
        
        // Use physics position (sourceX) against pane width in physics units for consistency
        const halfWidthMeters = (this.simulationPane.offsetWidth / 2) / this.PIXELS_PER_METER;
        
        if (inputs.sourceSpeed >= 0) {
            // Moving Right: Stop when it passes the right edge
            if (this.sourceX > halfWidthMeters + 20) { 
                isFinished = true;
            }
        } else {
            // Moving Left: Stop when it passes the left edge
            if (this.sourceX < -halfWidthMeters - 20) {
                isFinished = true;
            }
        }

        if (isFinished) {
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
        
        this.updateSprite(0, 0);
        
        this.isPaused = !finished;
        
        if (this.onStop) this.onStop(finished);
    }
}
