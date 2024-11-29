document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('simCanvas');
    const simSizeInput = document.getElementById('simSize');
    const simSpeedSelect = document.getElementById('simSpeed');
    const objectSizeInput = document.getElementById('objectSize');
    const objectMassInput = document.getElementById('objectMass');
    const addObjectBtn = document.getElementById('addObject');
    const clearSimBtn = document.getElementById('clearSim');
    const pauseSimBtn = document.getElementById('pauseSim');

    // Initialize simulator
    const simulator = new Simulator(canvas, parseInt(simSizeInput.value));
    simulator.start();

    // Add initial particles
    const centerX = simulator.simSize / 2;
    const centerY = simulator.simSize / 2;
    
    // Add several particles with small initial velocities
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const distance = 300;  // Fixed distance from center
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const particle = simulator.addParticle(x, y, 2000, 15);
        
        // Add small initial velocity perpendicular to radius
        const speed = 2;  // Reduced initial speed
        particle.vx = -Math.sin(angle) * speed;
        particle.vy = Math.cos(angle) * speed;
    }

    // Event Listeners
    simSizeInput.addEventListener('change', () => {
        simulator.simSize = parseInt(simSizeInput.value);
        simulator.resize();
    });

    simSpeedSelect.addEventListener('change', () => {
        const speed = simSpeedSelect.value;
        simulator.setSpeed(speed === 'unlimited' ? 100 : parseFloat(speed));
    });

    const frictionInput = document.getElementById('friction');
    const frictionValue = document.getElementById('frictionValue');
    const dampeningInput = document.getElementById('dampening');
    const dampeningValue = document.getElementById('dampeningValue');
    
    frictionInput.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        frictionValue.textContent = `${e.target.value}%`;
        simulator.setFriction(value);
    });

    dampeningInput.addEventListener('input', (e) => {
        const value = e.target.value / 100;
        dampeningValue.textContent = `${e.target.value}%`;
        simulator.setDampening(value);
    });

    let isAddingObject = false;
    addObjectBtn.addEventListener('click', () => {
        isAddingObject = true;
        canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('click', (e) => {
        if (!isAddingObject) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = simulator.screenToWorld(mouseX, mouseY);

        simulator.addParticle(
            worldPos.x,
            worldPos.y,
            parseFloat(objectMassInput.value),
            parseFloat(objectSizeInput.value)
        );

        isAddingObject = false;
        canvas.style.cursor = 'default';
    });

    clearSimBtn.addEventListener('click', () => {
        simulator.clear();
    });

    pauseSimBtn.addEventListener('click', () => {
        simulator.setPaused(!simulator.paused);
        pauseSimBtn.textContent = simulator.paused ? 'Resume' : 'Pause';
    });
});
