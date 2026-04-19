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
        this.PASSING_DISTANCE = 5;
        this.TIME_SCALE = 0.5; 
        
        // Sprite Animation State
        this.spriteFrameCount = 8; // Walking_1 to Walking_8
        this.currentFrame = 1; // Start at 1
        this.spriteTimer = 0;
        this.spriteAnimationSpeed = 0.1; // Seconds per frame
        
        // UI parameters
        this.onUpdateUI = null;
        this.onStop = null;
        this.simulationPaneWidth = this.simulationPane.offsetWidth;
        this.halfWidthMeters = this.simulationPaneWidth/2 / this.PIXELS_PER_METER // Converts in meters in the project

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
            let newLeft = e.clientX - paneRect.left; // Creates a new left position variable based on relative position mouse-pane
            
            if (newLeft < 0) newLeft = 50; // If it is inferior to 0, the user is off the pane so it stops the sprite at 50
            if (newLeft > paneRect.width) newLeft = paneRect.width-50; // Else stops the sprite to the right
            
            this.observerEl.style.left = `${newLeft}px`; // Styles left because the coordinate system goes from left to right (-x to +x)
            
            const centerX = this.simulationPane.offsetWidth / 2;
            this.observerX = (newLeft - centerX) / this.PIXELS_PER_METER; // Pixels / pixels/m = m (this value is in meters), tracks the physical position of observer (not linked to the visuals)
            // The reason we do newLeft-centerX is that we want the physics to work with the center as 0, left as negative, and right as positive
        });

        // I think it's pretty obvious what this does lol
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
        
        this.observerEl.style.left = `${centerX}px`; // Centers observer
        this.observerX = 0; // Remember that this value is in meters

        const halfWidthMeters = (this.simulationPane.offsetWidth / 2) / this.PIXELS_PER_METER; // turns it to meters
        this.sourceX = -halfWidthMeters-100; // Put it really far off-screen
        const visualSourceX = centerX + (this.sourceX * this.PIXELS_PER_METER); // turns it back to pixels
        this.ambulanceEl.style.left = `${visualSourceX}px`;


        this.waves.clear();
        this.simulationTime = 0;
        
        // Reset sprite to idle
        this.currentFrame = 1;
        this.updateSprite(0, 0);
    }

    // Guess who's back? (Back again). Dt's back. (Tell a friend). Dt's back, dt's back, dt's back.
    updateSprite(observerSpeed, dt) {
        // If speed is 0, stay on frame 1 (idle)
        if (Math.abs(observerSpeed) === 0) {
            this.currentFrame = 1;
        } else {
            // Animate through frames with time step dt
            this.spriteTimer += dt;
            
            // Adjust animation speed based on walking speed
            // If observerSpeed is invalid, divides by 1 instead
            const actualAnimSpeed = this.spriteAnimationSpeed / (Math.abs(observerSpeed) / 5 || 1); // s/frame

            // Changes frame after dt>actual speed
            if (this.spriteTimer > actualAnimSpeed) {
                this.currentFrame++;
                // Same thing as mod operations; if frame larger than the amount of frames then reset to 1
                if (this.currentFrame > this.spriteFrameCount) {
                    this.currentFrame = 1;
                }
                this.spriteTimer = 0; // Reset timer to 0
            }
        }
        
        const newSrc = `/Sprites/Walking_${this.currentFrame}.png`;

        // Changes sprite if not same
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
        this.observerIcon.style.cursor = 'not-allowed'; // Does not let you drag anymore
        
        this.audio.init(); // Initializes audio

        const centerX = this.simulationPane.offsetWidth / 2;
        
        if (!this.isPaused) {
            const observerPixelX = parseFloat(this.observerEl.style.left || getComputedStyle(this.observerEl).left);
            this.observerX = (observerPixelX - centerX) / this.PIXELS_PER_METER;
            // If source is moving right (>0), start on left
            // Else start on right
            if (inputs.sourceSpeed >= 0) {
                this.sourceX = -this.halfWidthMeters-20;
            } else {
                this.sourceX = this.halfWidthMeters+20;
            }
            
            this.waves.clear();
            this.simulationTime = 0;
        }
        
        this.isPaused = false; 
        
        this.loop(inputs);
    }

    async loop(inputs) {
        if (!this.isRunning) return;

        // Simulation time step vs real time step
        const simDt = (1/60) * this.TIME_SCALE; // s * [scale]
        const realDt = 1/60;
        
        this.simulationTime += simDt;

        // Dynamic position update
        this.sourceX += inputs.sourceSpeed * simDt; 
        this.observerX += inputs.observerSpeed * simDt;

        const centerX = this.simulationPane.offsetWidth / 2;
        const visualSourceX = centerX + (this.sourceX * this.PIXELS_PER_METER);
        const visualObserverX = centerX + (this.observerX * this.PIXELS_PER_METER);
        
        this.ambulanceEl.style.left = `${visualSourceX}px`;
        this.observerEl.style.left = `${visualObserverX}px`;
        
        this.updateSprite(inputs.observerSpeed, realDt); // Updates sprite with real time step because walking is different from simulation time (walking is a separate action in itself)

        // Same logic as the observer switching directions depending on sign of speed
        const ambulanceImg = this.ambulanceEl.querySelector('.ambulance-img');
        if (ambulanceImg) {
            ambulanceImg.style.transform = inputs.sourceSpeed < 0 ? 'scaleX(-1)' : 'scaleX(1)';
        }

        // Then, updates the waves
        this.waves.update(simDt, this.simulationTime, this.isRunning, this.isPaused, this.sourceX);
        this.waves.draw(inputs.sourceSpeed);

        // The reason it needs passing distance is that r!=0 (no division by 0) and ambulance speed breaks if dy is not there too
        const dx = this.sourceX - this.observerX;
        const dy = this.PASSING_DISTANCE; // Passing distance in meters (assumes ambulance is 5 m away)
        const totalDistance = Math.sqrt(dx*dx + dy*dy);
        
        // Radial velocity calculation needs the angle
        const ux = dx / totalDistance; // = cos(theta)
        const vSourceRadial = inputs.sourceSpeed * ux; // = x*cos(theta)=magnitude (radial)
        const vObserverRadial = inputs.observerSpeed * (-ux); // For the observer it's the opposite (opposite reference point)

        // Fetches frequency and intensity from backend, updates audio object
        try {
            const freqResponse = await fetch(`/calculate-frequency?sourceFrequency=${inputs.baseFreq}&sourceVelocity=${vSourceRadial}&observerVelocity=${vObserverRadial}`);
            const freqData = await freqResponse.json();
            const observedFreq = freqData.observedFrequency;

            const intResponse = await fetch(`/calculate-intensity?sourcePower=${inputs.sourcePower}&distance=${totalDistance}`);
            const intData = await intResponse.json();
            const intensityWatts = intData.intensity;

            // Reference intensity is I when r=10m and P=100W
            const referenceIntensity = 1.59; 
            let gainValue = intensityWatts / referenceIntensity;
            gainValue = Math.min(gainValue, 1.0); // Caps gain at 1.0 (100%) to respect speaker values

            this.audio.updateSound(observedFreq, gainValue);

            if (this.onUpdateUI) {
                this.onUpdateUI({
                    observedFreq, totalDistance, intensityWatts, 
                    baseFreq: inputs.baseFreq,
                    vObserverRadial, vSourceRadial,
                    sourcePower: inputs.sourcePower
                });
            }

        } catch (error) {
            console.error("Error fetching calculation:", error);
        }

        // For some reason if this is not here the code thinks the simulation is over when ambulance starts off-screen
        let isFinished = false;

        const halfWidthMeters = (this.simulationPane.offsetWidth / 2) / this.PIXELS_PER_METER;
        
        if (inputs.sourceSpeed >= 0) {
            // Stops when it passes the right edge if left->right
            if (this.sourceX > halfWidthMeters + 20) { 
                isFinished = true;
            }
        } else {
            // Stop when it passes the left edge otherwise
            if (this.sourceX < -halfWidthMeters - 20) {
                isFinished = true;
            }
        }

        if (isFinished) {
            this.stop(true); 
        } else {
            this.animationFrameId = requestAnimationFrame(() => this.loop(inputs)); // Resets the loop
        }
    }

    stop(finished = false) {
        this.isRunning = false;
        this.observerIcon.style.cursor = 'grab'; // User may grab now
        cancelAnimationFrame(this.animationFrameId);
        
        this.audio.fadeOut();
        
        this.updateSprite(0, 0); // Sprite reset
        
        this.isPaused = !finished;

        // this.waves.toggle(); <-- Removed this so it doesn't arbitrarily hide/show waves on pause
        
        if (this.onStop) this.onStop(finished);
    }
}
