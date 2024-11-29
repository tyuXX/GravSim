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
        this.zoom = 1.0;
        this.minZoom = 0.1;
        this.zoomSensitivity = 0.001;

        // Initialize physics worker
        this.physicsWorker = new Worker('physics-worker.js');
        this.physicsWorker.onmessage = (e) => this.handlePhysicsMessage(e);

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('wheel', (e) => this.handleZoom(e.deltaY, e.clientX, e.clientY));
    }

    calculateMaxZoom() {
        // Calculate zoom level that would show the entire simulation
        const horizontalZoom = this.canvas.width / this.simSize;
        const verticalZoom = this.canvas.height / this.simSize;
        return Math.min(horizontalZoom, verticalZoom);
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.scale = Math.min(
            this.canvas.width / this.simSize,
            this.canvas.height / this.simSize
        ) * this.zoom;
        
        // Update simulation size in worker
        this.physicsWorker.postMessage({
            type: 'simSize',
            size: this.simSize
        });
    }

    worldToScreen(x, y) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        return {
            x: centerX + (x - this.simSize / 2) * this.scale,
            y: centerY + (y - this.simSize / 2) * this.scale
        };
    }

    screenToWorld(x, y) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        return {
            x: (x - centerX) / this.scale + this.simSize / 2,
            y: (y - centerY) / this.scale + this.simSize / 2
        };
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
            this.zoom = Math.max(this.minZoom, newZoom); // Keep minimum zoom limit for stability
        }
        
        // Update scale
        this.scale = Math.min(
            this.canvas.width / this.simSize,
            this.canvas.height / this.simSize
        ) * this.zoom;

        // Get world position after zoom
        const worldAfter = this.screenToWorld(mouseX, mouseY);
        
        // Adjust particle positions to maintain mouse position
        const dx = worldAfter.x - worldBefore.x;
        const dy = worldAfter.y - worldBefore.y;
        
        // Update rendering
        this.draw();
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

    updateStats() {
        // Update object count
        const objectCountElement = document.getElementById('objectCount');
        if (objectCountElement) {
            objectCountElement.textContent = `Objects: ${this.particles.length}`;
        }

        // Update FPS
        const now = performance.now();
        this.frameCount++;
        
        if (now - this.lastFpsUpdate > 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            // Update FPS display
            const fpsDisplay = document.getElementById('fps');
            if (fpsDisplay) {
                fpsDisplay.textContent = `FPS: ${this.fps}`;
            }
        }
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw particles
        for (const particle of this.particles) {
            const screenPos = this.worldToScreen(particle.x, particle.y);
            const screenSize = particle.size * this.scale;

            // Skip if particle is outside view
            if (screenPos.x + screenSize < 0 || 
                screenPos.x - screenSize > this.canvas.width ||
                screenPos.y + screenSize < 0 || 
                screenPos.y - screenSize > this.canvas.height) {
                continue;
            }

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, screenSize, 0, Math.PI * 2);
            
            // Color based on mass (logarithmic scale)
            const massValue = Math.log10(particle.mass) / 10;
            const hue = 240 * (1 - massValue); // Blue (240) to Red (0)
            this.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            
            this.ctx.fill();
        }

        // Update stats
        this.updateStats();
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = '#333333';
        ctx.fillStyle = '#666666';
        ctx.font = '10px Arial';
        
        // Calculate ideal grid size based on screen space
        const minGridSpacing = 80; // Minimum pixels between grid lines
        const worldWidth = Math.abs(this.screenToWorld(this.canvas.width, 0).x - this.screenToWorld(0, 0).x);
        const worldHeight = Math.abs(this.screenToWorld(0, this.canvas.height).y - this.screenToWorld(0, 0).y);
        
        // Find appropriate grid size (powers of 10)
        const baseExp = Math.floor(Math.log10(worldWidth * minGridSpacing / this.canvas.width));
        let gridSize = Math.pow(10, baseExp);
        
        // Fine-tune grid size using 2 and 5 multiples
        const normalizedSpacing = (gridSize * this.scale);
        if (normalizedSpacing < minGridSpacing) {
            if (normalizedSpacing * 2 >= minGridSpacing) {
                gridSize *= 2;
            } else if (normalizedSpacing * 5 >= minGridSpacing) {
                gridSize *= 5;
            } else {
                gridSize *= 10;
            }
        }
        
        // Calculate visible area in world coordinates
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.canvas.width, this.canvas.height);
        
        // Calculate grid start and end points
        const startX = Math.floor(topLeft.x / gridSize) * gridSize;
        const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
        const startY = Math.floor(topLeft.y / gridSize) * gridSize;
        const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;
        
        ctx.beginPath();
        ctx.lineWidth = 0.5;
        
        // Draw vertical lines and x-coordinates
        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = this.worldToScreen(x, 0).x;
            
            // Draw grid line
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this.canvas.height);
            
            // Format number based on size
            let label;
            if (Math.abs(x) >= 1000) {
                label = (x / 1000).toFixed(1) + 'k';
            } else {
                label = x.toFixed(0);
            }
            
            // Position label in the top-left corner
            const textWidth = ctx.measureText(label).width;
            
            // Draw background for better readability
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(screenX - textWidth/2 - 2, 2, textWidth + 4, 14);
            ctx.restore();
            
            // Draw text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, screenX, 4);
        }
        
        // Draw horizontal lines and y-coordinates
        for (let y = startY; y <= endY; y += gridSize) {
            const screenY = this.worldToScreen(0, y).y;
            
            // Draw grid line
            ctx.moveTo(0, screenY);
            ctx.lineTo(this.canvas.width, screenY);
            
            // Format number based on size
            let label;
            if (Math.abs(y) >= 1000) {
                label = (y / 1000).toFixed(1) + 'k';
            } else {
                label = y.toFixed(0);
            }
            
            // Position label on the left side
            // Draw background for better readability
            ctx.save();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(4, screenY - 7, textWidth + 4, 14);
            ctx.restore();
            
            // Draw text
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 6, screenY);
        }
        
        ctx.stroke();
    }

    handlePhysicsMessage(e) {
        if (e.data.type === 'update') {
            this.particles = e.data.particles;
            // Update object count after physics update
            const objectCountElement = document.getElementById('objectCount');
            if (objectCountElement) {
                objectCountElement.textContent = `Objects: ${this.particles.length}`;
            }
        }
    }

    animate(currentTime) {
        this.draw();
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
