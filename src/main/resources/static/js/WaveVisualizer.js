class WaveVisualizer {
    constructor(canvasId, simulationPaneId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.simulationPane = document.getElementById(simulationPaneId);
        
        this.waves = [];
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

    update(dt, simulationTime, isRunning, isPaused, sourceX, sourceSpeed) {
        if (!this.showWaves) return;

        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Emit new wave
        if (isRunning && !isPaused) {
            if (simulationTime - this.lastWaveEmissionTime > this.WAVE_EMISSION_INTERVAL) {
                // The sourceX represents the center of the ambulance in physics space.
                // Because we centered the HTML element using transform: translate(-50%, ...),
                // visualSourceX now perfectly aligns with the visual center of the ambulance image.
                const visualSourceX = centerX + (sourceX * this.PIXELS_PER_METER);
                this.waves.push({
                    x: visualSourceX, 
                    y: centerY,
                    radius: 0
                });
                this.lastWaveEmissionTime = simulationTime;
            }
        }

        // Expand existing waves
        const waveSpeedPixels = this.VISUAL_SPEED_OF_SOUND * this.PIXELS_PER_METER; 

        for (let i = this.waves.length - 1; i >= 0; i--) {
            let wave = this.waves[i];
            wave.radius += waveSpeedPixels * dt; 
            
            // Remove off-screen waves
            if (wave.radius > this.canvas.width * 1.2) {
                this.waves.splice(i, 1);
            }
        }
    }

    draw(sourceSpeed) {
        if (!this.showWaves) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.lineWidth = 3;

        const sourceMovingRight = sourceSpeed >= 0;

        for (let wave of this.waves) {
            // Right Half
            this.ctx.beginPath();
            this.ctx.arc(wave.x, wave.y, wave.radius, -Math.PI/2, Math.PI/2); 
            this.ctx.strokeStyle = sourceMovingRight ? 'rgba(255, 0, 0, 0.6)' : 'rgba(0, 0, 255, 0.6)'; 
            this.ctx.stroke();
            
            // Left Half
            this.ctx.beginPath();
            this.ctx.arc(wave.x, wave.y, wave.radius, Math.PI/2, 3*Math.PI/2); 
            this.ctx.strokeStyle = sourceMovingRight ? 'rgba(0, 0, 255, 0.6)' : 'rgba(255, 0, 0, 0.6)'; 
            this.ctx.stroke();
        }
    }
}
