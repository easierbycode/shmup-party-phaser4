
export default class BloodSplatter extends Phaser.GameObjects.Sprite {

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        key: string = 'blood-splat'
    ) {
        super( scene, x, y, key )

        scene.add.existing( this );
        // scene.physics.world.enableBody( this );

        this.anims.create({
            key: 'default',
            frames: this.anims.generateFrameNames('blood-splat'),
            frameRate: 30
        })

        // this.play( 'default' )
    }

}