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

/**
 * Component initialization
 * AudioController: Manages sound generation and updates based on the calculations in DopplerController.
 * WaveVisualizer: Handles the canvas rendering of sound waves emitted by the source.
 * Simulation: Core logic that updates positions, calculates Doppler effects, and communicates with the backend.
 * */

const audioController = new AudioController();
const waveVisualizer = new WaveVisualizer('waveCanvas', 'simulationPane');
const simulation = new Simulation(audioController, waveVisualizer);

let frameCount = 0;

// Sets initial state for toggle waves button safely
if (toggleWavesButton) {
    toggleWavesButton.disabled = true;
}

// Event managers for simulation updates
simulation.onUpdateUI = (data) => {
    // Updates basic text with 2, 2, and 4 decimal places respectively by extracting the relevant values from the data object
    observedFreqEl.textContent = data.observedFreq.toFixed(2);
    distanceEl.textContent = data.totalDistance.toFixed(2); 
    intensityEl.textContent = data.intensityWatts.toFixed(4);

    // Updates LaTeX equations every 10 frames to avoid excessive re-rendering
    frameCount++; // Increment frame count on each update
    if (frameCount % 10 === 0) { // Every 10 frames, updates the LaTeX equations with the latest values from the data object
        // See updateLatex function
        updateLatex(data.baseFreq, data.vObserverRadial, data.vSourceRadial, data.observedFreq, data.sourcePower, data.totalDistance, data.intensityWatts);
    }
};

// onStop becomes a function that disables the start button and enables the stop button when the simulation is stopped
simulation.onStop = (finished) => {
    startButton.disabled = false;
    stopButton.disabled = true;
    
    // Also disable toggle waves button when stopped/finished
    if (finished && toggleWavesButton) {
        toggleWavesButton.disabled = true;
    }
};

// Helper functions (simplify everything)

// Returns the list of parameters from the input fields
function getInputs() {
    return {
        sourceSpeed: parseFloat(sourceSpeedInput.value),
        observerSpeed: parseFloat(observerSpeedInput.value),
        baseFreq: parseFloat(sourceFreqInput.value),
        sourcePower: parseFloat(sourcePowerInput.value)
    };
}

// Helper method for updating LaTeX
function updateLatex(f0, v0, vs, fPrime, P, r, I) {
    if (typeof MathJax === 'undefined') return;

    // General format for doppler and intensity equations
    // Doppler: $$ f' = f_0 \left( \frac{v + v_0}{v - v_s} \right) $$ AKA fPrime = f0(343-v0)/(343-vs)
    // Intensity: $$ I = \frac{P}{2\pi r} $$ AKA I = P/(2*pi*r) AKA I=P/2*PI*r
    const dopplerLatex = `$$ f' = ${f0} \\left( \\frac{343 + ${v0.toFixed(2)}}{343 - ${vs.toFixed(2)}} \\right) = ${fPrime.toFixed(2)} \\text{ Hz} $$`;
    const intensityLatex = `$$ I = \\frac{${P}}{2\\pi (${r.toFixed(2)})} = ${I.toFixed(4)} \\text{ W/m}^2 $$`;

    if (liveDopplerEq && liveIntensityEq) {
        liveDopplerEq.innerHTML = dopplerLatex;
        liveIntensityEq.innerHTML = intensityLatex;
        
        MathJax.typesetPromise([liveDopplerEq, liveIntensityEq]).catch(() => {}); // Displays everything as LaTeX
    }
}

// Global event handlers

// startSimulation parameter redefined as one that disables start and enables stop buttons, then starts simulation with specific inputs
// Also enables the toggle waves button
window.startSimulation = () => {
    waveVisualizer.showWaves=true;
    startButton.disabled = true;
    stopButton.disabled = false;
    if (toggleWavesButton) {
        toggleWavesButton.disabled = false;
    }
    simulation.start(getInputs());
};

window.stopSimulation = () => {
    simulation.stop(false);
};

window.resetSimulation = () => {
    simulation.stop(true);
    
    if (toggleWavesButton) {
        toggleWavesButton.disabled = true;
    }
    
    observedFreqEl.textContent = 'N/A';
    distanceEl.textContent = 'N/A';
    intensityEl.textContent = 'N/A';

    // Sets LaTeX equations back to default
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
    if (!toggleWavesButton || toggleWavesButton.disabled) return; // Add check here just in case
    const isShowing = waveVisualizer.toggle();
    toggleWavesButton.textContent = isShowing ? "Hide Waves" : "Show Waves"; // Changes text based on boolean above
};

// Initial Setup
simulation.resetPositions();
