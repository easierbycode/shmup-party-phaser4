export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        // Load placeholder assets (replace with your actual asset paths)
        this.load.image('player', 'assets/player.png');
        this.load.image('bullet', 'assets/bullet.png');
    }

    create() {
        // Create the player sprite at the center of a 1680x1050 screen
        this.player = this.physics.add.sprite(840, 525, 'player');
        this.player.setCollideWorldBounds(true); // Keep player within screen bounds

        // Initialize the weapons group for bullets
        this.weapons = this.physics.add.group();

        // Set up keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();

        // Shooting cooldown flag
        this.canShoot = true;

        // Set up gamepad input
        this.input.gamepad.on('connected', (pad) => {
            this.pad = pad; // Store the connected gamepad
            console.log('Gamepad connected:', pad.id);
        });
    }

    update() {
        // Reset player velocity each frame to prevent continuous movement
        this.player.setVelocity(0);

        // **Keyboard Movement**
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-200);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(200);
        }
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-200);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(200);
        }

        // **Gamepad Movement**
        if (this.pad) {
            // Left analog stick for movement (axes[0] = X, axes[1] = Y)
            const leftX = this.pad.axes[0].getValue();
            const leftY = this.pad.axes[1].getValue();
            const deadZone = 0.1; // Dead zone to prevent drift
            if (Math.abs(leftX) > deadZone) {
                this.player.setVelocityX(leftX * 200); // Speed of 200
            }
            if (Math.abs(leftY) > deadZone) {
                this.player.setVelocityY(leftY * 200);
            }
        }

        // **Mouse Shooting**
        if (this.input.activePointer.isDown && this.canShoot) {
            const pointer = this.input.activePointer;
            const angle = Phaser.Math.Angle.Between(
                this.player.x,
                this.player.y,
                pointer.x,
                pointer.y
            );
            this.shootBullet(angle);
            this.canShoot = false;
            this.time.delayedCall(200, () => { this.canShoot = true; }); // 200ms cooldown
        }

        // **Gamepad Shooting**
        if (this.pad) {
            // Right analog stick for shooting direction (axes[2] = X, axes[3] = Y)
            const rightX = this.pad.axes[2].getValue();
            const rightY = this.pad.axes[3].getValue();
            const rightMagnitude = Math.sqrt(rightX * rightX + rightY * rightY);
            const triggerThreshold = 0.5; // Right trigger press threshold
            if (
                rightMagnitude > 0.1 && // Ensure right stick is moved
                this.pad.rightTrigger > triggerThreshold && // Right trigger pressed
                this.canShoot
            ) {
                const angle = Math.atan2(rightY, rightX);
                this.shootBullet(angle);
                this.canShoot = false;
                this.time.delayedCall(200, () => { this.canShoot = true; }); // 200ms cooldown
            }
        }

        // **Bullet Cleanup**
        this.weapons.children.iterate((bullet) => {
            if (
                bullet &&
                (bullet.x < 0 || bullet.x > 1680 || bullet.y < 0 || bullet.y > 1050)
            ) {
                bullet.destroy(); // Remove bullets that leave the screen
            }
        });
    }

    shootBullet(angle) {
        // Create a bullet at the player's position
        const bullet = this.physics.add.sprite(this.player.x, this.player.y, 'bullet');
        const speed = 400; // Bullet speed
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;
        bullet.setVelocity(velocityX, velocityY);
        this.weapons.add(bullet); // Add to weapons group
    }
}