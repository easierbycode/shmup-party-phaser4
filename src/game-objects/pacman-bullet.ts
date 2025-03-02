
import { Bullet, Weapon } from "../weapons/weapon-plugin";
import { KillType } from "../weapons/weapon-plugin/consts";
import config from '../config';


class _Bullet extends Bullet {

      damagePoints = 50;

      constructor( scene, x, y, key = 'pacman-bullet', frame ) {
            super( scene, x, y, key, frame );
            this.body.setCircle( this.width / 2 );
            this.setData( 'killType', KillType.KILL_WORLD_BOUNDS );
      }

      damage( bullet: _Bullet, entity ) {
            let {x, y}              = entity;
            let {height, width}     = entity.body;
            let {rotation}          = this;
            let {impacts}           = this.getData( 'bulletManager' );
            let impact              = impacts.get( x, y ).setVisible( true ).setActive( true ).setRotation( rotation ).setDepth( 2 );
            if ( Math.min( height, width ) == width ) {
                  impact.displayWidth     = width;
                  impact.scaleY           = impact.scaleX;
            } else {
                  impact.displayHeight    = height;
                  impact.scaleX           = impact.scaleY;
            }
            impact.on(
                'animationcomplete-default',
                () => impacts.killAndHide( impact )
            );
            impact.play( 'default' );
      }

}


class BulletImpact extends Phaser.GameObjects.Sprite {

      constructor(
          scene: Phaser.Scene, 
          x: number, 
          y: number, 
          key: string = 'pac-ghost'
      ) {
          super( scene, x, y, key );
  
          this.anims.create({
              key: 'default',
              frames: this.anims.generateFrameNames( 'pac-ghost' ),
              frameRate: 45
          });

          this.setAlpha( 0.75 );
      }
  
}


export default class PacmanBullet extends Weapon {

    constructor(
        player: Phaser.Physics.Arcade.Sprite,
        scene: Phaser.Scene,
        bulletLimit: number = 10,
        key = '',
        frame = '',
        group?: Phaser.GameObjects.Group
      ) {
            super( scene, bulletLimit, key, frame );

            this.impacts      = scene.add.group({ classType: BulletImpact });

            this.addBulletAnimation(
                  'pacman-bullet.chomp',
                  scene.anims.generateFrameNumbers( 'pacman-bullet' ),
                  12,
                  -1
            )
            
            this.bulletClass  = _Bullet;
            this.bulletSpeed  = 600;
            this.fireRate     = 600;
            this.debugPhysics = config.physics[config.physics.default].debug;

            // `this.bullets` exists only after createBullets()
            this.createBullets();
            // createBullets does not create bulletClass instances, so
            // we remove and recreate with correct classType
            this.bullets.clear();

            this.bullets.createMultipleCallback = ( items ) => {
                  items.forEach( item => {
                        item.setData( 'bulletManager', this );
                  });
            }

            this.bullets.createMultiple({
                  classType: _Bullet,
                  key: 'pacman-bullet',
                  repeat: this.bullets.maxSize-1,
                  active: false,
                  visible: false
            });

            this.trackSprite( player, 0, 0, true );
      }
}