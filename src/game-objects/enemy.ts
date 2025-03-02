
import BaseEntity from "./base-entity";


export default class Enemy extends BaseEntity {
    constructor(scene, x, y, key, frame) {
        super(scene, x, y, key, frame);
        this.targetPlayer = null;
        this.moveSpeed = 100;
        this.experienceValue = 10;
    }
    
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        
        // Find closest player if we don't have a target
        if (!this.targetPlayer || !this.targetPlayer.active) {
            this.findClosestPlayer();
        }
        
        // Move toward target player
        if (this.targetPlayer && this.targetPlayer.active) {
            this.scene.physics.moveToObject(this, this.targetPlayer, this.moveSpeed);
            
            // Rotate toward player
            const angle = Phaser.Math.Angle.Between(
                this.x, this.y,
                this.targetPlayer.x, this.targetPlayer.y
            );
            this.rotation = angle;
        } else {
            this.body.velocity.x = 0;
            this.body.velocity.y = 0;
        }
    }
    
    findClosestPlayer() {
        const players = this.scene.players.getChildren();
        if (players.length === 0) return;
        
        let closestPlayer = null;
        let closestDistance = Infinity;
        
        for (const player of players) {
            if (!player.active) continue;
            
            const distance = Phaser.Math.Distance.Between(
                this.x, this.y,
                player.x, player.y
            );
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlayer = player;
            }
        }
        
        this.targetPlayer = closestPlayer;
    }
    
    onDestroy() {
        console.log('Enemy destroyed');
        // Drop experience
        if (this.targetPlayer) {
            this.targetPlayer.collectExperience(this.experienceValue);
        }
        
        // Random chance to drop powerup
        if (Phaser.Math.Between(1, 10) <= 2) { // 20% chance
            this.dropPowerup();
        }
    }
    
    dropPowerup() {
        const powerupTypes = ['speed', 'fireblast', 'giantMode', 'wreckingBall', 'healthpack'];
        const randomType = powerupTypes[Phaser.Math.Between(0, powerupTypes.length - 1)];
        
        this.scene.powerups.add(
            this.scene.physics.add.image(this.x, this.y, randomType)
        );
    }
}