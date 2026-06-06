// 1. Ядро логики (Zero-Allocation, кэш-оптимизированные вычисления)
class GameOfLife {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;
        
        this.grid = new Uint8Array(this.size);
        this.nextGrid = new Uint8Array(this.size);
    }

    fillRandom() {
        for (let i = 0; i < this.size; i++) {
            this.grid[i] = Math.random() > 0.5 ? 1 : 0;
        }
    }

    clear() {
        this.grid.fill(0);
        this.nextGrid.fill(0);
    }

    getCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        return this.grid[y * this.width + x];
    }

    setCell(x, y, state) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.grid[y * this.width + x] = state;
    }

    step() {
        const w = this.width;
        const h = this.height;
        const current = this.grid;
        const next = this.nextGrid;

        for (let y = 0; y < h; y++) {
            // Предрасчет индексов смещения строк для минимизации математики в итерациях по X
            const row = y * w;
            const topRow = (y > 0 ? y - 1 : 0) * w;
            const bottomRow = (y < h - 1 ? y + 1 : y) * w;

            for (let x = 0; x < w; x++) {
                const left = x > 0 ? x - 1 : 0;
                const right = x < w - 1 ? x + 1 : x;

                // Суммируем значения соседей напрямую из типизированного массива
                const neighbors = 
                    current[topRow + left] + current[topRow + x] + current[topRow + right] +
                    current[row + left] +                          current[row + right] +
                    current[bottomRow + left] + current[bottomRow + x] + current[bottomRow + right];

                const idx = row + x;
                
                // Ветвление по правилам игры без создания промежуточных переменных
                if (current[idx] === 1) {
                    next[idx] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
                } else {
                    next[idx] = (neighbors === 3) ? 1 : 0;
                }
            }
        }

        // Атомарная смена указателей на массивы буферов
        this.grid = next;
        this.nextGrid = current;
    }
}

// 2. Попиксельный рендерер через 32-битный буфер ImageData
class GameRenderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;

        // Физический размер холста строго равен логическому размеру сетки
        this.canvas.width = game.width;
        this.canvas.height = game.height;

        // Создаем структуру ImageData для работы с пикселями напрямую
        this.imageData = this.ctx.createImageData(game.width, game.height);
        
        // Создаем 32-битное представление (View) поверх того же буфера памяти ImageData
        // Это позволяет управлять RGBA каналами пикселя за одну операцию записи
        this.buf32 = new Uint32Array(this.imageData.data.buffer);

        // Цвета в формате 0xAABBGGRR (Little-endian порядок байт для большинства систем)
        this.COLOR_ALIVE = 0xFF000000; // Черный (Alpha=255, B=0, G=0, R=0)
        this.COLOR_DEAD = 0xFFFFFFFF;  // Белый (Alpha=255, B=255, G=255, R=255)
    }

    draw() {
        const size = this.game.size;
        const grid = this.game.grid;
        const buf32 = this.buf32;

        // Линейный перенос состояния сетки в пиксельный буфер
        for (let i = 0; i < size; i++) {
            buf32[i] = grid[i] === 1 ? this.COLOR_ALIVE : this.COLOR_DEAD;
        }

        // Выгружаем готовый массив пикселей на экран за одну операцию
        this.ctx.putImageData(this.imageData, 0, 0);
    }
}

// 3. Контроллер управления (События мыши с учетом масштабирования CSS)
class GameController {
    constructor(canvas, width, height, delay) {
        this.game = new GameOfLife(width, height);
        this.renderer = new GameRenderer(canvas, this.game);
        
        this.delay = delay;
        this.isRunning = false;
        this.lastTime = 0;
        this.animationId = null;
        this.isDrawing = false;

        this.bindEvents(canvas);
        this.renderer.draw();
    }

    bindEvents(canvas) {
        // Функция корректно рассчитывает индекс клетки, учитывая разницу 
        // между физическим размером Canvas и его отображением на экране через CSS
        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: Math.floor((e.clientX - rect.left) * scaleX),
                y: Math.floor((e.clientY - rect.top) * scaleY)
            };
        };

        let drawMode = 1; 

        canvas.addEventListener('mousedown', (e) => {
            this.isDrawing = true;
            const pos = getMousePos(e);
            const currentState = this.game.getCell(pos.x, pos.y);
            drawMode = currentState === 1 ? 0 : 1;
            
            this.game.setCell(pos.x, pos.y, drawMode);
            this.renderer.draw();
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!this.isDrawing) return;
            const pos = getMousePos(e);
            this.game.setCell(pos.x, pos.y, drawMode);
            this.renderer.draw();
        });

        window.addEventListener('mouseup', () => {
            this.isDrawing = false;
        });
    }

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
        this.delay = Math.max(0, Math.min(3000, newDelay));
    }
}
