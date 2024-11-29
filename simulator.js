class Simulator {
    constructor(canvas, simSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.simSize = simSize;
        this.particles = [];
        this.grid = new Grid(simSize, 100);
        this.paused = false;
        this.speedMultiplier = 1;
        this.friction = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.fps = 0;

        // Initialize physics worker
        this.physicsWorker = new Worker('physics-worker.js');
        this.physicsWorker.onmessage = (e) => {
            if (e.data.type === 'update') {
                // Reconstruct Particle objects from worker data
                this.particles = e.data.particles.map(particleData => {
                    const particle = new Particle(
                        particleData.x,
                        particleData.y,
                        particleData.mass,
                        particleData.size
                    );
                    // Copy current state
                    particle.vx = particleData.vx;
                    particle.vy = particleData.vy;
                    particle.ax = particleData.ax;
                    particle.ay = particleData.ay;
                    return particle;
                });
            }
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.scale = Math.min(
            this.canvas.width / this.simSize,
            this.canvas.height / this.simSize
        );
        
        // Update simulation size in worker
        this.physicsWorker.postMessage({
            type: 'simSize',
            size: this.simSize
        });
    }

    worldToScreen(x, y) {
        const centerOffsetX = (this.canvas.width - this.simSize * this.scale) / 2;
        const centerOffsetY = (this.canvas.height - this.simSize * this.scale) / 2;
        return {
            x: x * this.scale + centerOffsetX,
            y: y * this.scale + centerOffsetY
        };
    }

    screenToWorld(x, y) {
        const centerOffsetX = (this.canvas.width - this.simSize * this.scale) / 2;
        const centerOffsetY = (this.canvas.height - this.simSize * this.scale) / 2;
        return {
            x: (x - centerOffsetX) / this.scale,
            y: (y - centerOffsetY) / this.scale
        };
    }

    addParticle(x, y, mass, size) {
        const particle = new Particle(x, y, mass * 1e12, size);
        this.particles.push(particle);
        this.physicsWorker.postMessage({
            type: 'update',
            particles: this.particles
        });
        return particle;
    }

    clear() {
        this.particles = [];
        this.physicsWorker.postMessage({
            type: 'update',
            particles: this.particles
        });
    }

    setPaused(paused) {
        this.paused = paused;
        this.physicsWorker.postMessage({
            type: 'pause',
            paused: paused
        });
    }

    setSpeed(speed) {
        this.speedMultiplier = speed;
        this.physicsWorker.postMessage({
            type: 'speed',
            speed: speed
        });
    }

    setFriction(value) {
        this.physicsWorker.postMessage({
            type: 'friction',
            friction: value
        });
    }

    setDampening(value) {
        this.physicsWorker.postMessage({
            type: 'dampening',
            dampening: value
        });
    }

    updateFPS(currentTime) {
        this.frameCount++;
        if (currentTime > this.lastFpsUpdate + 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
            this.lastFpsUpdate = currentTime;
            this.frameCount = 0;
            document.getElementById('fps').textContent = this.fps;
            document.getElementById('objectCount').textContent = this.particles.length;
        }
    }

    draw(currentTime) {
        this.updateFPS(currentTime);
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw simulation boundary
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        const bounds = this.worldToScreen(0, 0);
        const boundsSize = this.simSize * this.scale;
        this.ctx.strokeRect(bounds.x, bounds.y, boundsSize, boundsSize);

        // Save context state
        this.ctx.save();
        
        // Apply world-to-screen transform
        const centerOffsetX = (this.canvas.width - this.simSize * this.scale) / 2;
        const centerOffsetY = (this.canvas.height - this.simSize * this.scale) / 2;
        this.ctx.translate(centerOffsetX, centerOffsetY);
        this.ctx.scale(this.scale, this.scale);

        // Draw particles
        for (const particle of this.particles) {
            particle.draw(this.ctx);
        }

        // Restore context state
        this.ctx.restore();
    }

    animate(currentTime) {
        this.draw(currentTime);
        requestAnimationFrame((time) => this.animate(time));
    }

    start() {
        // Initialize physics worker with current particles and simulation size
        this.physicsWorker.postMessage({
            type: 'init',
            particles: this.particles,
            simSize: this.simSize
        });
        
        // Start animation loop
        requestAnimationFrame((time) => this.animate(time));
    }
}
