import { _decorator, Component, Node, Prefab, UITransform, instantiate, Vec2, EventTouch, Vec3 } from 'cc';
import { Tile } from './Tile';
const { ccclass, property } = _decorator;

@ccclass('Game')
export class Game extends Component {
    @property({ type: Node })
    public boardLayer: Node = null;

    @property({ type: Node })
    public tileLayer: Node = null;

    @property({ type: Node })
    public effectLayer: Node = null;

    @property({ type: Number })
    public rows: number = 8;

    @property({ type: Number })
    public columns: number = 8;

    @property({ type: Prefab, tooltip: "元素预制体" })
    public tilePrefab: Prefab = null;

    @property({ tooltip: "元素种类数量", min: 3, max: 8 })
    public tileTypes: number = 5;

    private board: number[][] = [];
    private tileNodes: Node[][] = [];
    private tileSize: number = 0;
    private selectedTile: Tile = null;
    private exchangeTile: Tile = null;
    private isSwapping: boolean = false;
    private lastSwapTime: number = 0;
    private readonly SWAP_COOLDOWN: number = 0.15;
    private touchStartPos: Vec2 = null;
    private readonly MOVE_THRESHOLD: number = 10;

    start() {
        const tileNode = instantiate(this.tilePrefab);
        this.tileSize = tileNode.getComponent(UITransform).width;
        tileNode.destroy();

        this.initializeBoard();
        this.createTileNodes();
        this.setupTouchEvents();  // 移到这里
    }

