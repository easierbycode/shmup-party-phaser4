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
        // Create a perk menu panel that covers most of the screen
        const menuPanel = this.add.rectangle(
            config.width / 2,
            config.height / 2,
            600,
            400,
            0x000000,
            0.8
        ).setOrigin(0.5);
        
        // Add a title
        const title = this.add.text(
            config.width / 2,
            menuPanel.y - 150,
            'LEVEL UP! SELECT A PERK',
            {
                fontSize: '32px',
                fontFamily: 'Arial',
                color: '#ffffff'
            }
        ).setOrigin(0.5);
        
        // Create selectable perk buttons
        const perkOptions = player.availablePerks.slice(0, 3); // Show only 3 random perks
        const perkButtons = [];
        const buttonHeight = 80;
        const buttonSpacing = 20;
        const startY = menuPanel.y - buttonHeight - buttonSpacing;
        
        perkOptions.forEach((perk, index) => {
            // Create button background
            const button = this.add.rectangle(
                config.width / 2,
                startY + (buttonHeight + buttonSpacing) * index,
                500,
                buttonHeight,
                0x3366cc,
                1
            ).setOrigin(0.5);
            
            // Add perk name and description
            let description;
            switch(perk) {
                case 'damage': 
                    description = 'Increase damage by 25%';
                    break;
                case 'speed': 
                    description = 'Increase movement speed by 15%';
                    break;
                case 'fireRate': 
                    description = 'Increase fire rate by 15%';
                    break;
                case 'health': 
                    description = 'Gain an extra health point';
                    break;
                case 'shield': 
                    description = 'Activate temporary shield';
                    break;
                default:
                    description = 'Mystery perk';
            }
            
            const perkName = this.add.text(
                button.x - 220,
                button.y - 15,
                perk.toUpperCase(),
                {
                    fontSize: '24px',
                    fontFamily: 'Arial',
                    color: '#ffffff',
                    fontWeight: 'bold'
                }
            ).setOrigin(0, 0.5);
            
            const perkDesc = this.add.text(
                perkName.x,
                button.y + 15,
                description,
                {
                    fontSize: '18px',
                    fontFamily: 'Arial',
                    color: '#ffffff'
                }
            ).setOrigin(0, 0.5);
            
            perkButtons.push({
                background: button,
                name: perkName,
                description: perkDesc,
                perk: perk
            });
        });
        
        // Group all UI elements for easy cleanup
        const uiElements = [
            menuPanel, 
            title, 
            ...perkButtons.map(btn => [btn.background, btn.name, btn.description]).flat()
        ];
        
        // In demo mode, select a random perk after a delay
        if (player.isDemoMode) {
            const selectedIndex = Phaser.Math.Between(0, perkButtons.length - 1);
            const selectedButton = perkButtons[selectedIndex];
            
            // Highlight button after a short delay (simulate thinking)
            this.time.delayedCall(800, () => {
                // Highlight the selected button
                selectedButton.background.setFillStyle(0xffcc00);
                
                // Apply the perk and close menu after another short delay
                this.time.delayedCall(600, () => {
                    player.applyPerk(selectedButton.perk);
                    
                    // Fade out and destroy the UI
                    this.tweens.add({
                        targets: uiElements,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            uiElements.forEach(element => element.destroy());
                        }
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
