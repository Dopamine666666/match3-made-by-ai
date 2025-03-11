import { _decorator, Component, Node, Prefab, UITransform, instantiate, Vec2, EventTouch, Vec3, tween, UIOpacity } from 'cc';
import { Tile } from './Tile';
const { ccclass, property } = _decorator;

@ccclass('Game')
export class Game extends Component {
    @property({ type: Node })
    public boardLayer: Node = null;

    @property({ type: Node })
    public tileLayer: Node = null;

    @property({ type: Node })
    private effectLayer: Node = null;

    @property({
        type: Prefab,
        tooltip: '元素预制体'
    })
    tilePrefab: Prefab = null;

    @property({
        tooltip: '游戏区域行数'
    })
    rows: number = 8;

    @property({
        tooltip: '游戏区域列数'
    })
    columns: number = 8;

    @property({
        tooltip: '元素类型数量'
    })
    typeCount: number = 5;

    @property({
        tooltip: '元素大小'
    })
    tileSize: number = 80;

    // 存储所有元素节点的二维数组
    private tileNodes: Tile[][] = [];
    // 记录选中的元素
    private selectedTile: Tile = null;
    
    onLoad() {
        this.initGame();
        this.initTouchEvents();
    }

    private initGame() {
        // 初始化二维数组
        this.tileNodes = Array(this.rows).fill(null)
            .map(() => Array(this.columns).fill(null));
        
        // 创建所有元素
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
                this.createTileAt(row, col);
            }
        }
    }

    private createTileAt(row: number, col: number) {
        // 创建元素节点
        const tileNode = instantiate(this.tilePrefab);
        tileNode.parent = this.tileLayer;
        
        // 设置位置
        const pos = this.getTilePosition(row, col);
        tileNode.setPosition(pos);
        
        // 初始化元素属性，确保不会形成三连
        let type: number;
        do {
            type = Math.floor(Math.random() * this.typeCount) + 1;
        } while (this.wouldCauseMatch(row, col, type));
        
        const tile = tileNode.getComponent(Tile);
        tile.init(type, row, col);
        
        // 存储引用
        this.tileNodes[row][col] = tile;
    }

    private getTilePosition(row: number, col: number): Vec3 {
        return new Vec3(
            (col - this.columns/2 + 0.5) * this.tileSize,
            ((this.rows - row - 1) - this.rows/2 + 0.5) * this.tileSize,
            1
        );
    }

    private initTouchEvents() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }

    private onTouchStart(event: EventTouch) {
        // 获取触摸位置
        const touchPos = event.getUILocation();
        const nodePos = this.node.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        
        // 计算点击的元素位置
        const col = Math.floor((nodePos.x + this.columns * this.tileSize / 2) / this.tileSize);
        const row = Math.floor((this.rows * this.tileSize / 2 - nodePos.y) / this.tileSize);
        
        // 检查位置是否有效
        if (row >= 0 && row < this.rows && col >= 0 && col < this.columns) {
            this.onTileClick(this.tileNodes[row][col]);
        }
    }

    private onTileClick(tile: Tile) {
        console.log(tile.type);
        if(tile.type === 0) return;
        if (!this.selectedTile) {
            // 第一次选中
            this.selectedTile = tile;
            // TODO: 添加选中效果
        } else {
            // 第二次选中，尝试交换
            if (this.isAdjacent(this.selectedTile, tile)) {
                this.swapTiles(this.selectedTile, tile);
            }
            this.selectedTile = null;
        }
    }

    private isAdjacent(tile1: Tile, tile2: Tile): boolean {
        const rowDiff = Math.abs(tile1.row - tile2.row);
        const colDiff = Math.abs(tile1.col - tile2.col);
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
    }

    private wouldCauseMatch(row: number, col: number, type: number): boolean {
        // 检查水平方向
        if (col >= 2) {
            const tile1 = this.tileNodes[row][col - 2];
            const tile2 = this.tileNodes[row][col - 1];
            if (tile1?.type === type && tile2?.type === type) {
                return true;
            }
        }
        
        // 检查垂直方向
        if (row >= 2) {
            const tile1 = this.tileNodes[row - 2][col];
            const tile2 = this.tileNodes[row - 1][col];
            if (tile1?.type === type && tile2?.type === type) {
                return true;
            }
        }
        
        return false;
    }

    private async checkMatches(tile1: Tile, tile2: Tile): Promise<Tile[]> {
        const matches: Set<Tile> = new Set();
        const tilesToCheck = tile1 == tile2 ? [tile1] : [tile1, tile2];
        
        for (const tile of tilesToCheck) {
            // 检查水平方向
            let startCol = tile.col;
            
            // 向左扩展
            while (startCol > 0 && this.tileNodes[tile.row][startCol - 1]?.type === tile.type) {
                startCol--;
            }
            
            // 计算连续相同类型的数量
            let count = 0;
            let col = startCol;
            while (col < this.columns && this.tileNodes[tile.row][col]?.type === tile.type) {
                count++;
                col++;
            }
            
            // 如果连续数量大于等于3，添加到匹配集合
            if (count >= 3) {
                for (let i = startCol; i < startCol + count; i++) {
                    matches.add(this.tileNodes[tile.row][i]);
                }
            }
            
            // 检查垂直方向
            let startRow = tile.row;
            
            // 向上扩展
            while (startRow > 0 && this.tileNodes[startRow - 1][tile.col]?.type === tile.type) {
                startRow--;
            }
            
            // 计算连续相同类型的数量
            count = 0;
            let row = startRow;
            while (row < this.rows && this.tileNodes[row][tile.col]?.type === tile.type) {
                count++;
                row++;
            }
            
            // 如果连续数量大于等于3，添加到匹配集合
            if (count >= 3) {
                for (let i = startRow; i < startRow + count; i++) {
                    matches.add(this.tileNodes[i][tile.col]);
                }
            }
        }
        
        return Array.from(matches);
    }

    private async eliminateMatches(matches: Tile[]) {
        if (matches.length === 0) return;

        // 播放消除动画
        const promises = matches.map(tile => {
            return new Promise<void>(resolve => {
                tween(tile.node)
                    .to(0.2, { scale: new Vec3(0.4, 0.4, 1) })
                    .call(() => {
                        tile.type = 0;
                        tile.node.active = false;
                        tile.node.setScale(1, 1, 1);
                        resolve();
                    })
                    .start();
            });
        });

        await Promise.all(promises);
        await this.handleFalling();
    }

    private async swapTiles(tile1: Tile, tile2: Tile) {
        // 交换位置
        const pos1 = this.getTilePosition(tile1.row, tile1.col);
        const pos2 = this.getTilePosition(tile2.row, tile2.col);
        
        // 更新数组引用
        this.tileNodes[tile1.row][tile1.col] = tile2;
        this.tileNodes[tile2.row][tile2.col] = tile1;
        
        // 更新元素属性
        const tempRow = tile1.row;
        const tempCol = tile1.col;
        tile1.row = tile2.row;
        tile1.col = tile2.col;
        tile2.row = tempRow;
        tile2.col = tempCol;
        
        // 执行移动动画
        await Promise.all([
            tile1.moveTo(pos2),
            tile2.moveTo(pos1)
        ]);
        
        // 检查是否可以消除
        const matches = await this.checkMatches(tile1, tile2);
        if (matches.length > 0) {
            await this.eliminateMatches(matches);
        } else {
            // 如果没有可消除的，交换回来
            this.tileNodes[tile1.row][tile1.col] = tile2;
            this.tileNodes[tile2.row][tile2.col] = tile1;
            
            tile2.row = tile1.row;
            tile2.col = tile1.col;
            tile1.row = tempRow;
            tile1.col = tempCol;
            
            await Promise.all([
                tile1.moveTo(pos1),
                tile2.moveTo(pos2)
            ]);
        }
    }

    private async handleFalling() {
        let hasChanges = false;
        const columnPromises: Promise<void>[] = [];
        for(let col = 0; col < this.columns; col++) {
            // const columnPromises: Promise<void>[] = [];

            for(let row = this.rows - 1; row >= 0; row--) {
                if(this.tileNodes[row][col].type == 0) {
                    let sourceRow = row - 1;
                    while(sourceRow >= 0) {
                        if(this.tileNodes[sourceRow][col].type != 0) {
                            const targetTile = this.tileNodes[row][col];
                            const sourceTile = this.tileNodes[sourceRow][col];

                            this.tileNodes[row][col] = sourceTile;
                            this.tileNodes[sourceRow][col] = targetTile;

                            sourceTile.row = row;
                            targetTile.row = sourceRow;

                            const targetPos = this.getTilePosition(row, col);
                            columnPromises.push(sourceTile.moveTo(targetPos));
                            hasChanges = true;
                            break;
                        }
                        sourceRow--;
                    }

                    if(sourceRow < 0) {
                        const tile = this.tileNodes[row][col];
                        const startPos = this.getTilePosition(-1, col);
                        tile.node.setPosition(startPos);
                        tile.node.active = true;

                        let newType: number;
                        do {
                            newType = Math.floor(Math.random() * this.typeCount) + 1;
                        } 
                        while(this.wouldCauseMatch(row, col, newType));

                        tile.type = newType;
                        tile.init(newType, row, col);

                        const targetPos = this.getTilePosition(row, col);
                        columnPromises.push(tile.moveTo(targetPos));
                        hasChanges = true;
                    }
                }
            }

            // await Promise.all(columnPromises);
        }

        await Promise.all(columnPromises);

        if(hasChanges) {
            const allMatches: Tile[] = [];

            for(let row = 0; row < this.rows; row++) {
                for(let col = 0; col < this.columns; col++) {
                    const matches = await this.checkMatches(this.tileNodes[row][col], this.tileNodes[row][col]);
                    matches.forEach(tile => {
                        if(!allMatches.includes(tile)) {
                            allMatches.push(tile);
                        }
                    })
                }
            }

            if(allMatches.length > 0) {
                await this.eliminateMatches(allMatches);
            }
        }
    }
}


