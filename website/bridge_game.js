// Basic Three.js FPS Bridge Minigame - this will be the comment xd

let camera, scene, renderer;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false, isSprinting = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let gameActive = false;

const BRIDGE_WIDTH = 4;
const BRIDGE_LENGTH = 100;
const START_PLATFORM_SIZE = 20;

const onKeyDown = function (event) {
    if (!gameActive) return;
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
        case 'Space':
            if (canJump === true) velocity.y += 12; // Jump impulse
            canJump = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight': isSprinting = true; break;
    }
};

const onKeyUp = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': isSprinting = false; break;
    }
};

// Touch Control Logic
function setupTouchControls() {
    const attach = (cls, key) => {
        const el = document.querySelector(cls);
        if (el) {
            el.addEventListener('touchstart', (e) => { e.preventDefault(); onKeyDown({ code: key }); });
            el.addEventListener('touchend', (e) => { e.preventDefault(); onKeyUp({ code: key }); });
            el.addEventListener('mousedown', (e) => { e.preventDefault(); onKeyDown({ code: key }); }); // Testing on PC
            el.addEventListener('mouseup', (e) => { e.preventDefault(); onKeyUp({ code: key }); });
        }
    };

    attach('.d-up', 'KeyW');
    attach('.d-down', 'KeyS');
    attach('.d-left', 'KeyA');
    attach('.d-right', 'KeyD');
    attach('.jump-btn', 'Space');
    attach('.sprint-btn', 'ShiftLeft');
}


let startPlatform, bridge, endPlatform, obstacles = [];

