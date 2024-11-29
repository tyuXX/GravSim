class Particle {
    constructor(x, y, mass, size) {
        this.x = new Decimal(x);
        this.y = new Decimal(y);
        this.mass = new Decimal(mass);
        this.size = new Decimal(size);
        this.vx = new Decimal(0);
        this.vy = new Decimal(0);
        this.ax = new Decimal(0);
        this.ay = new Decimal(0);
        this.color = this.generateColor();
    }

    generateColor() {
        // Generate color based on mass (using log scale due to large mass values)
        const hue = (Math.log10(this.mass.toString()) * 30) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    update(dt, friction = 0) {
        // Verlet integration for more accurate physics
        const oldX = this.x;
        const oldY = this.y;
        
        // Update position using velocity and acceleration
        this.x = this.x.plus(this.vx.times(dt)).plus(this.ax.times(dt).times(dt).div(2));
        this.y = this.y.plus(this.vy.times(dt)).plus(this.ay.times(dt).times(dt).div(2));
        
        // Update velocity using acceleration
        this.vx = this.vx.plus(this.ax.times(dt));
        this.vy = this.vy.plus(this.ay.times(dt));

        // Apply friction (if any)
        if (friction > 0) {
            const frictionFactor = new Decimal(1).minus(new Decimal(friction).times(dt));
            this.vx = this.vx.times(frictionFactor);
            this.vy = this.vy.times(frictionFactor);

            // Stop very slow movement to prevent endless tiny motion
            if (this.vx.abs().lt(new Decimal('0.001'))) this.vx = new Decimal(0);
            if (this.vy.abs().lt(new Decimal('0.001'))) this.vy = new Decimal(0);
        }

        // Reset acceleration for next frame
        this.ax = new Decimal(0);
        this.ay = new Decimal(0);
    }

    applyForce(fx, fy) {
        // F = ma, therefore a = F/m
        this.ax = this.ax.plus(new Decimal(fx).div(this.mass));
        this.ay = this.ay.plus(new Decimal(fy).div(this.mass));
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x.toString(), this.y.toString(), this.size.toString(), 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    // Serialize for worker transfer
    serialize() {
        return {
            x: this.x.toString(),
            y: this.y.toString(),
            vx: this.vx.toString(),
            vy: this.vy.toString(),
            ax: this.ax.toString(),
            ay: this.ay.toString(),
            mass: this.mass.toString(),
            size: this.size.toString()
        };
    }

    // Deserialize from worker transfer
    static deserialize(data) {
        const particle = new Particle(
            new Decimal(data.x),
            new Decimal(data.y),
            new Decimal(data.mass),
            new Decimal(data.size)
        );
        particle.vx = new Decimal(data.vx);
        particle.vy = new Decimal(data.vy);
        particle.ax = new Decimal(data.ax);
        particle.ay = new Decimal(data.ay);
        return particle;
    }

    // Clone particle
    clone() {
        const particle = new Particle(
            this.x,
            this.y,
            this.mass,
            this.size
        );
        particle.vx = this.vx;
        particle.vy = this.vy;
        particle.ax = this.ax;
        particle.ay = this.ay;
        return particle;
    }
}
