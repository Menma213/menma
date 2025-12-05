// Player Class
class Player {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(0, 0.5, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.isJumping = false;
        this.isSprinting = false;

        // Input state
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            space: false,
            shift: false
        };

        this.createMesh();
        this.setupControls();
    }

    createMesh() {
        // Create player cube with cool materials
        const geometry = new THREE.BoxGeometry(
            CONFIG.PLAYER.SIZE,
            CONFIG.PLAYER.SIZE,
            CONFIG.PLAYER.SIZE
        );

        // Create gradient material
        const material = new THREE.MeshPhongMaterial({
            color: 0x4a90e2,
            emissive: 0x00d4ff,
            emissiveIntensity: 0.3,
            shininess: 100
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Add a glowing outline
        const outlineGeometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        this.outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        this.mesh.add(this.outline);

        this.scene.add(this.mesh);
    }

    setupControls() {
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = true;
            }
            if (key === ' ') {
                this.keys.space = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = false;
            }
            if (key === ' ') {
                this.keys.space = false;
            }
        });
    }

    update(delta) {
        // Movement
        const speed = this.keys.shift ?
            CONFIG.PLAYER.SPEED * CONFIG.PLAYER.SPRINT_MULTIPLIER :
            CONFIG.PLAYER.SPEED;

        const moveVector = new THREE.Vector3();

        if (this.keys.w) moveVector.z -= 1;
        if (this.keys.s) moveVector.z += 1;
        if (this.keys.a) moveVector.x -= 1;
        if (this.keys.d) moveVector.x += 1;

        // Normalize diagonal movement
        if (moveVector.length() > 0) {
            moveVector.normalize();
            this.velocity.x = moveVector.x * speed * delta;
            this.velocity.z = moveVector.z * speed * delta;

            // Rotate player to face movement direction
            this.rotation = Math.atan2(moveVector.x, moveVector.z);
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        // Jumping
        if (this.keys.space && !this.isJumping) {
            this.velocity.y = CONFIG.PLAYER.JUMP_FORCE * delta;
            this.isJumping = true;
        }

        // Gravity
        if (this.position.y > 0.5) {
            this.velocity.y -= 20 * delta;
        } else {
            this.position.y = 0.5;
            this.velocity.y = 0;
            this.isJumping = false;
        }

        // Apply velocity
        this.position.add(this.velocity);

        // Boundary check
        const boundary = CONFIG.WORLD.SIZE / 2;
        this.position.x = Math.max(-boundary, Math.min(boundary, this.position.x));
        this.position.z = Math.max(-boundary, Math.min(boundary, this.position.z));

        // Update mesh
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Pulsing outline effect
        const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 0.3;
        this.outline.material.opacity = pulse;
    }

    getPosition() {
        return this.position.clone();
    }
}
