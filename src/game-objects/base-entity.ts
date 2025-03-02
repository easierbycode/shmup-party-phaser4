
import BloodSplatter from "./blood-splatter";


export default class BaseEntity extends Phaser.Physics.Arcade.Sprite {
    
    _speed      = 1;
    baseSpeed   = 50;
    health;
    maxHealth   = 1;
    
    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        key: string
    ) {
        super( scene, x, y, key );

        // scene.physics.world.enableBody( this );
        scene.add.existing( this );
        scene.physics.add.existing( this );
    }

    get speed() {
        return this.baseSpeed * this._speed;
    }

    set speed( value ) {
        this.baseSpeed = value;
    }

    damage( entity: BaseEntity, bullet ) {
        let damagePoints = bullet.damagePoints || 1;

        this.health -= damagePoints;

        if ( this.health <= 0 )  this.kill();
    }

    kill() {
        let {rotation, x, y} = this;
        let bloodSplatters: Phaser.GameObjects.Group = this.scene.bloodSplatters;
        let bloodSplatter = bloodSplatters.get( x, y ).setVisible( true ).setActive( true ).setRotation( rotation );
        bloodSplatter.on(
            'animationcomplete-default',
            () => bloodSplatter.setActive(!1),bloodSplatter.setVisible(!1)
        );
        bloodSplatter.play( 'default' );
        // this.setActive(!1),this.setVisible(!1);
    }

    reset() {
        this
            .setActive( true )
            .setDepth( 1 )
            .setVisible( true )
            .health = this.maxHealth;

        return this;
    }

}