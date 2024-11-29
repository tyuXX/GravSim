importScripts('https://cdnjs.cloudflare.com/ajax/libs/decimal.js/10.4.3/decimal.min.js');

// Configure Decimal precision
Decimal.set({ precision: 64, rounding: 4 });

// Physics constants
const G = new Decimal('6.67430e-11'); // Real gravitational constant
const SCALE_FACTOR = new Decimal('1e8'); // Scale factor for forces
const PHYSICS_STEP = new Decimal('16.666666667'); // Fixed timestep (60 updates per second)
const VELOCITY_EPSILON = new Decimal('1e-20'); // Threshold for zero velocity
const SOFTENING_FACTOR = new Decimal('0.5'); // Softening factor for close encounters
const ZERO = new Decimal('0');
const ONE = new Decimal('1');
const TWO = new Decimal('2');

let particles = [];
let isPaused = false;
let friction = new Decimal('0.01'); // Default space friction
let dampening = new Decimal('0.05'); // Default collision dampening
let speedMultiplier = new Decimal('1'); // Default speed multiplier
let simSize = new Decimal('5000'); // Default simulation size

// Physics update loop
function updatePhysics() {
    if (isPaused) return;

    const dt = PHYSICS_STEP.times(speedMultiplier).div(1000); // Convert to seconds

    // Calculate gravitational forces between ALL particles
    for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        
        // Calculate gravitational forces with ALL other particles
        for (let j = i + 1; j < particles.length; j++) {
            const other = particles[j];
            
            const dx = other.x.minus(particle.x);
            const dy = other.y.minus(particle.y);
            const distanceSquared = dx.times(dx).plus(dy.times(dy));
            const distance = distanceSquared.sqrt();

            // Handle close encounters and collisions
            const minDistance = particle.size.plus(other.size).times(new Decimal('1.5'));
            if (distance.lt(minDistance)) {
                // Calculate relative velocity
                const relativeVx = other.vx.minus(particle.vx);
                const relativeVy = other.vy.minus(particle.vy);
                const relativeSpeed = relativeVx.times(relativeVx).plus(relativeVy.times(relativeVy)).sqrt();

                // Calculate collision normal
                const nx = dx.div(distance);
                const ny = dy.div(distance);

                // Calculate impulse magnitude (elastic collision with dampening)
                const restitution = ONE.minus(dampening);
                const impulseMagnitude = restitution.negated().times(ONE.plus(restitution))
                    .times(relativeVx.times(nx).plus(relativeVy.times(ny)))
                    .div(ONE.div(particle.mass).plus(ONE.div(other.mass)));

                // Apply impulse
                const impulseX = nx.times(impulseMagnitude);
                const impulseY = ny.times(impulseMagnitude);

                particle.vx = particle.vx.minus(impulseX.div(particle.mass));
                particle.vy = particle.vy.minus(impulseY.div(particle.mass));
                other.vx = other.vx.plus(impulseX.div(other.mass));
                other.vy = other.vy.plus(impulseY.div(other.mass));

                // Separate particles to prevent sticking
                const overlap = minDistance.minus(distance);
                const separationX = overlap.times(dx).div(distance);
                const separationY = overlap.times(dy).div(distance);
                
                const totalMass = particle.mass.plus(other.mass);
                const particle_ratio = other.mass.div(totalMass);
                const other_ratio = particle.mass.div(totalMass);
                
                particle.x = particle.x.minus(separationX.times(particle_ratio));
                particle.y = particle.y.minus(separationY.times(particle_ratio));
                other.x = other.x.plus(separationX.times(other_ratio));
                other.y = other.y.plus(separationY.times(other_ratio));
                
                continue;
            }

            // Calculate gravitational force with softening
            const softeningSquared = Decimal.max(
                distanceSquared,
                minDistance.times(minDistance).times(SOFTENING_FACTOR)
            );
            const force = G.times(particle.mass).times(other.mass).div(softeningSquared);
            const scaledForce = force.times(SCALE_FACTOR);

            // Calculate and apply force components
            const forceMagnitude = scaledForce.div(softeningSquared.sqrt());
            const forceX = dx.times(forceMagnitude);
            const forceY = dy.times(forceMagnitude);

            // Apply forces (F = ma, so a = F/m)
            particle.ax = particle.ax.plus(forceX.div(particle.mass));
            particle.ay = particle.ay.plus(forceY.div(particle.mass));
            other.ax = other.ax.minus(forceX.div(other.mass));
            other.ay = other.ay.minus(forceY.div(other.mass));
        }

        // Update particle physics using semi-implicit Euler integration
        // Update velocity first
        particle.vx = particle.vx.plus(particle.ax.times(dt));
        particle.vy = particle.vy.plus(particle.ay.times(dt));

        // Apply friction if enabled
        if (!friction.isZero()) {
            const frictionFactor = ONE.minus(friction.times(dt));
            particle.vx = particle.vx.times(frictionFactor);
            particle.vy = particle.vy.times(frictionFactor);

            // Only zero out velocities if they're extremely close to zero
            if (particle.vx.abs().lt(VELOCITY_EPSILON)) {
                particle.vx = ZERO;
            }
            if (particle.vy.abs().lt(VELOCITY_EPSILON)) {
                particle.vy = ZERO;
            }
        }

        // Then update position using new velocity
        particle.x = particle.x.plus(particle.vx.times(dt));
        particle.y = particle.y.plus(particle.vy.times(dt));

        // Reset acceleration
        particle.ax = ZERO;
        particle.ay = ZERO;
    }

    // Remove particles that are outside the simulation bounds
    const margin = new Decimal('50'); // Safety margin
    particles = particles.filter(particle => {
        const negMargin = margin.negated();
        return particle.x.gte(negMargin) &&
               particle.x.lte(simSize.plus(margin)) &&
               particle.y.gte(negMargin) &&
               particle.y.lte(simSize.plus(margin));
    });

    // Send updated particles back to main thread
    self.postMessage({
        type: 'update',
        particles: particles.map(p => ({
            x: p.x.toString(),
            y: p.y.toString(),
            vx: p.vx.toString(),
            vy: p.vy.toString(),
            ax: p.ax.toString(),
            ay: p.ay.toString(),
            mass: p.mass.toString(),
            size: p.size.toString()
        }))
    });
}

