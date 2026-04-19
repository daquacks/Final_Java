class WaveVisualizer {
    constructor(canvasId, simulationPaneId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.simulationPane = document.getElementById(simulationPaneId);
        
        this.waves = []; // Waves is an array of circles
        this.showWaves = true;
        this.lastWaveEmissionTime = 0;
        this.WAVE_EMISSION_INTERVAL = 0.13;
        this.VISUAL_SPEED_OF_SOUND = 60.0;
        this.PIXELS_PER_METER = 10;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.simulationPane.offsetWidth;
        this.canvas.height = this.simulationPane.offsetHeight;
    }

    toggle() {
        this.showWaves = !this.showWaves;
        if (!this.showWaves) {
            this.clear();
        }
        return this.showWaves;
    }

    clear() {
        this.waves = [];
        this.lastWaveEmissionTime = 0;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    update(dt, simulationTime, isRunning, isPaused, sourceX) {
        if (!this.showWaves) return; // Doesn't update if waves are hidden (why would I do that?)

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height * 0.45; // Adjusted to ambulance's vertical position (45% * pane height)

        if (isRunning && !isPaused) {

            // Based on the simulation time passed in simulation class, if elapsed time is above wave emission interval, update
            // P.S. simulationTime increments by one dt every time this function is called.
            // Basically emits one wave every 130ms (WAVE_EMISSION_INTERVAL)
            if (simulationTime - this.lastWaveEmissionTime > this.WAVE_EMISSION_INTERVAL) {
                const visualSourceX = centerX + (sourceX * this.PIXELS_PER_METER); // sourceX negative if on left, positive if on right
                this.waves.push({ // Adds a wave to the array that starts at the source
                    x: visualSourceX, 
                    y: centerY,
                    radius: 0
                });
                this.lastWaveEmissionTime = simulationTime; // Last emission was just now
            }
        }

        const waveSpeedPixels = this.VISUAL_SPEED_OF_SOUND * this.PIXELS_PER_METER; 

        // Decreasing for loop (start outwards for easy deletion)
        for (let i = this.waves.length - 1; i >= 0; i--) {
            let wave = this.waves[i];
            wave.radius += waveSpeedPixels * dt; // px/s * s = px
            
            if (wave.radius > this.canvas.width * 1.2) { // Means the wave is not visible anymore; deletes it
                this.waves.splice(i, 1);
            }
        }
    }

    draw(sourceSpeed) {
        if (!this.showWaves) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clears old waves
        this.ctx.lineWidth = 3;

        const sourceMovingRight = sourceSpeed >= 0;

        for (let wave of this.waves) { // Enhanced for loop like in Java

            /**
             * If moving right, draw the right-half circle red, otherwise blue
             */
            this.ctx.beginPath();
            this.ctx.arc(wave.x, wave.y, wave.radius, -Math.PI/2, Math.PI/2); 
            this.ctx.strokeStyle = sourceMovingRight ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 0, 255, 0.4)';
            this.ctx.stroke();

            /**
             * If moving right, draw the left-half circle blue, otherwise red.
             * Basically these two groups of actions alternate blue/red based on the direction the ambulance is moving.
             * The waves compress in the direction of movement and decompress in the other direction,
             * so when the ambulance is moving right red is on the right and blue on the left,
             * and when the ambulance is moving left red is on the left and blue is on the right.
             * Because the two halves expand at the same time, it is like the entire circle expanding
             */
            this.ctx.beginPath();
            this.ctx.arc(wave.x, wave.y, wave.radius, Math.PI/2, 3*Math.PI/2); 
            this.ctx.strokeStyle = sourceMovingRight ? 'rgba(0, 0, 255, 0.4)' : 'rgba(255, 0, 0, 0.4)';
            this.ctx.stroke();
        }
    }
}
