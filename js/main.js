import * as THREE from 'three';

// Initialize WebMidi
let midiInputs = [];
let selectedInput = null;

// Function to initialize WebMidi
async function initWebMidi() {
    try {
        // Enable WebMidi.js
        await WebMidi.enable();
        console.log("WebMidi enabled!");
        
        // Get the dropdown element
        const midiInputsSelect = document.getElementById('midiInputs');
        const midiStatus = document.getElementById('midiStatus');
        
        // Clear existing options
        while (midiInputsSelect.options.length > 1) {
            midiInputsSelect.remove(1);
        }
        
        // Check if any MIDI inputs are detected
        if (WebMidi.inputs.length < 1) {
            midiStatus.textContent = "No MIDI devices detected";
            return;
        }
        
        // Store the inputs and populate dropdown
        midiInputs = WebMidi.inputs;
        midiStatus.textContent = `${midiInputs.length} MIDI input(s) detected`;
        
        // Add each input to the dropdown menu
        midiInputs.forEach(input => {
            const option = document.createElement("option");
            option.value = input.id;
            option.text = input.name;
            midiInputsSelect.add(option);
        });
        
        // Set up an event listener for the dropdown
        midiInputsSelect.addEventListener('change', function() {
            const selectedId = this.value;
            
            // Disconnect from previously selected input if any
            if (selectedInput) {
                selectedInput.removeListener();
            }
            
            if (selectedId) {
                // Find the selected input device
                selectedInput = WebMidi.getInputById(selectedId);
                midiStatus.textContent = `Connected to ${selectedInput.name}`;
                
                // Set up listener for MIDI messages
                selectedInput.addListener("midimessage", (event) => {
                    console.log("MIDI Message:", event.message);
                    // You can process MIDI messages here to control the visualization
                });
                
                // Add listeners for specific MIDI events
                selectedInput.addListener("noteon", (e) => {
                    console.log(`Note On: ${e.note.name}${e.note.octave} (${e.note.number}) - Velocity: ${e.velocity}`);
                    // Example: Change rotation speed based on note number
                    const normalizedNote = (e.note.number - 36) / 60; // Range: 0-1 for notes 36-96
                    sphere.rotation.x = normalizedNote * 0.01;
                    sphere.rotation.y = normalizedNote * 0.02;
                });
                
                selectedInput.addListener("controlchange", (e) => {
                    console.log(`Control Change: Controller ${e.controller.number} - Value: ${e.value}`);
                    // Map control changes to sphere properties
                    switch(e.controller.number) {
                        case 1: // Mod wheel (CC#1)
                            // Adjust bump scale with mod wheel
                            bumpScaleValue = e.value / 127 * 5; // Scale to 0-5 range
                            material.bumpScale = bumpScaleValue;
                            document.getElementById('bumpValue').textContent = 
                                `B:${bumpScaleValue.toFixed(2)}/D:${displacementScaleValue.toFixed(2)}`;
                            break;
                        case 74: // Often filter cutoff or similar
                            // Adjust displacement scale
                            displacementScaleValue = e.value / 127 * 2; // Scale to 0-2 range
                            material.displacementScale = displacementScaleValue;
                            document.getElementById('bumpValue').textContent = 
                                `B:${bumpScaleValue.toFixed(2)}/D:${displacementScaleValue.toFixed(2)}`;
                            break;
                    }
                });
            } else {
                selectedInput = null;
                midiStatus.textContent = "No MIDI input selected";
            }
        });
        
    } catch (err) {
        console.error("WebMidi could not be enabled:", err);
        document.getElementById('midiStatus').textContent = "WebMidi error: " + err;
    }
}

// Initialize scene, camera and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pure black background for maximum contrast

// Add mouse control variables
let isDragging = false;
let previousMouseY = 0;
let bumpScaleValue = 1.0; // Higher initial bump scale value for more dramatic effect
let displacementScaleValue = 0.3; // Initial displacement scale value

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Load texture with loading manager
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);
const texture = textureLoader.load('./images/Namib_Desert_pillars.jpg');
const bumpMap = textureLoader.load('./images/Namib_Desert_pillars.jpg');
const displacementMap = textureLoader.load('./images/Namib_Desert_pillars.jpg');

