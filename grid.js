class Grid {
    constructor(size, cellSize) {
        this.size = size;
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    // Get cell key from position
    getCellKey(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    // Add particle to grid
    addParticle(particle) {
        const key = this.getCellKey(particle.x, particle.y);
        if (!this.cells.has(key)) {
            this.cells.set(key, new Set());
        }
        this.cells.get(key).add(particle);
    }

    // Clear grid
    clear() {
        this.cells.clear();
    }

    // Get nearby particles
    getNearbyParticles(x, y, radius = this.cellSize) {
        const nearby = new Set();
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        const searchRadius = Math.ceil(radius / this.cellSize);

        for (let i = -searchRadius; i <= searchRadius; i++) {
            for (let j = -searchRadius; j <= searchRadius; j++) {
                const key = `${cellX + i},${cellY + j}`;
                if (this.cells.has(key)) {
                    for (const particle of this.cells.get(key)) {
                        nearby.add(particle);
                    }
                }
            }
        }

        return nearby;
    }
}
