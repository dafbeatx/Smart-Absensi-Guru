import * as THREE from 'three';
import { MANSION_BOUNDS, DRAWER_SPOTS, CLOSET_SPOTS } from '../data/mansionLayout.js';

export function buildMansionWorld(scene) {
  const wallColliders = []; // { minX, maxX, minZ, maxZ }
  const wallMeshes = [];    // Untuk raycast garis pandang mata hantu
  const interactiveMeshes = [];
  const drawerObjects = [];
  const closetObjects = [];
  const animatedProps = {
    pendulum: null,
    gramophoneDisc: null,
    flickerLights: [],
    dustParticles: null
  };

  // Tekstur Kanvas Prosedural
  const floorTex = createWoodFloorTexture();
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(12, 11);

  const wallTex = createAgedWallTexture();
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(4, 1);

  const woodDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2b1e15,
    roughness: 0.78,
    metalness: 0.08
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4a246,
    roughness: 0.32,
    metalness: 0.82
  });

  // Lantai & Langit-Langit
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 32),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  scene.add(floorMesh);

  const ceilingMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 32),
    new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 0.95 })
  );
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.y = MANSION_BOUNDS.wallHeight;
  scene.add(ceilingMesh);

  // Balok kayu langit-langit
  for (let z = -14; z <= 14; z += 4) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(36, 0.28, 0.32), woodDarkMat);
    beam.position.set(0, MANSION_BOUNDS.wallHeight - 0.14, z);
    scene.add(beam);
  }

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.9,
    metalness: 0.03
  });

  const addWallSegment = (x1, z1, x2, z2, thickness = 0.36) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.05) return;
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const isHorizontal = Math.abs(x2 - x1) >= Math.abs(z2 - z1);

    const w = isHorizontal ? len : thickness;
    const d = isHorizontal ? thickness : len;
    const h = MANSION_BOUNDS.wallHeight;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(cx, h / 2, cz);
    scene.add(mesh);
    wallMeshes.push(mesh);

    wallColliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2
    });
  };

  const addWallWithDoor = (x1, z1, x2, z2, doorCenter, doorWidth = 2.8) => {
    const isHorizontal = Math.abs(x2 - x1) >= Math.abs(z2 - z1);
    const halfDoor = doorWidth / 2;
    if (isHorizontal) {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      addWallSegment(minX, z1, doorCenter - halfDoor, z2);
      addWallSegment(doorCenter + halfDoor, z1, maxX, z2);
      // Ambang atas pintu
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, 1.3, 0.38), woodDarkMat);
      lintel.position.set(doorCenter, MANSION_BOUNDS.wallHeight - 0.65, z1);
      scene.add(lintel);
    } else {
      const minZ = Math.min(z1, z2);
      const maxZ = Math.max(z1, z2);
      addWallSegment(x1, minZ, x2, doorCenter - halfDoor);
      addWallSegment(x1, doorCenter + halfDoor, x2, maxZ);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.3, doorWidth), woodDarkMat);
      lintel.position.set(x1, MANSION_BOUNDS.wallHeight - 0.65, doorCenter);
      scene.add(lintel);
    }
  };

  // Dinding Keliling Mansion (36m x 32m)
  addWallSegment(-18, -16, 18, -16); // Utara
  addWallSegment(-18, 16, 18, 16);   // Selatan (Pintu Keluar Utama berada di x=0, z=15.8)
  addWallSegment(-18, -16, -18, 16); // Barat
  addWallSegment(18, -16, 18, 16);   // Timur

  // Dinding Sekat Vertikal (x = -6 dan x = 6) dengan pintu lebar 2.8m di tiap baris ruangan
  [-6, 6].forEach((wx) => {
    addWallWithDoor(wx, -16, wx, -5.33, -10.5, 2.8);
    addWallWithDoor(wx, -5.33, wx, 5.33, 0.0, 2.8);
    addWallWithDoor(wx, 5.33, wx, 16, 10.5, 2.8);
  });

  // Dinding Sekat Horizontal (z = -5.33 dan z = 5.33) dengan pintu lebar 2.8m di tiap kolom ruangan
  [-5.33, 5.33].forEach((wz) => {
    addWallWithDoor(-18, wz, -6, wz, -12.0, 2.8);
    addWallWithDoor(-6, wz, 6, wz, 0.0, 2.8);
    addWallWithDoor(6, wz, 18, wz, 12.0, 2.8);
  });

  // Pintu Keluar Utama (Selatan Serambi Utama: x = 0, z = 15.7)
  const exitDoorGroup = new THREE.Group();
  exitDoorGroup.position.set(0, 0, 15.65);

  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.85, 0.16), woodDarkMat);
  doorLeaf.position.set(0, 1.425, 0);
  exitDoorGroup.add(doorLeaf);

  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.36, 3.0, 0.24), brassMat);
  doorFrame.position.set(0, 1.5, 0.05);
  exitDoorGroup.add(doorFrame);

  // 3 Gembok Kuningan Visual pada Pintu Keluar
  const padlockMeshes = [];
  [-0.55, 0, 0.55].forEach((px) => {
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.12), brassMat);
    lock.position.set(px, 1.38, -0.12);
    exitDoorGroup.add(lock);
    padlockMeshes.push(lock);
  });

  doorLeaf.userData = { interactType: 'exit_door', label: 'Pintu Keluar Utama' };
  interactiveMeshes.push(doorLeaf);
  scene.add(exitDoorGroup);

  // Bangun 12 Laci 2x Ketuk
  DRAWER_SPOTS.forEach((spot, index) => {
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = spot.rotY;

    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.92, 0.62), woodDarkMat);
    cabinet.position.y = 0.46;
    group.add(cabinet);

    const drawerFront = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.32, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x452d1d, roughness: 0.65 })
    );
    drawerFront.position.set(0, 0.64, 0.31);
    group.add(drawerFront);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), brassMat);
    knob.position.set(0, 0.64, 0.39);
    drawerFront.add(knob);

    // Kilau kunci di dalam laci (terlihat saat laci dibuka)
    const keyMesh = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 12), brassMat);
    keyMesh.rotation.x = Math.PI / 2;
    keyMesh.position.set(0, 0.62, 0.24);
    keyMesh.visible = false;
    group.add(keyMesh);

    const drawerState = {
      index,
      spot,
      group,
      drawerFront,
      keyMesh,
      tapStage: 0,      // 0 = tertutup, 1 = terbuka celah, 2 = sudah digeledah
      hasKey: false,
      keyCollected: false
    };

    cabinet.userData = { interactType: 'drawer', ref: drawerState };
    drawerFront.userData = { interactType: 'drawer', ref: drawerState };
    interactiveMeshes.push(cabinet, drawerFront);

    scene.add(group);
    drawerObjects.push(drawerState);
  });

  // Bangun 9 Lemari Pakaian Berjalusi (Hiding Closets)
  CLOSET_SPOTS.forEach((spot, index) => {
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = spot.rotY;

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 2.35, 0.85), woodDarkMat);
    body.position.y = 1.175;
    group.add(body);

    // Pintu berjalusi (louvered doors)
    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.32, 2.18, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x382518, roughness: 0.72 })
    );
    doorPanel.position.set(0, 1.15, 0.43);
    group.add(doorPanel);

    const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.06), brassMat);
    handleL.position.set(-0.08, 1.12, 0.49);
    const handleR = handleL.clone();
    handleR.position.x = 0.08;
    group.add(handleL, handleR);

    const closetState = {
      index,
      spot,
      group
    };

    body.userData = { interactType: 'closet', ref: closetState };
    doorPanel.userData = { interactType: 'closet', ref: closetState };
    interactiveMeshes.push(body, doorPanel);

    scene.add(group);
    closetObjects.push(closetState);
  });

  // Properti Atmosferik: Jam Gadang Berbandul di Lorong Utara
  const clockGroup = new THREE.Group();
  clockGroup.position.set(-3.2, 0, -15.4);
  const clockBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.6, 0.45), woodDarkMat);
  clockBody.position.y = 1.3;
  clockGroup.add(clockBody);

  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 16),
    new THREE.MeshBasicMaterial({ color: 0xdfd6c5 })
  );
  clockFace.position.set(0, 2.15, 0.24);
  clockGroup.add(clockFace);

  const pendulum = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, 0.75, 8), brassMat);
  pendulum.position.set(0, 1.25, 0.24);
  clockGroup.add(pendulum);
  animatedProps.pendulum = pendulum;
  scene.add(clockGroup);

  // Properti Atmosferik: Gramofon Antik di Ruang Keluarga Timur
  const gramGroup = new THREE.Group();
  gramGroup.position.set(12.0, 0, 10.5);
  const gramTable = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.1), woodDarkMat);
  gramTable.position.y = 0.425;
  gramGroup.add(gramTable);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
  );
  disc.position.y = 0.88;
  gramGroup.add(disc);
  animatedProps.gramophoneDisc = disc;

  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.55, 14, 1, true), brassMat);
  horn.position.set(0.12, 1.18, -0.08);
  horn.rotation.z = -0.55;
  gramGroup.add(horn);
  scene.add(gramGroup);

  // Lampu Gantung Redup Berkedip di Beberapa Ruangan
  const lampCoords = [
    { x: 0, z: 10.5, color: 0xffb469, intensity: 1.5 },
    { x: 0, z: 0, color: 0xffa654, intensity: 1.3 },
    { x: -12, z: 0, color: 0xffb469, intensity: 1.2 },
    { x: 12, z: 0, color: 0xffb469, intensity: 1.2 },
    { x: 0, z: -10.5, color: 0xd45b4a, intensity: 1.0 }
  ];

  lampCoords.forEach((lc) => {
    const light = new THREE.PointLight(lc.color, lc.intensity, 13.5, 1.7);
    light.position.set(lc.x, 3.65, lc.z);
    scene.add(light);
    animatedProps.flickerLights.push({ light, baseIntensity: lc.intensity, phase: Math.random() * 10 });
  });

  // Partikel Debu Melayang
  const dustCount = 260;
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 34;
    dustPositions[i * 3 + 1] = 0.3 + Math.random() * 3.5;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xdfd6c5,
    size: 0.045,
    transparent: true,
    opacity: 0.38
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPoints);
  animatedProps.dustParticles = dustPoints;

  return {
    wallColliders,
    wallMeshes,
    interactiveMeshes,
    drawerObjects,
    closetObjects,
    padlockMeshes,
    animatedProps
  };
}

function createWoodFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#231810';
  ctx.fillRect(0, 0, 256, 256);

  const planks = 6;
  const pw = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const shade = 26 + ((i * 7) % 14);
    ctx.fillStyle = `rgb(${shade + 12}, ${shade + 4}, ${Math.max(10, shade - 4)})`;
    ctx.fillRect(i * pw + 1, 0, pw - 2, 256);

    ctx.strokeStyle = 'rgba(8, 5, 3, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(i * pw, 0, pw, 256);
  }

  return new THREE.CanvasTexture(canvas);
}

function createAgedWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2c251e';
  ctx.fillRect(0, 0, 256, 256);

  // Panel kayu bawah (wainscoting)
  ctx.fillStyle = '#1d140e';
  ctx.fillRect(0, 175, 256, 81);
  ctx.fillStyle = '#4a3522';
  ctx.fillRect(0, 172, 256, 5);

  // Bercak usia dinding
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(15, 12, 9, 0.18)' : 'rgba(65, 54, 43, 0.12)';
    ctx.fillRect(Math.random() * 256, Math.random() * 170, 6 + Math.random() * 18, 4 + Math.random() * 12);
  }

  return new THREE.CanvasTexture(canvas);
}
