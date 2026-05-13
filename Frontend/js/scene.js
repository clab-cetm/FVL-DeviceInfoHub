import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvas) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );
    this.camera.position.set(40, 30, 40);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    this.gridCellSize = 1;
    this.gridCellCount = 100;
    this.gridColors = [0x666666, 0x333333];
    this.grid = null;
    this.rebuildGrid();

    const axes = new THREE.AxesHelper(5);
    this.scene.add(axes);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(80, 120, 60);
    this.scene.add(dir);

    window.addEventListener('resize', () => this.onResize());

    this.animate = this.animate.bind(this);
    this.animate();
  }

  rebuildGrid() {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry?.dispose();
      const mats = Array.isArray(this.grid.material) ? this.grid.material : [this.grid.material];
      for (const m of mats) m?.dispose?.();
    }
    const divisions = this.gridCellCount * 2;
    const size = this.gridCellSize * divisions;
    this.grid = new THREE.GridHelper(size, divisions, this.gridColors[0], this.gridColors[1]);
    this.scene.add(this.grid);
  }

  setGrid(cellSize, cellCount) {
    if (cellSize > 0) this.gridCellSize = cellSize;
    if (cellCount > 0) this.gridCellCount = Math.floor(cellCount);
    this.rebuildGrid();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