function initBridgeGame() {
    console.log("Initializing Bridge Game...");

    const container = document.getElementById('minigame-container');
    if (!container) return;

    // cleanup
    while (container.firstChild) container.removeChild(container.firstChild);

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0xcccccc, 0.02);

    // CAMERA
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.1, 5); // Start on ground level (1.1 = -0.5 floor + 1.6 height)

    // LIGHTS
    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // CONTROLS
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.style.display = 'block';
        const startGameHandler = (e) => {
            if (e && e.preventDefault && e.type === 'touchstart') e.preventDefault();

            // Check if mobile
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

            if (isMobile) {
                gameActive = true;
                startBtn.style.display = 'none';
            } else {
                renderer.domElement.requestPointerLock();
            }
        };

        startBtn.onclick = startGameHandler;
        startBtn.ontouchstart = startGameHandler;

        // Init Touch
        setupTouchControls();


        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === renderer.domElement) {
                gameActive = true;
                if (startBtn) startBtn.style.display = 'none';
            } else {
                gameActive = false;
                if (startBtn) startBtn.style.display = 'block';
            }
        });

        // OBJECTS
        // Floor is y = -1 (center) -> top face at -0.5
        const platformGeo = new THREE.BoxGeometry(START_PLATFORM_SIZE, 1, START_PLATFORM_SIZE);
        const snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        startPlatform = new THREE.Mesh(platformGeo, snowMat);
        startPlatform.position.y = -1;
        scene.add(startPlatform);

        // Bridge
        // Bridge at y = -0.75 (center) -> height 0.5 -> top face at -0.5
        const bridgeGeo = new THREE.BoxGeometry(BRIDGE_WIDTH, 0.5, BRIDGE_LENGTH);
        const woodMat = new THREE.MeshBasicMaterial({ color: 0x8b4513 });
        bridge = new THREE.Mesh(bridgeGeo, woodMat);
        bridge.position.set(0, -0.75, - (START_PLATFORM_SIZE / 2) - (BRIDGE_LENGTH / 2));
        scene.add(bridge);

        // Obstacles
        obstacles = [];
        const boxGeo = new THREE.BoxGeometry(2, 3, 2);
        const boxMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

        for (let i = 0; i < 5; i++) {
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(
                (Math.random() - 0.5) * (BRIDGE_WIDTH - 1),
                0.5, // Center 0.5 -> bottom -1? No, Height 3 -> Center 0.5 means top at 2.0, bottom at -1.0. Correct.
                -20 - (i * 15)
            );
            obstacles.push(box);
            scene.add(box);
        }

        // End Platform
        endPlatform = new THREE.Mesh(platformGeo, snowMat);
        endPlatform.position.set(0, -1, - (START_PLATFORM_SIZE / 2) - BRIDGE_LENGTH - (START_PLATFORM_SIZE / 2));
        scene.add(endPlatform);

        const groundObjects = [startPlatform, bridge, endPlatform, ...obstacles];

        // Inputs
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.addEventListener('mousemove', onMouseMove);

        let lastTime = performance.now();

        function animate() {
            if (!document.getElementById('minigame-container')) return;
            requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - lastTime) / 1000, 0.05);
            lastTime = time;

            if (gameActive) {
                // Drag
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 30.0 * delta; // Gravity (9.8 is floaty, 30 feels better for FPS)

                direction.z = Number(moveForward) - Number(moveBackward);
                direction.x = Number(moveRight) - Number(moveLeft);
                direction.normalize();

                const speed = isSprinting ? 20.0 : 10.0;

                // Movement Application
                // Forward/Back uses -Z / +Z locals (usually Forward is -Z)
                if (moveForward || moveBackward) velocity.z -= direction.z * speed * 10.0 * delta;

                // Left/Right
                // Standard: Right (D) is +X. Velocity should increase X.
                // Previous code had -= direction.x. 
                // If direction.x is +1 (Right), -= makes it negative (Left).
                // We want += to go Right.
                if (moveLeft || moveRight) velocity.x += direction.x * speed * 10.0 * delta;

                // Apply Velocity
                camera.translateX(velocity.x * delta);
                camera.translateZ(velocity.z * delta);
                camera.position.y += velocity.y * delta;

                // Floor Collision
                // We check only downward from a bit above feet
                // Player height 1.6. Feet at y - 1.6.
                // We use a Raycaster from position down.

                const raycaster = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0), 0, 1.8);
                const intersects = raycaster.intersectObjects(groundObjects);

                if (intersects.length > 0) {
                    // Hit floor
                    velocity.y = Math.max(0, velocity.y);
                    canJump = true;

                    // Snap to floor surface + eye height
                    // intersects[0].point.y is the surface Y world coord.
                    camera.position.y = intersects[0].point.y + 1.6;
                }

                // Death Check (Fall)
                // Floor is at -0.5. If we go below -5, we fell.
                if (camera.position.y < -5) {
                    handleDeath();
                }

                // Win Condition
                if (camera.position.z < - (BRIDGE_LENGTH + START_PLATFORM_SIZE)) {
                    handleWin();
                }
            }

            renderer.render(scene, camera);
        }

        animate();
    }

    function handleDeath() {
        // Silent Respawn
        if (camera) camera.position.set(0, 1.1, 5);
        if (velocity) velocity.set(0, 0, 0);
    }

    function handleWin() {
        gameActive = false;
        document.exitPointerLock();
        // Go to next panel
        const panels = document.querySelectorAll('.panel');
        let myIndex = -1;
        panels.forEach((p, i) => { if (p.id === 'panel-minigame') myIndex = i; });
        if (window.goToPanel) window.goToPanel(myIndex + 1);
    }

    // Mouse Look Helper
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const PI_2 = Math.PI / 2;

    function onMouseMove(event) {
        if (!gameActive) return;
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= movementX * 0.002;
        euler.x -= movementY * 0.002;
        euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }

    window.initBridgeGame = initBridgeGame;
    window.resetGame = function () {
        if (camera) camera.position.set(0, 1.1, 5);
        if (velocity) velocity.set(0, 0, 0);
        const canvas = document.querySelector('#minigame-container canvas');
        if (canvas) canvas.requestPointerLock();
    }
}