// Improve texture appearance
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(1, 1);
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Apply the same settings to bump map
bumpMap.wrapS = THREE.RepeatWrapping;
bumpMap.wrapT = THREE.RepeatWrapping;
bumpMap.repeat.set(1, 1);
bumpMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Apply the same settings to displacement map
displacementMap.wrapS = THREE.RepeatWrapping;
displacementMap.wrapT = THREE.RepeatWrapping;
displacementMap.repeat.set(1, 1);
displacementMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Texture loading events
loadingManager.onProgress = function(url, loaded, total) {
    console.log(`Loading texture: ${Math.round(loaded / total * 100)}% loaded`);
};

loadingManager.onError = function(url) {
    console.error(`Error loading texture: ${url}`);
};

// Create a sphere
const geometry = new THREE.SphereGeometry(2, 128, 128); // Increased segments for more detailed bump mapping
const material = new THREE.MeshPhysicalMaterial({ 
    map: texture,
    bumpMap: bumpMap,
    bumpScale: bumpScaleValue,
    displacementMap: displacementMap, // Add displacement map
    displacementScale: displacementScaleValue, // Control how much the vertices are displaced
    displacementBias: 0, // Offset for the displacement
    roughness: 0.4, // Increased roughness to enhance shadow areas
    metalness: 0.05, // Reduced metalness for less reflectivity in shadow areas
    clearcoat: 0.4, // Increased clearcoat for more contrast between lit and shadow areas
    normalScale: new THREE.Vector2(1, 1) // Enhance surface normal calculation
});
const sphere = new THREE.Mesh(geometry, material);
// Position sphere slightly to enhance the lighting effect
sphere.position.x = -0.5; // Shift slightly to the left to enhance key light effect
scene.add(sphere);

// Set up more dramatic lighting with key light close to camera
// No ambient light for maximum contrast and deepest shadows

// Key light - positioned close to camera but offset to the right
const keyLight = new THREE.SpotLight(0xffffff, 4); // Slightly brighter to compensate for no ambient
keyLight.position.set(3, 1, 4); // Close to camera (camera is at z=5), offset to right side
keyLight.angle = Math.PI / 5; // Slightly wider beam
keyLight.penumbra = 0.2; // Harder edge for more dramatic shadows
keyLight.decay = 1.2; // Light falls off slightly
keyLight.distance = 25; // Light reaches far enough
scene.add(keyLight);

// Fill light - very subtle from left side to prevent total blackness
const fillLight = new THREE.DirectionalLight(0xffffff, 0.05);
fillLight.position.set(-6, -1, -2); // From opposite side
scene.add(fillLight);

// Rim light - creates a slight edge highlight on the shadow side
const rimLight = new THREE.PointLight(0xffffee, 0.25);
rimLight.position.set(0, 4, -6);
scene.add(rimLight);

// All lights are already added to scene individually

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mouse event listeners for bump scale control
window.addEventListener('mousedown', (event) => {
    isDragging = true;
    previousMouseY = event.clientY;
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mouseleave', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (event) => {
    if (isDragging) {
        // Calculate mouse movement delta
        const deltaY = event.clientY - previousMouseY;
        previousMouseY = event.clientY;
        
        // Adjust bump scale based on mouse movement
        // Negative deltaY (moving up) increases bump scale
        // Positive deltaY (moving down) decreases bump scale
        bumpScaleValue -= deltaY * 0.005; // Much higher sensitivity for dramatic adjustments
        
        // Also adjust displacement scale (coordinated with bump scale)
        displacementScaleValue -= deltaY * 0.002; // Slightly lower sensitivity for displacement
        
        // Clamp values to reasonable range
        bumpScaleValue = Math.max(0, Math.min(5.0, bumpScaleValue));
        displacementScaleValue = Math.max(0, Math.min(2.0, displacementScaleValue));
        
        // Update material
        material.bumpScale = bumpScaleValue;
        material.displacementScale = displacementScaleValue;
        
        // Update display
        const bumpValueElement = document.getElementById('bumpValue');
        if (bumpValueElement) {
            bumpValueElement.textContent = `B:${bumpScaleValue.toFixed(2)}/D:${displacementScaleValue.toFixed(2)}`;
        }
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate the sphere (slower rotation)
    sphere.rotation.x += 0.002;
    sphere.rotation.y += 0.004;
    
    renderer.render(scene, camera);
}

animate();

// Initialize WebMidi after DOM content is loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWebMidi);
} else {
    initWebMidi();
}
