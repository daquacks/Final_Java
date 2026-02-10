// --- DOM Elements ---
const observerEl = document.getElementById('observer');
const ambulanceEl = document.getElementById('ambulance');
const simulationPane = document.getElementById('simulationPane');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const resetButton = document.getElementById('resetButton');

// --- Input Elements ---
const observerSpeedInput = document.getElementById('observerSpeed');
const sourceSpeedInput = document.getElementById('sourceSpeed');
const sourceFreqInput = document.getElementById('sourceFreq');
const sourcePowerInput = document.getElementById('sourcePower');

// --- Output Elements ---
const observedFreqEl = document.getElementById('observedFreq');
const distanceEl = document.getElementById('distance');
const intensityEl = document.getElementById('intensity');

// --- Calculation Display Elements (Containers for LaTeX) ---
const liveDopplerEq = document.getElementById('liveDopplerEq');
const liveIntensityEq = document.getElementById('liveIntensityEq');

// --- Web Audio API Setup ---
let audioContext;
let oscillator;
let gainNode;
let sirenLFO; 
let lfoGain;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        oscillator = audioContext.createOscillator();
        oscillator.type = 'sawtooth'; 
        
        sirenLFO = audioContext.createOscillator();
        sirenLFO.type = 'sine';
        sirenLFO.frequency.value = 0.5; 
        
        lfoGain = audioContext.createGain();
        lfoGain.gain.value = 50; 
        
        sirenLFO.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        
        gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        sirenLFO.start();
    } else {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }
}

// --- Simulation State ---
let simulationRunning = false;
let animationFrameId;
let isPaused = false; 

// Physics State (Meters)
let sourceX = -50; 
let observerX = 0;

const SPEED_OF_SOUND = 343.0; 
const PIXELS_PER_METER = 10; 
const PASSING_DISTANCE = 10; 

// --- Draggable Observer Logic ---
let isDragging = false;

observerEl.addEventListener('mousedown', (e) => {
    if (simulationRunning) return; 
    isDragging = true;
    observerEl.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const paneRect = simulationPane.getBoundingClientRect();
    let newLeft = e.clientX - paneRect.left;
    
    if (newLeft < 0) newLeft = 0;
    if (newLeft > paneRect.width) newLeft = paneRect.width;
    
    observerEl.style.left = `${newLeft}px`;
    
    const centerX = simulationPane.offsetWidth / 2;
    observerX = (newLeft - centerX) / PIXELS_PER_METER;
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        observerEl.style.cursor = 'grab';
    }
});

observerEl.style.cursor = 'grab';

function initPositions() {
    const paneWidth = simulationPane.offsetWidth;
    const centerX = paneWidth / 2;
    
    observerEl.style.left = `${centerX}px`;
    observerX = 0;
    
    sourceX = -50;
    const visualSourceX = centerX + (sourceX * PIXELS_PER_METER);
    ambulanceEl.style.left = `${visualSourceX}px`;
}

initPositions();


// --- Simulation Logic ---

