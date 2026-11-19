import * as THREE from 'three';
import { NAV_NODES, NAV_EDGES } from '../data/mansionLayout.js';

export class PaleShadowEntity {
  constructor(scene, diffConfig) {
    this.scene = scene;
    this.diff = diffConfig;

    // Posisi awal di Lorong Utara & Galeri (diam memindai sampai mata melihat pemain)
    this.homePos = new THREE.Vector3(0, 0, -11.5);
    this.position = this.homePos.clone();

    // Status perilaku:
    // 'dormant_scan' -> diam di tempat (0 m/s), hanya menggerakkan kepala & kerucut mata
    // 'chasing'      -> mata hantu telah melihat pemain, mengejar aktif
    // 'paused'       -> pemain bersembunyi di lemari, hantu membeku selama hideDuration detik
    // 'jumpscare'    -> menangkap pemain
    this.state = 'dormant_scan';
    this.pauseTimer = 0;
    this.scanTime = 0;
    this.baseYaw = 0; // Menghadap ke Selatan (+Z) memantau lorong utama
    this.headYaw = 0;
    this.targetLookYaw = null;
    this.lookAlertTimer = 0;
    this.seesPlayer = false;
    this.stepAccum = 0;

    this.group = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.leftArm = new THREE.Group();
    this.rightArm = new THREE.Group();
    this.gazeCone = null;

    this._buildMesh();
    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  _buildMesh() {
    const shroudMat = new THREE.MeshStandardMaterial({
      color: 0x0b0a0c,
      roughness: 0.92,
      metalness: 0.05
    });

    const skullMat = new THREE.MeshStandardMaterial({
      color: 0xd8d0c1,
      roughness: 0.65,
      metalness: 0.05
    });

    const voidMat = new THREE.MeshBasicMaterial({
      color: 0x050304
    });

    const eyeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xe63b2e
    });

    // Jubah kain kafan hitam tinggi (2.35m)
    const robeGeo = new THREE.ConeGeometry(0.46, 2.05, 14, 1, true);
    const robe = new THREE.Mesh(robeGeo, shroudMat);
    robe.position.y = 1.05;
    robe.castShadow = true;
    this.group.add(robe);

    // Bahu kurus runcing
    const shoulderGeo = new THREE.BoxGeometry(0.76, 0.16, 0.28);
    const shoulders = new THREE.Mesh(shoulderGeo, shroudMat);
    shoulders.position.y = 1.98;
    this.group.add(shoulders);

