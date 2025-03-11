import { _decorator, Component, Node, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Tile')
export class Tile extends Component {
    @property({ type: SpriteFrame })
    private spfs: SpriteFrame[] = [];
    
    public row: number = -1;
    public col: number = -1;
    public type: number = -1;

    init(type: number, row: number, col: number) {
        this.type = type;
        this.row = row;
        this.col = col;
        this.node.getComponentInChildren(Sprite).spriteFrame = this.spfs[type - 1];
    }
    
    moveTo(pos: Vec3): Promise<void> {
        return new Promise((resolve) => {
            tween(this.node)
            .to(0.2, { position: pos })
            .call(() => resolve())
            .start();
        })
    }
}


