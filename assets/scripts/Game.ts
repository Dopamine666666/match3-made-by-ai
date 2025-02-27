import { _decorator, Component, Node, Prefab, UITransform, instantiate, Vec2, EventTouch, Vec3, color } from 'cc';
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
    private tileNodes: Tile[][] = [];
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

        this.initGame();
        this.setupTouchEvents();
    }

    onDestroy() {
        // 移除所有触摸事件监听
        this.tileLayer.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.tileLayer.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.tileLayer.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.tileLayer.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private initGame() {
        for (let i = 0; i < this.rows; i++) {
            this.board[i] = [];
            this.tileNodes[i] = [];
            for (let j = 0; j < this.columns; j++) {
                const type = Math.floor(Math.random() * this.tileTypes);
                const node = instantiate(this.tilePrefab);
                node.parent = this.tileLayer;
                // 修改 y 坐标的计算，使其与行号相反
                node.position.set(
                    (j - this.columns/2 + 0.5) * this.tileSize,
                    ((this.rows - i - 1) - this.rows/2 + 0.5) * this.tileSize,
                    0
                );
                this.board[i].push(type);
                this.tileNodes[i].push(node.getComponent(Tile));
                node.getComponent(Tile).init(type, i, j);
            }
        }
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
        if (tile && tile.type != -1) {
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
        if (tile && tile !== this.selectedTile && tile.type != -1) {
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

        // 更新选中的tile为当前触点位置的tile
        this.selectedTile = tile2;
        this.exchangeTile = tile1;

        [this.board[tile1.row][tile1.col], this.board[tile2.row][tile2.col]] = [this.board[tile2.row][tile2.col], this.board[tile1.row][tile1.col]]

        // 检查是否有可消除的组合
        const matches = this.findMatches();
        if (matches.length > 0) {
            // 有可消除的组合
            console.log(tile1.type, tile2.type);
            console.log(JSON.stringify(matches.map(m => this.board[m.row][m.col])));
            tile1.updateType(this.board[tile1.row][tile1.col]);
            tile2.updateType(this.board[tile2.row][tile2.col]);
            await this.eliminateMatches(matches);
            // await this.dropTiles();
            // await this.fillEmptySpaces();
        } else {
            // 没有可消除的组合，交换回来
            [this.board[tile1.row][tile1.col], this.board[tile2.row][tile2.col]] = [this.board[tile2.row][tile2.col], this.board[tile1.row][tile1.col]];
        }

        this.isSwapping = false;
    }

    private findMatches(): { row: number, col: number }[] {
//         if(this.selectedTile.type == this.exchangeTile.type) {
//             // 待匹配的行列

//         }
//         else  {
// // 
//         }
        // 待匹配tile
        const preMatchArr: { row: number, col: number }[] = [];
        // 已匹配且可消除tile
        const hadMatchedArr: { row: number, col: number }[] = [];

        // 记录type1类型对col进行过的row方向上的匹配
        const type1matchedRowsHash: Map<number, number[]> = new Map();
        // 记录type1类型对row进行过的col方向上的匹配
        const type1matchedColsHash: Map<number, number[]> = new Map();
        // 记录type2类型对col进行过的row方向上的匹配
        const type2matchedRowsHash: Map<number, number[]> = new Map();
        // 记录type2类型对row进行过的col方向上的匹配
        const type2matchedColsHash: Map<number, number[]> = new Map();
        [this.selectedTile, this.exchangeTile].forEach(t => preMatchArr.push({ row: t.row, col: t.col }));

        while (preMatchArr.length > 0) {
            const tile = preMatchArr.shift();
            let matchedColsHash = this.board[tile.row][tile.col] == this.exchangeTile.type ? type1matchedColsHash : type2matchedColsHash;
            let matchedRowsHash = this.board[tile.row][tile.col] == this.exchangeTile.type ? type1matchedRowsHash : type2matchedRowsHash;
            const cols = matchedColsHash.has(tile.row) && matchedColsHash.get(tile.row).includes(tile.col) ? null : this.matchCol(tile, matchedColsHash);
            const rows = matchedRowsHash.has(tile.col) && matchedRowsHash.get(tile.col).includes(tile.row) ? null : this.matchRow(tile, matchedRowsHash);
            if (cols || rows) {
                hadMatchedArr.push({ row: tile.row, col: tile.col });
                cols && cols.forEach(c => {
                    preMatchArr.push(c);
                    hadMatchedArr.push({ row: c.row, col: c.col });
                });
                rows && rows.forEach(r => {
                    preMatchArr.push(r);
                    hadMatchedArr.push({ row: r.row, col: r.col });
                });
            }
        }
        return hadMatchedArr;
    }
    // 对tile所在col，进行row方向上的匹配
    private matchRow(tile: { row: number, col: number }, matchedRowsHash: Map<number, number[]>) {
        const tileRow = tile.row;
        const tileCol = tile.col;
        const tileType = this.board[tileRow][tileCol];
        
        let upCount = 0;
        let temp = tile.row;
        while(temp > 0 && this.board[temp - 1][tileCol] == tileType) {
            upCount++;
            temp--;
        }
        let downCount = 0;
        temp = tile.row;
        while(temp < this.rows - 1 && this.board[temp + 1][tileCol] == tileType) {
            downCount++;
            temp++;
        }
        if(upCount + downCount + 1 < 3) return;
        const matches: { row: number, col: number }[] = [];
        while(upCount > 0) {
            const newRow = tileRow - upCount--;
            matches.push({ row: newRow, col: tileCol });
        }
        while(downCount > 0) {
            const newRow = tileRow + downCount--;
            matches.push({ row: newRow, col: tileCol });
        }
        matches.forEach(m => {
            if(matchedRowsHash.has(m.col) && !matchedRowsHash.get(m.col).includes(m.row)) {
                matchedRowsHash.get(m.col).push(m.row);
            }
            else {
                matchedRowsHash.set(m.col, [m.row]);
            }
        })
        return matches;
    }
    // 对tile所在row，进行col方向上的匹配
    private matchCol(tile: { row: number, col: number }, matchedColsHash: Map<number, number[]>) {
        const tileRow = tile.row;
        const tileCol = tile.col;
        const tileType = this.board[tileRow][tileCol];

        let leftCount = 0;
        let temp = tile.col;
        while(temp > 0 && this.board[tileRow][temp - 1] == tileType) {
            leftCount++;
            temp--;
        }
        let rightCount = 0;
        temp = tile.col;
        while(temp < this.columns - 1 && this.board[tileRow][temp + 1] == tileType) {
            rightCount++;
            temp++;
        }
        
        if(leftCount + rightCount + 1 < 3) return;
        const matches: { row: number, col: number }[] = [];
        while(leftCount > 0) {
            const newCol = tileCol - leftCount--;
            matches.push({ row: tileRow, col: newCol });
        }
        while(rightCount > 0) {
            const newCol = tileCol + rightCount--;
            matches.push({ row: tileRow, col: newCol });
        }
        matches.forEach(m => {
            if(matchedColsHash.has(m.row) && !matchedColsHash.get(m.row).includes(m.col)) {
                matchedColsHash.get(m.row).push(m.col);
            }
            else {
                matchedColsHash.set(m.row, [m.col]);
            }
        })
        return matches;
    }

    // private async fillEmptySpaces() {
    //     for (let col = 0; col < this.columns; col++) {
    //         for (let row = 0; row < this.rows; row++) {
    //             if (this.tileNodes[row][col].type === -1) {
    //                 this.tileNodes[row][col].init(Math.floor(Math.random() * this.tileTypes), row, col);
    //                 this.tileNodes[row][col].node.active = true;
    //             }
    //         }
    //     }
        
    //     // 在填充新元素后，仍然需要检查整个棋盘的匹配
    //     const newMatches = this.findMatchesForEntireBoard();
    //     if (newMatches.length > 0) {
    //         await this.eliminateMatches(newMatches);
    //         await this.dropTiles();
    //         await this.fillEmptySpaces();
    //     }
    // }

    // private findMatchesForEntireBoard(): { row: number, col: number }[] {
    //     const matches: { row: number, col: number }[] = [];
        
    //     // 检查水平匹配
    //     for (let row = 0; row < this.rows; row++) {
    //         let count = 1;
    //         for (let col = 1; col < this.columns; col++) {
    //             if (this.tileNodes[row][col].type === this.tileNodes[row][col - 1].type) {
    //                 count++;
    //             } else {
    //                 if (count >= 3) {
    //                     for (let i = 0; i < count; i++) {
    //                         matches.push({ row, col: col - 1 - i });
    //                     }
    //                 }
    //                 count = 1;
    //             }
    //         }
    //         if (count >= 3) {
    //             for (let i = 0; i < count; i++) {
    //                 matches.push({ row, col: this.columns - 1 - i });
    //             }
    //         }
    //     }

    //     // 检查垂直匹配
    //     for (let col = 0; col < this.columns; col++) {
    //         let count = 1;
    //         for (let row = 1; row < this.rows; row++) {
    //             if (this.tileNodes[row][col].type === this.tileNodes[row - 1][col].type) {
    //                 count++;
    //             } else {
    //                 if (count >= 3) {
    //                     for (let i = 0; i < count; i++) {
    //                         matches.push({ row: row - 1 - i, col });
    //                     }
    //                 }
    //                 count = 1;
    //             }
    //         }
    //         if (count >= 3) {
    //             for (let i = 0; i < count; i++) {
    //                 matches.push({ row: this.rows - 1 - i, col });
    //             }
    //         }
    //     }

    //     return matches;
    // }
    private async eliminateMatches(matches: { row: number, col: number }[]) {
        // 将匹配的位置标记为-1
        for (const match of matches) {
            this.board[match.row][match.col] = -1;
            this.tileNodes[match.row][match.col].type = -1;
            // 可以在这里添加消除动画效果
            this.tileNodes[match.row][match.col].node.active = false;
        }
        
        // 等待动画完成
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    // private async dropTiles() {
    //     let dropped = false;
    //     do {
    //         dropped = false;
    //         for (let col = 0; col < this.columns; col++) {
    //             // 处理顶部行的特殊情况
    //             if (this.tileNodes[0][col].type === -1) {
    //                 this.tileNodes[0][col].init(Math.floor(Math.random() * this.tileTypes), 0, col);
    //                 this.tileNodes[0][col].node.active = true;
    //                 dropped = true;
    //             }

    //             // 处理其他行的下落
    //             for (let row = this.rows - 1; row > 0; row--) {
    //                 const tile = this.tileNodes[row][col];
    //                 if (tile.type === -1) {
    //                     tile.init(this.tileNodes[row - 1][col].type, row, col);
    //                     this.tileNodes[row - 1][col].type = -1;
                        
    //                     tile.node.active = true;
    //                     this.tileNodes[row - 1][col].node.active = false;
                        
    //                     dropped = true;
    //                 }
    //             }
    //         }
    //         await new Promise(resolve => setTimeout(resolve, 100));
    //     } while (dropped);
    // }
}


