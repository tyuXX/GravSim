class Simulator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.simSize = 5000;
        this.zoom = 1.0;
        this.minZoom = 0.1;
        this.zoomSensitivity = 0.001;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.fps = 0;
        this.scale = Math.min(
            this.canvas.width / this.simSize,
            this.canvas.height / this.simSize
        ) * this.zoom;

        // Initialize physics worker
        this.physicsWorker = new Worker('physics-worker.js');
        this.physicsWorker.onmessage = (e) => this.handlePhysicsMessage(e);

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('wheel', (e) => this.handleZoom(e.deltaY, e.clientX, e.clientY));
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.scale = Math.min(
            this.canvas.width / this.simSize,
            this.canvas.height / this.simSize
        ) * this.zoom;
        this.draw();
    }

    screenToWorld(screenX, screenY) {
        const centerOffsetX = (this.canvas.width - this.simSize * this.scale) / 2;
        const centerOffsetY = (this.canvas.height - this.simSize * this.scale) / 2;
        return {
            x: (screenX - centerOffsetX) / this.scale,
            y: (screenY - centerOffsetY) / this.scale
        };
    }

    worldToScreen(worldX, worldY) {
        const centerOffsetX = (this.canvas.width - this.simSize * this.scale) / 2;
        const centerOffsetY = (this.canvas.height - this.simSize * this.scale) / 2;
        return {
            x: worldX * this.scale + centerOffsetX,
            y: worldY * this.scale + centerOffsetY
        };
    }

    addParticle(x, y, mass, size) {
        const particle = new Particle(x, y, mass, size);
        this.particles.push(particle);
        
        // Send serialized particle data to physics worker
        this.physicsWorker.postMessage({
            type: 'update',
            particles: this.particles.map(p => p.serialize())
        });
        return particle;
    }

    clear() {
        this.particles = [];
        this.physicsWorker.postMessage({
            type: 'update',
            particles: this.particles.map(p => p.serialize())
        });
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw particles
        for (const particle of this.particles) {
            const screenPos = this.worldToScreen(particle.x, particle.y);
            this.ctx.beginPath();
            this.ctx.arc(
                screenPos.x,
                screenPos.y,
                particle.size * this.scale,
                0,
                Math.PI * 2
            );
            this.ctx.fillStyle = particle.color;
            this.ctx.fill();
        }

        // Update object count
        const objectCountElement = document.getElementById('objectCount');
        if (objectCountElement) {
            objectCountElement.textContent = `Objects: ${this.particles.length}`;
        }
    }

    drawGrid() {
        const minSpacing = 80; // Minimum pixels between grid lines
        const baseIntervals = [1, 2, 5, 10]; // Possible base intervals
        
        // Calculate the world space size of minSpacing pixels
        const worldSpaceMinSpacing = minSpacing / this.scale;
        
        // Find the appropriate power of 10
        const power = Math.floor(Math.log10(worldSpaceMinSpacing));
        const powerOf10 = Math.pow(10, power);
        
        // Find the appropriate base interval
        let interval = baseIntervals[0] * powerOf10;
        for (const base of baseIntervals) {
            const testInterval = base * powerOf10;
            if (testInterval > worldSpaceMinSpacing) {
                break;
            }
            interval = testInterval;
        }

        // Calculate grid bounds
        const startX = Math.floor(0 / interval) * interval;
        const endX = Math.ceil(this.simSize / interval) * interval;
        const startY = Math.floor(0 / interval) * interval;
        const endY = Math.ceil(this.simSize / interval) * interval;

        // Set grid style
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.fillStyle = '#666';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';

        // Draw vertical grid lines
        for (let x = startX; x <= endX; x += interval) {
            if (x < 0 || x > this.simSize) continue;
            
            const screenX = this.worldToScreen(x, 0).x;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, 0);
            this.ctx.lineTo(screenX, this.canvas.height);
            this.ctx.stroke();

            // Draw coordinate label
            let label = x.toString();
            if (Math.abs(x) >= 1000) {
                label = (x / 1000).toFixed(1) + 'k';
            }
            this.ctx.fillText(label, screenX - 5, 5);
        }

        // Draw horizontal grid lines
        for (let y = startY; y <= endY; y += interval) {
            if (y < 0 || y > this.simSize) continue;
            
            const screenY = this.worldToScreen(0, y).y;
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenY);
            this.ctx.lineTo(this.canvas.width, screenY);
            this.ctx.stroke();

            // Draw coordinate label
            let label = y.toString();
            if (Math.abs(y) >= 1000) {
                label = (y / 1000).toFixed(1) + 'k';
            }
            this.ctx.fillText(label, 35, screenY + 5);
        }
    }

    calculateMaxZoom() {
        // Calculate zoom level that would show the entire simulation
        const horizontalZoom = this.canvas.width / this.simSize;
        const verticalZoom = this.canvas.height / this.simSize;
        return Math.min(horizontalZoom, verticalZoom);
    }

    handleZoom(deltaY, mouseX, mouseY) {
        // Store world position of mouse before zoom
        const worldBefore = this.screenToWorld(mouseX, mouseY);
        
        // Calculate zoom change
        const zoomDelta = -deltaY * this.zoomSensitivity;
        const newZoom = this.zoom * (1 + zoomDelta);
        
        // Calculate max zoom to keep simulation in view
        const maxZoom = this.calculateMaxZoom();
        
        // Apply zoom with limits (only limit outward zoom)
        if (zoomDelta < 0) { // Zooming out
            this.zoom = Math.max(maxZoom, newZoom);
        } else { // Zooming in
            this.zoom = Math.max(this.minZoom, newZoom);
        }
        
        // Update scale
        this.scale = Math.min(
            this.canvas.width / this.simSize,
            this.canvas.height / this.simSize
        ) * this.zoom;

        // Get world position after zoom
        const worldAfter = this.screenToWorld(mouseX, mouseY);
        
        // Adjust view to maintain mouse position
        const dx = worldAfter.x - worldBefore.x;
        const dy = worldAfter.y - worldBefore.y;
        
        // Update rendering
        this.draw();
    }

    handlePhysicsMessage(e) {
        if (e.data.type === 'update') {
            // Update particles with deserialized data
            this.particles = e.data.particles.map(p => Particle.deserialize(p));
            this.draw();

            // Update object count
            const objectCountElement = document.getElementById('objectCount');
            if (objectCountElement) {
                objectCountElement.textContent = `Objects: ${this.particles.length}`;
            }
        }
    }

    init() {
        // Send initial serialized particle data to physics worker
        this.physicsWorker.postMessage({
            type: 'init',
            particles: this.particles.map(p => p.serialize()),
            simSize: this.simSize
        });
    }

    animate(currentTime) {
        // Calculate FPS
        if (currentTime - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;

            // Update FPS display
            const fpsElement = document.getElementById('fps');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${this.fps}`;
            }
        }
        this.frameCount++;

        requestAnimationFrame((time) => this.animate(time));
    }

    start() {
        // Initialize physics worker with current particles and simulation size
        this.init();
        
        // Start animation loop
        requestAnimationFrame((time) => this.animate(time));
    }

    setPaused(paused) {
        this.physicsWorker.postMessage({ type: 'pause', paused });
    }

    setSpeed(speed) {
        this.physicsWorker.postMessage({ type: 'speed', speed });
    }

    setFriction(friction) {
        this.physicsWorker.postMessage({ type: 'friction', friction });
    }

    setDampening(dampening) {
        this.physicsWorker.postMessage({ type: 'dampening', dampening });
    }
}