// Set up physics loop with fixed timestep
setInterval(updatePhysics, PHYSICS_STEP.toNumber());

// Handle messages from main thread
self.onmessage = function(e) {
    switch (e.data.type) {
        case 'init':
            particles = e.data.particles.map(p => ({
                x: new Decimal(p.x),
                y: new Decimal(p.y),
                vx: new Decimal(p.vx || 0),
                vy: new Decimal(p.vy || 0),
                ax: new Decimal(p.ax || 0),
                ay: new Decimal(p.ay || 0),
                mass: new Decimal(p.mass),
                size: new Decimal(p.size)
            }));
            simSize = new Decimal(e.data.simSize);
            break;
        case 'update':
            particles = e.data.particles.map(p => ({
                x: new Decimal(p.x),
                y: new Decimal(p.y),
                vx: new Decimal(p.vx),
                vy: new Decimal(p.vy),
                ax: new Decimal(p.ax),
                ay: new Decimal(p.ay),
                mass: new Decimal(p.mass),
                size: new Decimal(p.size)
            }));
            break;
        case 'pause':
            isPaused = e.data.paused;
            break;
        case 'speed':
            speedMultiplier = new Decimal(e.data.speed);
            break;
        case 'friction':
            friction = new Decimal(e.data.friction);
            break;
        case 'dampening':
            dampening = new Decimal(e.data.dampening);
            break;
        case 'simSize':
            simSize = new Decimal(e.data.size);
            break;
    }
};
