import './style.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';

class CharacterController {
  constructor(object) {
    this.velocity = new THREE.Vector3(0,0,-10);
    this.decceleration = new THREE.Vector3(0, -0.01, 0);
    this.acceleration = new THREE.Vector3(0, 0.25, -10);
    this.input = new CharacterControllerInput();
    this.statemachine = new FiniteStateMachine();
    this.target = object;
  }

  Update(timeInSeconds) {
    const velocity = this.velocity;

    //slow down the object every frame
    const frameDecceleration = new THREE.Vector3(
      0,
      0,
      velocity.z * this.decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    velocity.add(frameDecceleration);

    //set the object that is to be moved
    const controlObject = this.target;
    const Q = new THREE.Quaternion();
    const A = new THREE.Vector3();
    const R = controlObject.quaternion.clone();

    const accel = this.acceleration.clone();

    //check for inputs
    if(this.input.keys.forward) {
      velocity.z += accel.z * timeInSeconds;
    }
    if(this.input.keys.left) {
      A.set(0, 1, 0);
      Q.setFromAxisAngle(A, 4.0 * Math.PI * timeInSeconds * this.acceleration.y);
      R.multiply(Q);
    }
    if(this.input.keys.backward) {
      velocity.z -= accel.z * timeInSeconds;
    }
    if(this.input.keys.right) {
      A.set(0, 1, 0);
      Q.setFromAxisAngle(A, 4.0 * -Math.PI * timeInSeconds * this.acceleration.y);
      R.multiply(Q);
    }

    controlObject.quaternion.copy(R); //the input quaternion

    //apply quaternion to position
    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0,0,1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1,0,0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    velocity.z = Math.max(Math.min(-10, velocity.z),-50);

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);
    //forward.clamp(5,20);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    oldPosition.copy(controlObject.position);
  }
};

class CharacterControllerInput {
  constructor() {
    this.Init();
  }

  Init() {
    this.keys = {
      forward: false,
      left: false,
      backward: false,
      right: false,
      space: false,
    };

    document.addEventListener('keydown', (e) => this.onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this.onKeyUp(e), false);
  }

  onKeyDown(event) {
    switch (event.keyCode) {
      case 87: // w
        this.keys.forward = true;
        break;
      case 65: // a
        this.keys.left = true;
        break;
      case 83: // s
        this.keys.backward = true;
        break;
      case 68: // d
        this.keys.right = true;
        break;
      case 32: // space
        this.keys.space = true;
        break;
    }
  }
  
  onKeyUp(event) {
    switch (event.keyCode) {
      case 87: // w
        this.keys.forward = false;
        break;
      case 65: // a
        this.keys.left = false;
        break;
      case 83: // s
        this.keys.backward = false;
        break;
      case 68: // d
        this.keys.right = false;
        break;
      case 32: // space
        this.keys.space = false;
        break;
    }
  }
};

class FiniteStateMachine {
  constructor() {

  }
};

class CameraController {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;

    this.currentPosition = new THREE.Vector3();
    this.currentLookat = new THREE.Vector3();
  }

  CalculateIdeals() {
    const idealOffset = new THREE.Vector3(0, 30, 20);
    const idealLookat = new THREE.Vector3(0,0,-20);

    idealOffset.applyQuaternion(this.target.quaternion);
    idealOffset.add(this.target.position);

    idealLookat.applyQuaternion(this.target.quaternion);
    idealLookat.add(this.target.position);

    return {idealOffset, idealLookat};
  }

  Update(timeElapsed) {
    const ideals = this.CalculateIdeals();
    const idealOffset = ideals.idealOffset;
    const idealLookat = ideals.idealLookat;

    this.currentPosition.copy(idealOffset);
    this.currentLookat.copy(idealLookat);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookat);
  }
}

class LoadApp {

  ////// BOILERPLATE CODE //////
  constructor() {
    this.Initialize();
  }

  Initialize() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    })
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth,window.innerHeight);

    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
      this.OnWindowResize();
    }, false);

    const planeHeight = 10;
    const cameraHeight = planeHeight + 20;

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000); 
    this.camera.position.y = cameraHeight;

    this.scene = new THREE.Scene();

    const light = new THREE.DirectionalLight(0xffffff,0.5);
    light.position.set(-100,100,100);
    light.target.position.set(0,0,0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;

    const ambientLight = new THREE.AmbientLight(0xffffff,0.25);
    this.scene.add(light, ambientLight);

    const textureLoader = new THREE.TextureLoader();
    const earth = textureLoader.load('earth_texture_map.jpg');
    const earthNormal = textureLoader.load('earth_normal_map.jpg');
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2048,1024,10,10),
      new THREE.MeshStandardMaterial({map:earth, normalMap:earthNormal})
    );
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);

    const player = new THREE.Object3D;

    const loader = new GLTFLoader();
    loader.load('plane.glb', (gltf) => {
      gltf.scene.traverse(c => {
        c.castShadow = true;
        c.rotation.y = Math.PI / 2;
        c.position.set(0, planeHeight, 0);
      });
      player.add(gltf.scene);
    });
    this.scene.add(player);
    this.controller = new CharacterController(player);
    this.cameraController = new CameraController(this.camera, this.controller.target);

    this.mixers = [];
    this.previousRAF = null;

    this.focus = true;
    this.Animate();

    window.addEventListener('blur', () => {
      this.focus = false;
    });
    window.addEventListener('focus', () => {
      if(this.focus) {return;};
      this.focus = true;
      this.Animate();
    });
  }

  Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if(this.mixers) {
      this.mixers.map(m => m.update(timeElapsedS));
    }

    if(this.controller) {
      this.controller.Update(timeElapsedS);      
    }

    if(this.controls) {
      //this.controls.Update(timeElapsedS);
    }

    this.cameraController.Update(timeElapsedS);
  }

  Animate() {
    //pause animation if window has lost focus
    if(!this.focus) {return;}

    requestAnimationFrame((t) => {
      if(this.previousRAF === null || t-this.previousRAF > 100) {
        this.previousRAF = t;
      }

      this.Animate();

      this.renderer.render(this.scene,this.camera);
      this.Step(t - this.previousRAF);
      this.previousRAF = t;      
    })
  }
  ////// END BOILERPLATE CODE //////
};

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new LoadApp();
});