function startSimulation() {
    if (simulationRunning) return;
    simulationRunning = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    observerEl.style.cursor = 'not-allowed'; 
    
    initAudio(); 

    const paneWidth = simulationPane.offsetWidth;
    const centerX = paneWidth / 2;
    
    if (!isPaused) {
        const observerPixelX = parseFloat(observerEl.style.left || getComputedStyle(observerEl).left);
        observerX = (observerPixelX - centerX) / PIXELS_PER_METER;
        
        sourceX = -50; 
        if (sourceX > observerX - 20) {
            sourceX = observerX - 50;
        }
    }
    
    isPaused = false; 

    let frameCount = 0; 

    async function animationLoop() {
        if (!simulationRunning) return;

        // 1. Get current values from inputs
        const sourceSpeed = parseFloat(sourceSpeedInput.value); 
        const observerSpeed = parseFloat(observerSpeedInput.value); 
        const baseFreq = parseFloat(sourceFreqInput.value); 
        const sourcePower = parseFloat(sourcePowerInput.value); 

        // 2. Update positions
        const dt = 1/60;
        sourceX += sourceSpeed * dt; 
        observerX += observerSpeed * dt;

        const visualSourceX = centerX + (sourceX * PIXELS_PER_METER);
        const visualObserverX = centerX + (observerX * PIXELS_PER_METER);
        
        ambulanceEl.style.left = `${visualSourceX}px`;
        observerEl.style.left = `${visualObserverX}px`;

        // 3. Calculate Geometry
        const dx = sourceX - observerX; 
        const dy = PASSING_DISTANCE;    
        const totalDistance = Math.sqrt(dx*dx + dy*dy);
        
        const ux = (observerX - sourceX) / totalDistance;
        const vSourceRadial = sourceSpeed * ux;
        const vObserverRadial = observerSpeed * (-ux);

        // 4. Call Java Backend for Calculations (Two separate calls)
        try {
            // Call 1: Frequency
            const freqResponse = await fetch(`/calculate-frequency?sourceFrequency=${baseFreq}&sourceVelocity=${vSourceRadial}&observerVelocity=${vObserverRadial}`);
            const freqData = await freqResponse.json();
            const observedFreq = freqData.observedFrequency;

            // Call 2: Intensity
            const intResponse = await fetch(`/calculate-intensity?sourcePower=${sourcePower}&distance=${totalDistance}`);
            const intData = await intResponse.json();
            const intensityWatts = intData.intensity;

            // 5. Update Audio
            if (oscillator) {
                oscillator.frequency.setTargetAtTime(observedFreq, audioContext.currentTime, 0.1);
            }
            
            // Audio Volume
            const referenceIntensity = 1.59; 
            let gainValue = intensityWatts / referenceIntensity;
            gainValue = Math.min(gainValue, 1.0); 
            
            if (gainNode) {
                gainNode.gain.setTargetAtTime(gainValue, audioContext.currentTime, 0.1);
            }

            // 6. Update UI Text
            observedFreqEl.textContent = observedFreq.toFixed(2);
            distanceEl.textContent = totalDistance.toFixed(2); 
            intensityEl.textContent = intensityWatts.toFixed(4);

            // 7. Update LaTeX Equations (Throttled)
            frameCount++;
            if (frameCount % 10 === 0) { 
                updateLatex(baseFreq, vObserverRadial, vSourceRadial, observedFreq, sourcePower, totalDistance, intensityWatts);
            }

        } catch (error) {
            console.error("Error fetching calculation:", error);
        }

        // 8. Check for end condition
        if (visualSourceX > simulationPane.offsetWidth + 100) {
            stopSimulation(true); 
        } else {
            animationFrameId = requestAnimationFrame(animationLoop);
        }
    }

    animationFrameId = requestAnimationFrame(animationLoop);
}

function updateLatex(f0, v0, vs, fPrime, P, r, I) {
    if (typeof MathJax === 'undefined') return;

    const dopplerLatex = `$$ f' = ${f0} \\left( \\frac{343 + ${v0.toFixed(2)}}{343 - ${vs.toFixed(2)}} \\right) = ${fPrime.toFixed(2)} \\text{ Hz} $$`;
    const intensityLatex = `$$ I = \\frac{${P}}{2\\pi (${r.toFixed(2)})} = ${I.toFixed(4)} \\text{ W/m}^2 $$`;

    liveDopplerEq.innerHTML = dopplerLatex;
    liveIntensityEq.innerHTML = intensityLatex;

    MathJax.typesetPromise([liveDopplerEq, liveIntensityEq]).catch((err) => console.log(err));
}

function stopSimulation(finished = false) {
    simulationRunning = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    observerEl.style.cursor = 'grab'; 
    cancelAnimationFrame(animationFrameId);
    
    if (gainNode) {
        gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.5);
    }
    
    if (finished) {
        isPaused = false; 
    } else {
        isPaused = true; 
    }
}

function resetSimulation() {
    stopSimulation(true); 
    
    observedFreqEl.textContent = 'N/A';
    distanceEl.textContent = 'N/A';
    intensityEl.textContent = 'N/A';
    
    liveDopplerEq.innerHTML = `$$ f' = 500 \\left( \\frac{343 + 0.00}{343 - 0.00} \right) = 500.00 \\text{ Hz} $$`;
    liveIntensityEq.innerHTML = `$$ I = \\frac{100}{2\\pi (0.00)} = 0.00 \\text{ W/m}^2 $$`;
    if (typeof MathJax !== 'undefined') {
        MathJax.typesetPromise([liveDopplerEq, liveIntensityEq]);
    }
    
    initPositions(); 
}
