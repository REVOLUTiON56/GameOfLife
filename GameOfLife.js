class GameOfLife {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;
        
        // 0 - мертвая клетка, 1 - живая.
        this.grid = new Uint8Array(this.size);
        this.nextGrid = new Uint8Array(this.size);
    }

    // Преобразование 2D координат в 1D индекс
    getIndex(x, y) {
        return y * this.width + x;
    }

    // Заполнение случайными значениями
    fillRandom() {
        for (let i = 0; i < this.size; i++) {
            this.grid[i] = Math.random() > 0.5 ? 1 : 0;
        }
    }

    // Очистка поля
    clear() {
        this.grid.fill(0);
    }

    // Переключение состояния одной клетки (для кликов мыши)
    toggleCell(x, y, forceAlive = false) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = this.getIndex(x, y);
        this.grid[idx] = forceAlive ? 1 : (this.grid[idx] ? 0 : 1);
    }

    // Шаг эволюции (расчет следующего поколения)
    step() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = this.getIndex(x, y);
                let neighbors = 0;

                // Быстрый подсчет соседей без создания лишних объектов
                const top = y > 0;
                const bottom = y < this.height - 1;
                const left = x > 0;
                const right = x < this.width - 1;

                if (top && left && this.grid[idx - this.width - 1]) neighbors++;
                if (top && this.grid[idx - this.width]) neighbors++;
                if (top && right && this.grid[idx - this.width + 1]) neighbors++;
                
                if (left && this.grid[idx - 1]) neighbors++;
                if (right && this.grid[idx + 1]) neighbors++;
                
                if (bottom && left && this.grid[idx + this.width - 1]) neighbors++;
                if (bottom && this.grid[idx + this.width]) neighbors++;
                if (bottom && right && this.grid[idx + this.width + 1]) neighbors++;

                // Применение правил Конвея
                const isAlive = this.grid[idx] === 1;
                if (isAlive && (neighbors === 2 || neighbors === 3)) {
                    this.nextGrid[idx] = 1; // Выживает
                } else if (!isAlive && neighbors === 3) {
                    this.nextGrid[idx] = 1; // Зарождается
                } else {
                    this.nextGrid[idx] = 0; // Умирает (от одиночества или перенаселения)
                }
            }
        }

        [this.grid, this.nextGrid] = [this.nextGrid, this.grid];
    }
}

class GameRenderer {
    constructor(canvas, game, cellSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.cellSize = cellSize;

        this.canvas.width = game.width * cellSize;
        this.canvas.height = game.height * cellSize;
    }

    draw() {
        // Очищаем фон
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем сетку (оптимизировано: рисуем только линии, а не квадраты)
        this.ctx.strokeStyle = '#add8e6'; // lightblue
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = 0; x <= this.canvas.width; x += this.cellSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        for (let y = 0; y <= this.canvas.height; y += this.cellSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();

        // Рисуем только живые клетки
        this.ctx.fillStyle = '#000000';
        for (let i = 0; i < this.game.size; i++) {
            if (this.game.grid[i] === 1) {
                const x = i % this.game.width;
                const y = Math.floor(i / this.game.width);
                this.ctx.fillRect(
                    x * this.cellSize, 
                    y * this.cellSize, 
                    this.cellSize, 
                    this.cellSize
                );
            }
        }
    }
}

// 3. Контроллер (Управление состоянием, циклом и событиями)
class GameController {
    constructor(canvas, width, height, cellSize, delay) {
        this.game = new GameOfLife(width, height);
        this.renderer = new GameRenderer(canvas, this.game, cellSize);
        
        this.delay = delay;
        this.isRunning = false;
        this.lastTime = 0;
        this.animationId = null;
        this.isDrawing = false;

        this.bindEvents(canvas, cellSize);
        this.renderer.draw(); // Первичная отрисовка пустой сетки
    }

    bindEvents(canvas, cellSize) {
        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: Math.floor((e.clientX - rect.left) / cellSize),
                y: Math.floor((e.clientY - rect.top) / cellSize)
            };
        };

        canvas.addEventListener('mousedown', (e) => {
            this.isDrawing = true;
            const pos = getMousePos(e);
            this.game.toggleCell(pos.x, pos.y);
            this.renderer.draw();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.isDrawing) return;
            const pos = getMousePos(e);
            // При движении мыши только "зажигаем" клетки (forceAlive = true)
            this.game.toggleCell(pos.x, pos.y, true); 
            this.renderer.draw();
        });

        window.addEventListener('mouseup', () => {
            this.isDrawing = false;
        });
    }

    // Игровой цикл с использованием requestAnimationFrame
    loop = (timestamp) => {
        if (!this.isRunning) return;

        if (timestamp - this.lastTime >= this.delay) {
            this.game.step();
            this.renderer.draw();
            this.lastTime = timestamp;
        }

        this.animationId = requestAnimationFrame(this.loop);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationId = requestAnimationFrame(this.loop);
    }

    pause() {
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    reset() {
        this.pause();
        this.game.clear();
        this.renderer.draw();
    }

    fillRandom() {
        this.pause();
        this.game.fillRandom();
        this.renderer.draw();
    }

    setDelay(newDelay) {
        this.delay = Math.max(50, Math.min(3000, newDelay)); // clamp 50-3000
    }
}