    // Kepala tengkorak pucat miring
    this.headGroup.position.set(0, 2.22, 0.04);
    this.headGroup.rotation.z = 0.22; // Kepala miring mencekam

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), skullMat);
    cranium.scale.set(0.88, 1.15, 0.96);
    this.headGroup.add(cranium);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.17), skullMat);
    jaw.position.set(0, -0.14, 0.03);
    this.headGroup.add(jaw);

    // Rongga mulut menganga gelap
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.05), voidMat);
    mouth.position.set(0, -0.13, 0.11);
    this.headGroup.add(mouth);

    // Rongga mata hitam + titik merah redup
    [-0.065, 0.065].forEach((ex) => {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), voidMat);
      socket.position.set(ex, 0.02, 0.155);
      this.headGroup.add(socket);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), eyeGlowMat);
      pupil.position.set(ex, 0.02, 0.188);
      this.headGroup.add(pupil);
    });

    // Kerucut penglihatan mata halus di depan wajah hantu
    const coneLen = 6.5;
    const coneRadius = Math.tan(THREE.MathUtils.degToRad(this.diff.sightConeDeg * 0.65)) * coneLen;
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneLen, 16, 1, true);
    coneGeo.translate(0, -coneLen / 2, 0);
    coneGeo.rotateX(-Math.PI / 2);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xc93b2b,
      transparent: true,
      opacity: 0.075,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.gazeCone = new THREE.Mesh(coneGeo, coneMat);
    this.gazeCone.position.set(0, 0.02, 0.2);
    this.headGroup.add(this.gazeCone);

    this.group.add(this.headGroup);

    // Lengan panjang berjari cakar
    const buildArm = (side) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.42, 1.94, 0);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.72, 8), shroudMat);
      upper.position.y = -0.36;
      armPivot.add(upper);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.68, 8), skullMat);
      forearm.position.set(0, -0.96, 0.08);
      forearm.rotation.x = -0.22;
      armPivot.add(forearm);

      // 3 Jari cakar panjang
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.18, 5), skullMat);
        claw.position.set(c * 0.025, -1.34, 0.16);
        claw.rotation.x = Math.PI + 0.25;
        armPivot.add(claw);
      }
      return armPivot;
    };

    this.leftArm = buildArm(-1);
    this.rightArm = buildArm(1);
    this.group.add(this.leftArm);
    this.group.add(this.rightArm);
  }

  reset() {
    this.position.copy(this.homePos);
    this.group.position.copy(this.position);
    this.state = 'dormant_scan';
    this.pauseTimer = 0;
    this.scanTime = 0;
    this.baseYaw = 0;
    this.headYaw = 0;
    this.targetLookYaw = null;
    this.lookAlertTimer = 0;
    this.seesPlayer = false;
    this.group.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0.22);
  }

  // Suara berisik membuat kepala hantu menoleh ke sumber suara tanpa berjalan
  hearNoiseAt(sourcePos, radius) {
    if (this.state === 'paused' || this.state === 'jumpscare') return;
    const dist = this.position.distanceTo(sourcePos);
    if (dist <= radius) {
      const dx = sourcePos.x - this.position.x;
      const dz = sourcePos.z - this.position.z;
      this.targetLookYaw = Math.atan2(dx, dz);
      this.lookAlertTimer = 3.2;
    }
  }

  pauseFromCloset() {
    this.state = 'paused';
    this.pauseTimer = this.diff.hideDuration;
    this.seesPlayer = false;
  }

  _checkEyeLineOfSight(playerPos, isFlashlightOn, isPlayerHidden, wallMeshes) {
    if (isPlayerHidden || this.state === 'paused' || this.state === 'jumpscare') {
      return false;
    }

    const eyeWorldPos = new THREE.Vector3(this.position.x, 2.2, this.position.z);
    const targetPos = new THREE.Vector3(playerPos.x, 1.45, playerPos.z);
    const toPlayer = targetPos.clone().sub(eyeWorldPos);
    const dist = toPlayer.length();

    // Mematikan senter mengurangi jarak pandang hantu hingga 55%
    const effectiveRange = isFlashlightOn ? this.diff.sightRange : this.diff.sightRange * 0.45;
    if (dist > effectiveRange) return false;

    // Arah tatapan kepala hantu saat ini
    const totalYaw = this.group.rotation.y + this.headGroup.rotation.y;
    const lookDir = new THREE.Vector3(Math.sin(totalYaw), 0, Math.cos(totalYaw)).normalize();
    const flatToPlayer = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();

    const angleDeg = THREE.MathUtils.radToDeg(lookDir.angleTo(flatToPlayer));
    if (angleDeg > this.diff.sightConeDeg) return false;

    // Raycast untuk memastikan pandangan mata tidak terhalang tembok
    const raycaster = new THREE.Raycaster(eyeWorldPos, toPlayer.clone().normalize(), 0.2, dist);
    const hits = raycaster.intersectObjects(wallMeshes, false);
    return hits.length === 0;
  }

  _getNextWaypointToward(targetPos) {
    const nearestNode = (pos) => {
      let best = NAV_NODES[0];
      let bestD = Infinity;
      for (const n of NAV_NODES) {
        const d = Math.hypot(n.x - pos.x, n.z - pos.z);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    };

    const start = nearestNode(this.position);
    const goal = nearestNode(targetPos);
    if (start.id === goal.id) {
      return new THREE.Vector3(targetPos.x, 0, targetPos.z);
    }

    // BFS sederhana pada graf 9 ruangan
    const queue = [[start.id]];
    const visited = new Set([start.id]);
    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];
      if (curr === goal.id) {
        const nextId = path[1] || goal.id;
        const node = NAV_NODES.find((n) => n.id === nextId);
        return new THREE.Vector3(node.x, 0, node.z);
      }
      for (const nb of NAV_EDGES[curr] || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push([...path, nb]);
        }
      }
    }
    return new THREE.Vector3(targetPos.x, 0, targetPos.z);
  }

  update(dt, context) {
    const { playerPos, isFlashlightOn, isPlayerHidden, isQuizOpen, wallMeshes, audio, onSpotted, onCatch } = context;

    // Jika modal kuis guru terbuka, bekukan entitas agar siswa bisa membaca soal
    if (isQuizOpen) return;

    // 1. Status PAUSED (Pemain di dalam lemari)
    if (this.state === 'paused') {
      this.pauseTimer -= dt;
      this.seesPlayer = false;
      if (this.pauseTimer <= 0) {
        // Kembali ke posisi pengawasan utara dan diam memindai
        this.position.copy(this.homePos);
        this.group.position.copy(this.position);
        this.state = 'dormant_scan';
        this.targetLookYaw = null;
      }
      return;
    }

    // 2. Cek apakah mata hantu melihat pemain
    const spottedNow = this._checkEyeLineOfSight(playerPos, isFlashlightOn, isPlayerHidden, wallMeshes);

    if (spottedNow && !this.seesPlayer && this.state === 'dormant_scan') {
      this.state = 'chasing';
      if (onSpotted) onSpotted();
    }
    this.seesPlayer = spottedNow;

    // Warna kerucut penglihatan mata berubah lebih terang saat melihat pemain
    if (this.gazeCone) {
      this.gazeCone.material.opacity = this.seesPlayer ? 0.22 : 0.075;
    }

    // 3. Perilaku DORMANT_SCAN: Diam 0 m/s, hanya menggerakkan kepala memindai
    if (this.state === 'dormant_scan') {
      this.scanTime += dt;
      if (this.lookAlertTimer > 0 && this.targetLookYaw !== null) {
        this.lookAlertTimer -= dt;
        this.group.rotation.y = this._lerpAngle(this.group.rotation.y, this.targetLookYaw, dt * 4.5);
        this.headGroup.rotation.y = Math.sin(this.scanTime * 3.2) * 0.22;
      } else {
        // Sapuan kepala lambat memindai lorong utara, barat, dan timur
        this.group.rotation.y = this._lerpAngle(this.group.rotation.y, this.baseYaw, dt * 1.5);
        this.headGroup.rotation.y = Math.sin(this.scanTime * 0.72) * 1.18;
      }

      // Ayunan lengan pelan saat diam
      this.leftArm.rotation.x = Math.sin(this.scanTime * 1.4) * 0.08;
      this.rightArm.rotation.x = -Math.sin(this.scanTime * 1.4) * 0.08;
      return;
    }

    // 4. Perilaku CHASING: Mengejar pemain aktif
    if (this.state === 'chasing') {
      // Jika pemain bersembunyi di lemari saat dikejar, hantu terjeda
      if (isPlayerHidden) {
        this.pauseFromCloset();
        return;
      }

      const waypoint = this.seesPlayer
        ? new THREE.Vector3(playerPos.x, 0, playerPos.z)
        : this._getNextWaypointToward(playerPos);

      const moveVec = waypoint.clone().sub(this.position);
      moveVec.y = 0;
      const distToWp = moveVec.length();

      if (distToWp > 0.05) {
        moveVec.normalize();
        const speed = this.seesPlayer ? this.diff.ghostSpeed : this.diff.ghostSpeed * 0.85;
        this.position.addScaledVector(moveVec, speed * dt);
        this.group.position.copy(this.position);

        const desiredYaw = Math.atan2(moveVec.x, moveVec.z);
        this.group.rotation.y = this._lerpAngle(this.group.rotation.y, desiredYaw, dt * 7.5);
        this.headGroup.rotation.y = this._lerpAngle(this.headGroup.rotation.y, 0, dt * 8.0);

        // Langkah kaki berat & ayunan tubuh
        this.stepAccum += speed * dt;
        this.group.position.y = Math.abs(Math.sin(this.stepAccum * 2.4)) * 0.09;
        this.leftArm.rotation.x = Math.sin(this.stepAccum * 2.4) * 0.42 - 0.35;
        this.rightArm.rotation.x = -Math.sin(this.stepAccum * 2.4) * 0.42 - 0.35;

        if (this.stepAccum >= 1.45) {
          this.stepAccum = 0;
          if (audio) audio.playFootstep(true);
        }
      }

      // Cek tertangkap
      const distPlayer = Math.hypot(playerPos.x - this.position.x, playerPos.z - this.position.z);
      if (distPlayer < 1.18) {
        this.state = 'jumpscare';
        if (onCatch) onCatch();
      }
    }
  }

  _lerpAngle(a, b, t) {
    const diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    return a + diff * Math.min(1, t);
  }
}
