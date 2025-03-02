import Player from '../game-objects/player';
import config from '../config';

export default class DemoScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DemoScene' });
    }

    create() {
        // Create groups
        this.players = this.add.group();
        this.powerups = this.physics.add.group();
        this.nukeBlasts = this.physics.add.group();
        this.enemies = this.add.group();

        // Create demo player with mock gamepad
        const mockGamepad = {
            on: () => {},
            vibration: null,
            left: false,
            right: false,
            up: false,
            down: false,
            leftStick: { x: 0, y: 0 },
            rightStick: { x: 0, y: 0 }
        };

        // Create player
        this.demoPlayer = new Player(mockGamepad, this, 400, 300, 'player');
        this.demoPlayer.isDemoMode = true;
        this.players.add(this.demoPlayer);

        // Add collision between player and powerups
        this.physics.add.overlap(
            this.demoPlayer, 
            this.powerups, 
            this.demoPlayer.playerVsPowerup, 
            null, 
            this.demoPlayer
        );

        // Spawn powerups periodically
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnPowerup,
            callbackScope: this,
            loop: true
        });

        // Initial powerups
        for (let i = 0; i < 5; i++) {
            this.spawnPowerup();
        }
        
        // Periodically give experience to simulate killing enemies
        this.time.addEvent({
            delay: 5000,
            callback: () => {
                this.demoPlayer.collectExperience(50);
            },
            callbackScope: this,
            loop: true
        });
    }

    spawnPowerup() {
        const powerupTypes = ['fireblast', 'nuke', 'wreckingBall', 'speed', 'giantMode', 'healthpack'];
        const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        
        const x = Phaser.Math.Between(50, config.width - 50);
        const y = Phaser.Math.Between(50, config.height - 50);
        
        const powerup = this.physics.add.image(x, y, randomType);
        this.powerups.add(powerup);
        
        // Add some movement to powerups
        powerup.body.velocity.x = Phaser.Math.Between(-50, 50);
        powerup.body.velocity.y = Phaser.Math.Between(-50, 50);
        powerup.body.collideWorldBounds = true;
        powerup.body.bounce.set(1);
    }

    // This method would normally show a UI for perk selection
    // In demo mode, it just selects a random perk after a delay
    showPerkSelection(player) {
        console.log('DEMO: Showing perk selection UI');
        
        // Pause player input during perk selection
        player.inputEnabled = false;
        
        // Create a semi-transparent backdrop (full screen overlay)
        const backdrop = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000, 0.7
        );
        
        // Title
        const title = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 3,
            'LEVEL UP! Choose a perk:',
            {
                fontFamily: 'Arial',
                fontSize: '36px',
                color: '#ffffff'
            }
        ).setOrigin(0.5);
        
        // Available perks - match the style in _main.ts GameHUD scene
        const perks = [
            { type: 'speed', name: 'Speed Boost', description: '20% movement speed increase' },
            { type: 'fireRate', name: 'Rapid Fire', description: '20% faster firing rate' },
            { type: 'damage', name: 'Heavy Hitter', description: '50% damage increase' }
        ];
        
        // Create perk selection buttons
        const buttons = [];
        perks.forEach((perk, index) => {
            const x = this.cameras.main.width / 2 + (index - 1) * 250;
            const y = this.cameras.main.height / 2;
            
            const container = this.add.container(x, y);
            
            // Icon background
            const bg = this.add.rectangle(0, 0, 200, 240, 0x333333, 0.8)
                .setStrokeStyle(2, 0xffffff);
            
            // Perk icon - use try-catch for missing assets
            let icon;
            try {
                icon = this.add.image(0, -70, `perk-icon-${perk.type}`)
                    .setScale(2);
            } catch (e) {
                // Fallback icon
                icon = this.add.image(0, -70, 'bullet')
                    .setScale(2);
            }
            
            // Perk name
            const nameText = this.add.text(0, 0, perk.name, {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#ffffff'
            }).setOrigin(0.5);
            
            // Perk description
            const descText = this.add.text(0, 40, perk.description, {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#ffffff',
                wordWrap: { width: 180 }
            }).setOrigin(0.5);
            
            container.add([bg, icon, nameText, descText]);
            buttons.push(container);
            
            // For demo mode, we'll select one of these shortly
        });
        
        // Group all UI elements for easy cleanup
        const uiElements = [backdrop, title, ...buttons];
        
        // Define cleanup function
        const cleanupUI = () => {
            uiElements.forEach(element => element.destroy());
            player.inputEnabled = true;
        };
        
        // In demo mode, auto-select a perk after delay
        if (player.isDemoMode) {
            const randomDelay = Phaser.Math.Between(800, 1500);
            this.time.delayedCall(randomDelay, () => {
                // Pick a random perk
                const selectedPerk = perks[Phaser.Math.Between(0, perks.length - 1)];
                
                // Highlight the selected perk
                const selectedContainer = buttons[perks.indexOf(selectedPerk)];
                const bg = selectedContainer.getAt(0); // Background rectangle
                bg.setStrokeStyle(4, 0xff0000);
                
                // Apply the perk and close the menu after a short delay
                this.time.delayedCall(500, () => {
                    player.applyPerk(selectedPerk.type);
                    
                    // Fade out and destroy the UI
                    this.tweens.add({
                        targets: uiElements,
                        alpha: 0,
                        duration: 500,
                        onComplete: cleanupUI
                    });
                });
            });
        }
    }

    update() {
        // Ensure powerups stay within bounds and bounce
        this.powerups.getChildren().forEach(powerup => {
            if (!powerup.body) return;
            
            if (powerup.x < 0 || powerup.x > config.width) {
                powerup.body.velocity.x *= -1;
            }
            
            if (powerup.y < 0 || powerup.y > config.height) {
                powerup.body.velocity.y *= -1;
            }
        });
    }
}