    onDestroy() {
        // 移除所有触摸事件监听
        this.tileLayer.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.tileLayer.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.tileLayer.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.tileLayer.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private createTileNodes() {
        for (let i = 0; i < this.rows; i++) {
            this.tileNodes[i] = [];
            for (let j = 0; j < this.columns; j++) {
                const node = instantiate(this.tilePrefab);
                node.parent = this.tileLayer;
                // 修改 y 坐标的计算，使其与行号相反
                node.position.set(
                    (j - this.columns/2 + 0.5) * this.tileSize,
                    ((this.rows - i - 1) - this.rows/2 + 0.5) * this.tileSize,
                    0
                );
                this.tileNodes[i][j] = node;
                node.getComponent(Tile).init(this.board[i][j], i, j);
            }
        }
    }

    private updateTileDisplay(row: number, col: number) {
        const tileType = this.board[row][col];
        this.tileNodes[row][col].getComponent(Tile).updateType(tileType);
    }

    private initializeBoard() {
        for (let i = 0; i < this.rows; i++) {
            this.board[i] = [];
            for (let j = 0; j < this.columns; j++) {
                this.board[i][j] = Math.floor(Math.random() * this.tileTypes);
            }
        }
    }

    update(deltaTime: number) {
        this.setupTouchEvents();
    }

    private setupTouchEvents() {
        this.tileLayer.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.tileLayer.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.tileLayer.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.tileLayer.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart(event: EventTouch) {
        if (this.isSwapping) return;
        
        this.touchStartPos = event.getUILocation();
        const tile = this.getTileAtPosition(this.touchStartPos);
        if (tile) {
            this.selectedTile = tile;
            this.exchangeTile = null;
        }
    }

    private onTouchMove(event: EventTouch) {
        if (!this.selectedTile || this.isSwapping) return;
        
        const currentTime = Date.now() / 1000;
        if (currentTime - this.lastSwapTime < this.SWAP_COOLDOWN) return;

        const touchPos = event.getUILocation();
        if (Vec2.distance(touchPos, this.touchStartPos) < this.MOVE_THRESHOLD) return;
        
        const tile = this.getTileAtPosition(touchPos);
        if (tile && tile !== this.selectedTile) {
            if(this.exchangeTile && this.exchangeTile != tile) return;
            if (this.isAdjacent(this.selectedTile, tile)) {
                this.swapTiles(this.selectedTile, tile);
                this.lastSwapTime = currentTime;
                this.touchStartPos = touchPos;
            }
        }
    }

    private onTouchEnd(event: EventTouch) {
        this.selectedTile = null;
        this.exchangeTile = null;
    }
    private getTileAtPosition(pos: Vec2): Tile {
        const touchPos = new Vec3(pos.x, pos.y, 0);
        const location = this.node.getComponent(UITransform).convertToNodeSpaceAR(touchPos);
        
        // 修正行列计算逻辑
        const col = Math.floor((location.x + (this.columns * this.tileSize) / 2) / this.tileSize);
        const row = Math.floor(((this.rows * this.tileSize) / 2 - location.y) / this.tileSize);

        if (row >= 0 && row < this.rows && col >= 0 && col < this.columns) {
            return this.tileNodes[row][col].getComponent(Tile);
        }
        return null;
    }
    private isAdjacent(tile1: Tile, tile2: Tile): boolean {
        const rowDiff = Math.abs(tile1.row - tile2.row);
        const colDiff = Math.abs(tile1.col - tile2.col);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }
    private async swapTiles(tile1: Tile, tile2: Tile) {
        this.isSwapping = true;

        // 保存原始位置
        const row1 = tile1.row;
        const col1 = tile1.col;
        const row2 = tile2.row;
        const col2 = tile2.col;

        // 交换数据层
        const tempType = this.board[row1][col1];
        this.board[row1][col1] = this.board[row2][col2];
        this.board[row2][col2] = tempType;

        // 更新位置信息
        tile1.init(this.board[row1][col1], row1, col1);
        tile2.init(this.board[row2][col2], row2, col2);

        // 更新选中的tile为当前触点位置的tile
        this.selectedTile = tile2;
        this.exchangeTile = tile1;

        // 检查是否有可消除的组合
        const matches = this.findMatches();
        if (matches.length > 0) {
            // 有可消除的组合
            await this.eliminateMatches(matches);
            await this.dropTiles();
            await this.fillEmptySpaces();
        } else {
            // 没有可消除的组合，交换回来
            const tempType = this.board[row1][col1];
            this.board[row1][col1] = this.board[row2][col2];
            this.board[row2][col2] = tempType;
            tile1.init(this.board[row1][col1], row1, col1);
            tile2.init(this.board[row2][col2], row2, col2);
        }

        this.isSwapping = false;
    }

    private findMatches(): { row: number, col: number }[] {
        const matches: { row: number, col: number }[] = [];
        const rowsToCheck = new Set<number>();
        const colsToCheck = new Set<number>();

        // 只检查交换的元素所在的行和列
        if (this.selectedTile && this.exchangeTile) {
            rowsToCheck.add(this.selectedTile.row);
            rowsToCheck.add(this.exchangeTile.row);
            colsToCheck.add(this.selectedTile.col);
            colsToCheck.add(this.exchangeTile.col);
        }

        // 检查指定行的水平匹配
        for (const row of rowsToCheck) {
            let count = 1;
            for (let col = 1; col < this.columns; col++) {
                if (this.board[row][col] === this.board[row][col - 1]) {
                    count++;
                } else {
                    if (count >= 3) {
                        for (let i = 0; i < count; i++) {
                            matches.push({ row, col: col - 1 - i });
                        }
                    }
                    count = 1;
                }
            }
            if (count >= 3) {
                for (let i = 0; i < count; i++) {
                    matches.push({ row, col: this.columns - 1 - i });
                }
            }
        }

        // 检查指定列的垂直匹配
        for (const col of colsToCheck) {
            let count = 1;
            for (let row = 1; row < this.rows; row++) {
                if (this.board[row][col] === this.board[row - 1][col]) {
                    count++;
                } else {
                    if (count >= 3) {
                        for (let i = 0; i < count; i++) {
                            matches.push({ row: row - 1 - i, col });
                        }
                    }
                    count = 1;
                }
            }
            if (count >= 3) {
                for (let i = 0; i < count; i++) {
                    matches.push({ row: this.rows - 1 - i, col });
                }
            }
        }

        return matches;
    }

    private async fillEmptySpaces() {
        for (let col = 0; col < this.columns; col++) {
            for (let row = 0; row < this.rows; row++) {
                if (this.board[row][col] === -1) {
                    this.board[row][col] = Math.floor(Math.random() * this.tileTypes);
                    this.tileNodes[row][col].active = true;
                    this.tileNodes[row][col].getComponent(Tile).init(this.board[row][col], row, col);
                }
            }
        }
        
        // 在填充新元素后，仍然需要检查整个棋盘的匹配
        const newMatches = this.findMatchesForEntireBoard();
        if (newMatches.length > 0) {
            await this.eliminateMatches(newMatches);
            await this.dropTiles();
            await this.fillEmptySpaces();
        }
    }

    private findMatchesForEntireBoard(): { row: number, col: number }[] {
        const matches: { row: number, col: number }[] = [];
        
        // 检查水平匹配
        for (let row = 0; row < this.rows; row++) {
            let count = 1;
            for (let col = 1; col < this.columns; col++) {
                if (this.board[row][col] === this.board[row][col - 1]) {
                    count++;
                } else {
                    if (count >= 3) {
                        for (let i = 0; i < count; i++) {
                            matches.push({ row, col: col - 1 - i });
                        }
                    }
                    count = 1;
                }
            }
            if (count >= 3) {
                for (let i = 0; i < count; i++) {
                    matches.push({ row, col: this.columns - 1 - i });
                }
            }
        }

        // 检查垂直匹配
        for (let col = 0; col < this.columns; col++) {
            let count = 1;
            for (let row = 1; row < this.rows; row++) {
                if (this.board[row][col] === this.board[row - 1][col]) {
                    count++;
                } else {
                    if (count >= 3) {
                        for (let i = 0; i < count; i++) {
                            matches.push({ row: row - 1 - i, col });
                        }
                    }
                    count = 1;
                }
            }
            if (count >= 3) {
                for (let i = 0; i < count; i++) {
                    matches.push({ row: this.rows - 1 - i, col });
                }
            }
        }

        return matches;
    }
    private async eliminateMatches(matches: { row: number, col: number }[]) {
        // 将匹配的位置标记为-1
        for (const match of matches) {
            this.board[match.row][match.col] = -1;
            // 可以在这里添加消除动画效果
            this.tileNodes[match.row][match.col].active = false;
        }
        
        // 等待动画完成
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    private async dropTiles() {
        let dropped = false;
        do {
            dropped = false;
            for (let col = 0; col < this.columns; col++) {
                // 处理顶部行的特殊情况
                if (this.board[0][col] === -1) {
                    this.board[0][col] = Math.floor(Math.random() * this.tileTypes);
                    this.tileNodes[0][col].active = true;
                    this.tileNodes[0][col].getComponent(Tile).init(this.board[0][col], 0, col);
                    dropped = true;
                }

                // 处理其他行的下落
                for (let row = this.rows - 1; row > 0; row--) {
                    if (this.board[row][col] === -1) {
                        this.board[row][col] = this.board[row - 1][col];
                        this.board[row - 1][col] = -1;
                        
                        this.tileNodes[row][col].active = true;
                        this.tileNodes[row][col].getComponent(Tile).init(this.board[row][col], row, col);
                        this.tileNodes[row - 1][col].active = false;
                        
                        dropped = true;
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        } while (dropped);
    }
}


