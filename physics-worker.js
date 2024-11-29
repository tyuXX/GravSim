// Physics constants
const G = 6.67430e-11; // Real gravitational constant
const SCALE_FACTOR = 1e8; // Scale factor for forces
const PHYSICS_STEP = 1000 / 60; // Fixed timestep (60 updates per second)
const VELOCITY_EPSILON = 1e-10; // Threshold for zero velocity

let particles = [];
let isPaused = false;
let friction = 0.01; // Default space friction
let dampening = 0.05; // Default collision dampening
let speedMultiplier = 1; // Default speed multiplier
let simSize = 5000; // Default simulation size

// Physics update loop
function updatePhysics() {
    if (isPaused) return;

    const dt = (PHYSICS_STEP / 1000) * speedMultiplier; // Convert to seconds

    // Calculate gravitational forces between ALL particles
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        // Calculate gravitational forces with ALL other particles
        for (let j = i + 1; j < particles.length; j++) {
            const other = particles[j];
            
            const dx = other.x - particle.x;
            const dy = other.y - particle.y;
            const distanceSquared = dx * dx + dy * dy;
            const distance = Math.sqrt(distanceSquared);

            // Handle close encounters with dampening
            const minDistance = (particle.size + other.size) * 1.5;
            if (distance < minDistance) {
                // Apply collision dampening
                particle.vx *= dampening;
                particle.vy *= dampening;
                other.vx *= dampening;
                other.vy *= dampening;
                continue;
            }

            // Calculate gravitational force with distance-based softening
            const softening = Math.max(distance, minDistance);
            const softeningSquared = softening * softening;
            const force = (G * particle.mass * other.mass) / softeningSquared;
            const scaledForce = force * SCALE_FACTOR;

            // Calculate and apply force components
            const forceX = scaledForce * dx / distance;
            const forceY = scaledForce * dy / distance;

            // Apply forces (F = ma, so a = F/m)
            particle.ax += forceX / particle.mass;
            particle.ay += forceY / particle.mass;
            other.ax -= forceX / other.mass;
            other.ay -= forceY / other.mass;
        }

        // Update particle physics using Verlet integration
        // Update position using velocity and acceleration
        particle.x += particle.vx * dt + 0.5 * particle.ax * dt * dt;
        particle.y += particle.vy * dt + 0.5 * particle.ay * dt * dt;
        
        // Update velocity
        particle.vx += particle.ax * dt;
        particle.vy += particle.ay * dt;

        // Apply friction if enabled
        if (friction > 0) {
            const frictionFactor = 1 - friction * dt;
            particle.vx *= frictionFactor;
            particle.vy *= frictionFactor;

            // Only zero out velocities if they're extremely close to zero
            if (Math.abs(particle.vx) < VELOCITY_EPSILON) {
                particle.vx = 0;
            }
            if (Math.abs(particle.vy) < VELOCITY_EPSILON) {
                particle.vy = 0;
            }
        }

        // Reset acceleration
        particle.ax = 0;
        particle.ay = 0;
    }

    // Remove particles that are outside the simulation bounds with floating point comparison
    particles = particles.filter(particle => {
        const margin = particle.size;
        return particle.x >= -margin &&
               particle.x <= simSize + margin &&
               particle.y >= -margin &&
               particle.y <= simSize + margin;
    });

    // Send updated particles back to main thread
    self.postMessage({ type: 'update', particles: particles });
}

// Set up physics loop with fixed timestep
setInterval(updatePhysics, PHYSICS_STEP);

// Handle messages from main thread
self.onmessage = function(e) {
    switch (e.data.type) {
        case 'init':
            particles = e.data.particles;
            simSize = e.data.simSize;
            break;
        case 'update':
            particles = e.data.particles;
            break;
        case 'pause':
            isPaused = e.data.paused;
            break;
        case 'speed':
            speedMultiplier = e.data.speed;
            break;
        case 'friction':
            friction = e.data.friction;
            break;
        case 'dampening':
            dampening = e.data.dampening;
            break;
        case 'simSize':
            simSize = e.data.size;
            break;
    }
};
