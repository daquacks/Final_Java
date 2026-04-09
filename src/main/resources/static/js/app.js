// --- DOM Elements ---
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const toggleWavesButton = document.getElementById('toggleWavesButton');

// Input Elements
const observerSpeedInput = document.getElementById('observerSpeed');
const sourceSpeedInput = document.getElementById('sourceSpeed');
const sourceFreqInput = document.getElementById('sourceFreq');
const sourcePowerInput = document.getElementById('sourcePower');

// Output Elements
const observedFreqEl = document.getElementById('observedFreq');
const distanceEl = document.getElementById('distance');
const intensityEl = document.getElementById('intensity');
const liveDopplerEq = document.getElementById('liveDopplerEq');
const liveIntensityEq = document.getElementById('liveIntensityEq');

// --- Initialize Components ---
const audioController = new AudioController();
const waveVisualizer = new WaveVisualizer('waveCanvas', 'simulationPane');
const simulation = new Simulation(audioController, waveVisualizer);

let frameCount = 0;

// --- Callbacks ---

simulation.onUpdateUI = (data) => {
    // Update basic text
    observedFreqEl.textContent = data.observedFreq.toFixed(2);
    distanceEl.textContent = data.totalDistance.toFixed(2); 
    intensityEl.textContent = data.intensityWatts.toFixed(4);

    // Update LaTeX Equations (Throttled)
    frameCount++;
    if (frameCount % 10 === 0) { 
        updateLatex(data.baseFreq, data.vObserverRadial, data.vSourceRadial, data.observedFreq, data.sourcePower, data.totalDistance, data.intensityWatts);
    }
};

simulation.onStop = (finished) => {
    startButton.disabled = false;
    stopButton.disabled = true;
};

// --- Helper Functions ---

function getInputs() {
    return {
        sourceSpeed: parseFloat(sourceSpeedInput.value),
        observerSpeed: parseFloat(observerSpeedInput.value),
        baseFreq: parseFloat(sourceFreqInput.value),
        sourcePower: parseFloat(sourcePowerInput.value)
    };
}

function updateLatex(f0, v0, vs, fPrime, P, r, I) {
    if (typeof MathJax === 'undefined') return;

    const dopplerLatex = `$$ f' = ${f0} \\left( \\frac{343 + ${v0.toFixed(2)}}{343 - ${vs.toFixed(2)}} \\right) = ${fPrime.toFixed(2)} \\text{ Hz} $$`;
    const intensityLatex = `$$ I = \\frac{${P}}{2\\pi (${r.toFixed(2)})} = ${I.toFixed(4)} \\text{ W/m}^2 $$`;

    if (liveDopplerEq && liveIntensityEq) {
        liveDopplerEq.innerHTML = dopplerLatex;
        liveIntensityEq.innerHTML = intensityLatex;
        
        MathJax.typesetPromise([liveDopplerEq, liveIntensityEq]).catch(() => {});
    }
}

// --- Global Event Handlers ---

window.startSimulation = () => {
    startButton.disabled = true;
    stopButton.disabled = false;
    simulation.start(getInputs());
};

window.stopSimulation = () => {
    simulation.stop(false);
};

window.resetSimulation = () => {
    simulation.stop(true);
    
    observedFreqEl.textContent = 'N/A';
    distanceEl.textContent = 'N/A';
    intensityEl.textContent = 'N/A';
    
    if (liveDopplerEq && liveIntensityEq) {
        liveDopplerEq.innerHTML = `$$ f' = 500 \\left( \\frac{343 + 0.00}{343 - 0.00} \\right) = 500.00 \\text{ Hz} $$`;
        liveIntensityEq.innerHTML = `$$ I = \\frac{100}{2\\pi (0.00)} = 0.00 \\text{ W/m}^2 $$`;
        if (typeof MathJax !== 'undefined') {
            MathJax.typesetPromise([liveDopplerEq, liveIntensityEq]);
        }
    }
    
    simulation.resetPositions();
};

window.toggleWaves = () => {
    const isShowing = waveVisualizer.toggle();
    toggleWavesButton.textContent = isShowing ? "Hide Waves" : "Show Waves";
};

// Initial Setup
simulation.resetPositions();
