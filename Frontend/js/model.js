import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class EnvironmentModel {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.offset = new THREE.Vector3(0, 0, 0);
    this.rotationYDeg = 0;
  }

  async loadFromFile(file) {
    const buffer = await file.arrayBuffer();
    const loader = new FBXLoader();
    const model = loader.parse(buffer, '');

    if (this.model) {
      this.scene.remove(this.model);
      this.disposeObject(this.model);
    }

    this.model = model;
    this.applyTransform();
    this.scene.add(model);
  }

  setOffset(x, y, z) {
    this.offset.set(x, y, z);
    this.applyTransform();
  }

  setRotationY(deg) {
    this.rotationYDeg = deg;
    this.applyTransform();
  }

  applyTransform() {
    if (!this.model) return;
    this.model.position.copy(this.offset);
    this.model.rotation.set(0, THREE.MathUtils.degToRad(this.rotationYDeg), 0);
  }

  disposeObject(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) m?.dispose?.();
      }
    });
  }
}
