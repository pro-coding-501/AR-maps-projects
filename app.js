import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

let camera, scene, renderer;
let controller;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;

init();
animate();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // AR Button
    const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
    arButton.addEventListener('click', () => {
        document.getElementById('overlay').style.display = 'none';
    });
    document.body.appendChild(arButton);

    // Hide our custom button since ARButton handles the session start
    document.getElementById('ar-button').style.display = 'none';

    // Controller (for taps)
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Reticle (cursor)
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelect() {
    if (reticle.visible) {
        createPath(reticle.matrix);
    }
}

function createPath(matrix) {
    // Remove existing path if any
    const existingPath = scene.getObjectByName("navPath");
    if (existingPath) scene.remove(existingPath);

    // Hardcoded path coordinates (relative to start point)
    // x: right, y: up, z: backwards (so -z is forward)
    const points = [
        new THREE.Vector3(0, 0, 0),          // Start
        new THREE.Vector3(0, 0, -2),         // Forward 2m
        new THREE.Vector3(1, 0, -2),         // Right 1m
        new THREE.Vector3(1, 0, -4)          // Forward 2m
    ];

    // Create a curve from points
    const curve = new THREE.CatmullRomCurve3(points);

    // Create tube geometry along the curve
    const geometry = new THREE.TubeGeometry(curve, 20, 0.1, 8, false);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "navPath";

    // Apply the reticle's transform to the path
    // This places the path starting at the reticle position
    mesh.position.setFromMatrixPosition(matrix);

    // Optional: Rotate path to face camera direction (projected on floor)
    // For now, we just use the reticle's rotation which aligns with the floor
    // But we might want to align the "forward" direction of the path with the camera's view

    scene.add(mesh);
    console.log("Path placed at", mesh.position);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then(function (referenceSpace) {
                session.requestHitTestSource({ space: referenceSpace }).then(function (source) {
                    hitTestSource = source;
                });
            });

            session.addEventListener('end', function () {
                hitTestSourceRequested = false;
                hitTestSource = null;
                document.getElementById('overlay').style.display = 'flex';
            });

            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);

            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }

    renderer.render(scene, camera);
}
