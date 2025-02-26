import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Tile')
export class Tile extends Component {
    @property({
        type: [SpriteFrame],
        tooltip: '不同类型元素对应的贴图'
    })
    public typeSprites: SpriteFrame[] = [];

    private _type: number = 0;
    private _row: number = 0;
    private _col: number = 0;
    private _sprite: Sprite = null;

    get type() { return this._type; }
    set type(val: number) { this._type = val };

    get row() { return this._row; }
    set row(val: number) { this._row = val };

    get col() { return this._col; }
    set col(val: number) { this._col = val };

    onLoad() {
        this._sprite = this.getComponentInChildren(Sprite);
    }

    /**
     * 初始化元素
     * @param type 元素类型
     * @param row 所在行
     * @param col 所在列
     */
    public init(type: number, row: number, col: number) {
        this._type = type;
        this._row = row;
        this._col = col;
        
        // 更新显示
        this._sprite.spriteFrame = this.typeSprites[type];
    }

    /**
     * 更新元素类型
     * @param type 新的元素类型
     */
    public updateType(type: number) {
        this._type = type;
        this._sprite.spriteFrame = this.typeSprites[type];
    }
}


