// Environment Class - Creates the 3D world
class Environment {
    constructor(scene) {
        this.scene = scene;
        this.snowParticles = null;

        this.createGround();
        this.createLighting();
        this.createSky();
        this.createSnowfall();
        this.createBuildings();
    }

    createGround() {
        // Create snowy ground
        const groundGeometry = new THREE.PlaneGeometry(
            CONFIG.WORLD.SIZE,
            CONFIG.WORLD.SIZE,
            50,
            50
        );

        // Add some height variation for terrain
        const vertices = groundGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i + 2] = Math.random() * 0.5; // Random height
        }
        groundGeometry.attributes.position.needsUpdate = true;
        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshPhongMaterial({
            color: 0xe8f4ff,
            shininess: 30,
            flatShading: false
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add grid helper for reference
        const gridHelper = new THREE.GridHelper(CONFIG.WORLD.SIZE, 50, 0x4a90e2, 0x2a5080);
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
    }

    createLighting() {
        // Ambient light (soft overall lighting)
        const ambientLight = new THREE.AmbientLight(0xb8d4ff, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;

        // Shadow settings
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;

        this.scene.add(directionalLight);

        // Hemisphere light for sky color
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0xe8f4ff, 0.5);
        this.scene.add(hemisphereLight);
    }

    createSky() {
        // Create gradient sky
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0e27) },
                bottomColor: { value: new THREE.Color(0x4a90e2) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });

        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
    }

    createSnowfall() {
        // Create snow particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particleCount = CONFIG.WORLD.SNOW_PARTICLES;

        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * CONFIG.WORLD.SIZE;
            positions[i * 3 + 1] = Math.random() * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * CONFIG.WORLD.SIZE;

            velocities[i] = Math.random() * 0.5 + 0.5;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particlesGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

        const particlesMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.snowParticles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(this.snowParticles);
    }

    createBuildings() {
        // Create some simple buildings for the village
        const buildingConfigs = [
            { x: -20, z: -20, width: 8, height: 12, depth: 8, color: 0x8b7355 },
            { x: 20, z: -20, width: 10, height: 15, depth: 10, color: 0x9b8365 },
            { x: -25, z: 20, width: 6, height: 10, depth: 6, color: 0x7b6345 },
            { x: 25, z: 20, width: 12, height: 18, depth: 12, color: 0xab9375 },
            { x: 0, z: -30, width: 15, height: 20, depth: 15, color: 0x6b5335 }
        ];

        buildingConfigs.forEach(config => {
            // Building body
            const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth);
            const material = new THREE.MeshPhongMaterial({
                color: config.color,
                flatShading: true
            });
            const building = new THREE.Mesh(geometry, material);
            building.position.set(config.x, config.height / 2, config.z);
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);

            // Snowy roof
            const roofGeometry = new THREE.ConeGeometry(
                config.width * 0.7,
                config.height * 0.3,
                4
            );
            const roofMaterial = new THREE.MeshPhongMaterial({
                color: 0xe8f4ff
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.set(config.x, config.height + config.height * 0.15, config.z);
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            this.scene.add(roof);
        });
    }

    update(delta) {
        // Animate snowfall
        if (this.snowParticles) {
            const positions = this.snowParticles.geometry.attributes.position.array;
            const velocities = this.snowParticles.geometry.attributes.velocity.array;

            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] -= velocities[i / 3] * delta * 5;

                // Reset particle if it falls below ground
                if (positions[i + 1] < 0) {
                    positions[i + 1] = 50;
                    positions[i] = (Math.random() - 0.5) * CONFIG.WORLD.SIZE;
                    positions[i + 2] = (Math.random() - 0.5) * CONFIG.WORLD.SIZE;
                }

                // Add slight horizontal drift
                positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.01;
            }

            this.snowParticles.geometry.attributes.position.needsUpdate = true;
        }
    }
}
