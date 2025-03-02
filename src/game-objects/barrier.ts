
import { Bullet, Weapon } from "../weapons/weapon-plugin";
import { KillType } from "../weapons/weapon-plugin/consts";
import { BULLET_KILL, WEAPON_FIRE } from "../weapons/weapon-plugin/events";
import config from '../config';
const SPRITE_KEY = 'barrier';


class _Bullet extends Bullet {

      damagePoints = 50;

      constructor( scene, x, y, key = SPRITE_KEY, frame ) {
            super( scene, x, y, key, frame );
            this.setData( 'killType', KillType.KILL_LIFESPAN );
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

      kill() { super.kill() }

      update() {
          super.update();
          let {x, y} = this;
          if ( x !== 0 && !this.getData( 'player' ).inputEnabled ) {
            this.getData( 'player' ).setPosition( x, y );
          }
      }

}


class BulletImpact extends Phaser.GameObjects.Sprite {

      constructor(
          scene: Phaser.Scene, 
          x: number, 
          y: number, 
          key: string = 'ion-bullet-impact'
      ) {
          super( scene, x, y, key );
  
          this.anims.create({
              key: 'default',
              frames: this.anims.generateFrameNames( 'ion-bullet-impact' ),
              frameRate: 30
          });

          this.setTint( 0xA0F0F0 );
      }
  
}


export default class Barrier extends Weapon {

    constructor(
        player: Phaser.Physics.Arcade.Sprite,
        scene: Phaser.Scene,
        bulletLimit: number = 1,
        key = '',
        frame = '',
        group?: Phaser.GameObjects.Group
      ) {
            super( scene, bulletLimit, key, frame );

            this.impacts = scene.add.group({ classType: BulletImpact });

            this.addBulletAnimation(
                  `${SPRITE_KEY}.default`,
                  scene.anims.generateFrameNumbers( SPRITE_KEY ),
                  60,
                  -1
            )
            
            this.bulletClass        = _Bullet;
            this.bulletAngleOffset  = 180;
            this.bulletLifespan     = 350;
            this.bulletKillType     = KillType.KILL_LIFESPAN;
            this.bulletSpeed        = 900;
            this.fireRate           = 1500;
            this.debugPhysics       = config.physics[config.physics.default].debug;

            // `this.bullets` exists only after createBullets()
            this.createBullets();
            // createBullets does not create bulletClass instances, so
            // we remove and recreate with correct classType
            this.bullets.clear();

            this.bullets.createMultipleCallback = ( items ) => {
                  items.forEach( item => {
                        item.setData( 'bulletManager', this );
                        item.setData( 'player', player );
                        item.setOrigin( 0.25, 0.5 );
                        item.body.setSize( 41, 41 );
                        item.body.setOffset( 1, 1 );
                        item.setDepth( 2 );
                  });
            }

            this.bullets.createMultiple({
                  classType: _Bullet,
                  key: SPRITE_KEY,
                  repeat: this.bullets.maxSize-1,
                  active: false,
                  visible: false
            });

            this.trackSprite( player, 0, 0, true );

            this.on(WEAPON_FIRE, ( bullet: Bullet, weapon: Weapon ) => {
                bullet.getData( 'player' ).inputEnabled = false;
            });

            this.on(BULLET_KILL, ( bullet: Bullet, weapon: Weapon ) => {
                bullet.getData( 'player' ).inputEnabled = true;
            });
      }

}