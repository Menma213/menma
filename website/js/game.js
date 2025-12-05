// Main Game Class
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.environment = null;
        this.clock = new THREE.Clock();
        this.isRunning = false;

        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x4a90e2, 50, 200);

        // Create camera
        const canvas = document.getElementById('game-canvas');
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.CAMERA.FOV,
            window.innerWidth / window.innerHeight,
            CONFIG.CAMERA.NEAR,
            CONFIG.CAMERA.FAR
        );

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x0a0e27);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Create game objects
        this.environment = new Environment(this.scene);
        this.player = new Player(this.scene);

        // Start game loop
        this.isRunning = true;
        this.animate();
    }

    animate() {
        if (!this.isRunning) return;

        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update game objects
        this.player.update(delta);
        this.environment.update(delta);

        // Update camera to follow player
        this.updateCamera();

        // Update minimap
        this.updateMinimap();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    updateCamera() {
        // Third-person camera that follows player
        const playerPos = this.player.getPosition();
        const offset = CONFIG.CAMERA.OFFSET;

        // Calculate camera position based on player rotation
        const cameraX = playerPos.x + offset.z * Math.sin(this.player.rotation);
        const cameraY = playerPos.y + offset.y;
        const cameraZ = playerPos.z + offset.z * Math.cos(this.player.rotation);

        // Smooth camera movement
        this.camera.position.lerp(
            new THREE.Vector3(cameraX, cameraY, cameraZ),
            0.1
        );

        // Look at player
        this.camera.lookAt(playerPos);
    }

    updateMinimap() {
        const canvas = document.getElementById('minimap-canvas');
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.2)';
        ctx.lineWidth = 1;
        const gridSize = 10;
        for (let i = 0; i <= canvas.width; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }

        // Draw player position
        const playerPos = this.player.getPosition();
        const scale = canvas.width / CONFIG.WORLD.SIZE;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const mapX = centerX + playerPos.x * scale;
        const mapY = centerY + playerPos.z * scale;

        // Draw player dot
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.arc(mapX, mapY, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw direction indicator
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mapX, mapY);
        ctx.lineTo(
            mapX + Math.sin(this.player.rotation) * 10,
            mapY + Math.cos(this.player.rotation) * 10
        );
        ctx.stroke();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    stop() {
        this.isRunning = false;
    }
}
