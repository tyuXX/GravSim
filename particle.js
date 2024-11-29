class Particle {
    constructor(x, y, mass, size) {
        this.x = x;
        this.y = y;
        this.mass = mass;
        this.size = size;
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        this.color = this.generateColor();
    }

    generateColor() {
        // Generate color based on mass (using log scale due to large mass values)
        const hue = (Math.log10(this.mass) * 30) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    update(dt, friction = 0) {
        // Verlet integration for more accurate physics
        const oldX = this.x;
        const oldY = this.y;
        
        // Update position using velocity and acceleration
        this.x += this.vx * dt + 0.5 * this.ax * dt * dt;
        this.y += this.vy * dt + 0.5 * this.ay * dt * dt;
        
        // Update velocity using acceleration
        this.vx += this.ax * dt;
        this.vy += this.ay * dt;

        // Apply friction (if any)
        if (friction > 0) {
            const frictionFactor = 1 - (friction * dt);
            this.vx *= frictionFactor;
            this.vy *= frictionFactor;

            // Stop very slow movement to prevent endless tiny motion
            if (Math.abs(this.vx) < 0.001) this.vx = 0;
            if (Math.abs(this.vy) < 0.001) this.vy = 0;
        }

        // Reset acceleration for next frame
        this.ax = 0;
        this.ay = 0;
    }

    applyForce(fx, fy) {
        // F = ma, therefore a = F/m
        this.ax += fx / this.mass;
        this.ay += fy / this.mass;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}
