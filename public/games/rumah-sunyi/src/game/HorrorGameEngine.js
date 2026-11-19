import * as THREE from 'three';
import { DIFFICULTY_CONFIG, MANSION_BOUNDS, getRoomAt, saveBestTime, formatTime } from '../data/mansionLayout.js';
import { HorrorAudioEngine } from '../audio/horrorAudio.js';
import { PaleShadowEntity } from '../entities/paleShadow.js';
import { buildMansionWorld } from '../world/mansionBuilder.js';

export class HorrorGameEngine {
  constructor(canvas, uiCallbacks) {
    this.canvas = canvas;
    this.ui = uiCallbacks;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090807);
    this.scene.fog = new THREE.FogExp2(0x090807, 0.068);

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.15, 45);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.audio = new HorrorAudioEngine();

    // Cahaya ambient redup + Senter genggam pemain
    const ambient = new THREE.AmbientLight(0x3a322a, 0.55);
    this.scene.add(ambient);

    this.flashlight = new THREE.SpotLight(0xfff1d6, 3.4, 22, THREE.MathUtils.degToRad(34), 0.45, 1.2);
    this.flashlightTarget = new THREE.Object3D();
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    this.world = buildMansionWorld(this.scene);
    this.diffConfig = DIFFICULTY_CONFIG.normal;
    this.ghost = new PaleShadowEntity(this.scene, this.diffConfig);

    // Status permainan
    this.isPlaying = false;
    this.isPausedByQuiz = false;
    this.isHiddenInCloset = false;
    this.activeCloset = null;
    this.flashlightOn = true;

    this.elapsedTime = 0;
    this.keysFound = 0;
    this.quizData = null;
    this.pendingKeyDrawer = null;

    // Posisi & orientasi pemain
    this.playerPos = new THREE.Vector3(0, 1.65, 13.5);
    this.yaw = 0; // 0 menghadap Utara (-Z)
    this.pitch = 0;
    this.walkBob = 0;
    this.stepAccum = 0;

    // Input gerak (Keyboard + Multi-touch Joystick + Camera Swipe)
    this.keysDown = new Set();
    this.joyInput = { x: 0, y: 0 };
    this.targetedObject = null;

    this.ecgPhase = 0;
    this.lastFrameTime = performance.now();

    this._bindEvents();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying || this.isPausedByQuiz) return;
      const code = e.code;
      this.keysDown.add(code);

      if (code === 'KeyE' || code === 'Space') {
        e.preventDefault();
        this.triggerPrimaryAction();
      } else if (code === 'KeyF') {
        this.toggleFlashlight();
      } else if (code === 'KeyQ') {
        this.turnAround180();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    // Geser layar sentuh / mouse pada kanvas untuk menengok bebas (multi-touch aman)
    let lookPointerId = null;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    let downTime = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying || this.isPausedByQuiz) return;
      if (lookPointerId === null) {
        lookPointerId = e.pointerId;
        lastX = downX = e.clientX;
        lastY = downY = e.clientY;
        downTime = performance.now();
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookPointerId || !this.isPlaying || this.isPausedByQuiz) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      this.yaw -= dx * 0.0042;
      this.pitch = Math.max(-0.68, Math.min(0.68, this.pitch - dy * 0.0035));
    });

    const endLook = (e) => {
      if (e.pointerId !== lookPointerId) return;
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      const elapsed = performance.now() - downTime;
      lookPointerId = null;

      // Ketukan singkat pada kanvas PID langsung memicu interaksi objek di depan pemain
      if (moved < 14 && elapsed < 280 && this.isPlaying && !this.isPausedByQuiz) {
        this.triggerPrimaryAction();
      }
    };

    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);
  }

  setJoystickInput(nx, ny) {
    this.joyInput.x = nx;
    this.joyInput.y = ny;
  }

  toggleFlashlight() {
    if (this.isHiddenInCloset) return;
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.visible = this.flashlightOn;
    this.ui.showToast(
      this.flashlightOn
        ? 'Senter menyala — laci & ruangan terlihat jelas.'
        : 'Senter dimatikan — jarak pandang mata hantu berkurang!'
    );
  }

  turnAround180() {
    this.yaw += Math.PI;
  }

  startSession(diffId, quizData) {
    this.audio.init();
    this.audio.stopLobbyBgm();
    this.audio.playExploreBgm();
    this.diffConfig = DIFFICULTY_CONFIG[diffId] || DIFFICULTY_CONFIG.normal;
    this.quizData = JSON.parse(JSON.stringify(quizData));

    // Reset posisi pemain di Serambi Utama
    this.playerPos.set(0, 1.65, 13.4);
    this.yaw = 0;
    this.pitch = 0;
    this.elapsedTime = 0;
    this.keysFound = 0;
    this.isHiddenInCloset = false;
    this.activeCloset = null;
    this.isPausedByQuiz = false;
    this.flashlightOn = true;
    this.flashlight.visible = true;

    // Reset gembok pintu utama
    this.world.padlockMeshes.forEach((m) => (m.visible = true));

    // Reset 12 laci & acak 3 kunci (1 di Sayap Barat [0..3], 1 di Tengah [4..7], 1 di Timur [8..11])
    this.world.drawerObjects.forEach((d) => {
      d.tapStage = 0;
      d.hasKey = false;
      d.keyCollected = false;
      d.drawerFront.position.z = 0.31;
      d.keyMesh.visible = false;
    });

    const keyIndices = [
      Math.floor(Math.random() * 4),
      4 + Math.floor(Math.random() * 4),
      8 + Math.floor(Math.random() * 4)
    ];
    keyIndices.forEach((idx) => {
      this.world.drawerObjects[idx].hasKey = true;
    });

    // Reset hantu
    this.ghost.diff = this.diffConfig;
    this.ghost.reset();

    this.isPlaying = true;
    this.ui.onSessionStarted();
  }

  exitCloset() {
    if (!this.isHiddenInCloset || !this.activeCloset) return;
    const spot = this.activeCloset.spot;
    // Keluar tepat 1.25m di depan pintu lemari
    this.playerPos.x = spot.x + Math.sin(spot.rotY) * 1.25;
    this.playerPos.z = spot.z + Math.cos(spot.rotY) * 1.25;
    this.yaw = spot.rotY;
    this.isHiddenInCloset = false;
    this.activeCloset = null;
    this.flashlightOn = true;
    this.flashlight.visible = true;
    this.audio.playClosetDoor(false);
    this.ui.setClosetOverlay(false, 0);
  }

  triggerPrimaryAction() {
    if (!this.isPlaying || this.isPausedByQuiz) return;

    if (this.isHiddenInCloset) {
      this.exitCloset();
      return;
    }

    const target = this.targetedObject;
    if (!target) {
      this.ui.showToast('Dekati laci, lemari berjalusi, atau pintu utama untuk berinteraksi.');
      return;
    }

    if (target.interactType === 'closet') {
      this.isHiddenInCloset = true;
      this.activeCloset = target.ref;
      this.flashlightOn = false;
      this.flashlight.visible = false;
      this.audio.playClosetDoor(true);
      this.ghost.pauseFromCloset();
      this.ui.setClosetOverlay(true, this.diffConfig.hideDuration);
      return;
    }

    if (target.interactType === 'drawer') {
      const d = target.ref;
      if (d.tapStage === 0) {
        // Ketukan ke-1: Membuka celah laci + suara berisik sedang
        d.tapStage = 1;
        d.drawerFront.position.z = 0.48;
        if (d.hasKey && !d.keyCollected) d.keyMesh.visible = true;
        this.audio.playDrawerCreak(1);
        this.ghost.hearNoiseAt(d.group.position, 14.5);
        this.ui.showToast('Ketukan 1: Celah laci terbuka berderit! Ketuk sekali lagi untuk menggeledah.');
      } else if (d.tapStage === 1) {
        // Ketukan ke-2: Menggeledah isi laci + suara nyaring
        d.tapStage = 2;
        d.drawerFront.position.z = 0.64;
        this.audio.playDrawerCreak(2);
        this.ghost.hearNoiseAt(d.group.position, 19.5);

        if (d.hasKey && !d.keyCollected) {
          this.pendingKeyDrawer = d;
          this.isPausedByQuiz = true;
          const qObj = this.quizData.questions[this.keysFound] || this.quizData.questions[0];
          this.audio.playQuizPopup();
          this.audio.playWaitingQuizBgm();
          this.ui.openQuizModal(this.quizData.subject, this.keysFound + 1, qObj);
        } else {
          this.ui.showToast('Laci ini hanya berisi berkas usang — kosong, tidak ada kunci.');
        }
      } else {
        this.ui.showToast('Laci ini sudah selesai digeledah.');
      }
      return;
    }

    if (target.interactType === 'exit_door') {
      if (this.keysFound >= 3) {
        this._finishGame(true);
      } else {
        this.ui.showToast(`Pintu terkunci! Masih butuh ${3 - this.keysFound} Kunci Kuningan lagi.`);
      }
    }
  }

  resolveQuizAnswer(isCorrect) {
    if (!this.pendingKeyDrawer) return;
    if (isCorrect) {
      const d = this.pendingKeyDrawer;
      d.keyCollected = true;
      d.keyMesh.visible = false;
      this.keysFound += 1;
      if (this.world.padlockMeshes[this.keysFound - 1]) {
        this.world.padlockMeshes[this.keysFound - 1].visible = false;
      }
      this.audio.stopWaitingQuizBgm();
      this.audio.resumeExploreBgm();
      this.audio.playKeyFound();
      this.pendingKeyDrawer = null;
      this.isPausedByQuiz = false;
      this.ui.closeQuizModal();
      this.ui.showToast(
        this.keysFound >= 3
          ? 'Semua 3 Kunci Kuningan terkumpul! Segera menuju Pintu Keluar Utama!'
          : `Kunci Kuningan ke-${this.keysFound} berhasil diambil!`
      );
    } else {
      // Jawaban salah membanting gembok hingga memancing perhatian hantu
      this.audio.playWrongAnswerLock();
      this.ghost.hearNoiseAt(this.playerPos, 24.0);
    }
  }

  _finishGame(won) {
    this.isPlaying = false;
    this.isPausedByQuiz = false;
    this.audio.stopExploreBgm();
    this.audio.stopWaitingQuizBgm();
    if (won) {
      const rec = saveBestTime(this.diffConfig.id, this.elapsedTime);
      this.ui.showEndScreen(true, this.elapsedTime, rec.best, rec.isNewRecord, this.keysFound);
    } else {
      this.audio.playJumpscare();
      this.ui.showEndScreen(false, this.elapsedTime, null, false, this.keysFound);
    }
  }

  _movePlayerWithCollision(dx, dz) {
    const radius = 0.42;
    const tryAxis = (nx, nz) => {
      if (
        nx < MANSION_BOUNDS.minX + radius ||
        nx > MANSION_BOUNDS.maxX - radius ||
        nz < MANSION_BOUNDS.minZ + radius ||
        nz > MANSION_BOUNDS.maxZ - radius
      ) {
        return false;
      }
      for (const box of this.world.wallColliders) {
        if (
          nx + radius > box.minX &&
          nx - radius < box.maxX &&
          nz + radius > box.minZ &&
          nz - radius < box.maxZ
        ) {
          return false;
        }
      }
      return true;
    };

    if (tryAxis(this.playerPos.x + dx, this.playerPos.z)) {
      this.playerPos.x += dx;
    }
    if (tryAxis(this.playerPos.x, this.playerPos.z + dz)) {
      this.playerPos.z += dz;
    }
  }

  _detectTargetObject() {
    if (this.isHiddenInCloset) {
      this.targetedObject = null;
      return;
    }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    let bestObj = null;
    let bestScore = Infinity;

    for (const mesh of this.world.interactiveMeshes) {
      const ud = mesh.userData;
      if (!ud || !ud.interactType) continue;
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);

      const toObj = new THREE.Vector3(worldPos.x - this.playerPos.x, 0, worldPos.z - this.playerPos.z);
      const dist = toObj.length();
      if (dist > 2.55) continue;

      const angle = forward.angleTo(toObj.normalize());
      if (angle < 0.65) {
        const score = dist + angle * 1.4;
        if (score < bestScore) {
          bestScore = score;
          bestObj = ud;
        }
      }
    }

    this.targetedObject = bestObj;
  }

  _animate(now) {
    requestAnimationFrame(this._animate);
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    // Animasi properti mansion
    if (this.world.animatedProps.pendulum) {
      this.world.animatedProps.pendulum.rotation.z = Math.sin(now * 0.0025) * 0.24;
    }
    if (this.world.animatedProps.gramophoneDisc) {
      this.world.animatedProps.gramophoneDisc.rotation.y += dt * 1.8;
    }
    this.world.animatedProps.flickerLights.forEach((fl) => {
      fl.light.intensity = fl.baseIntensity + Math.sin(now * 0.011 + fl.phase) * 0.14;
    });

    if (this.isPlaying) {
      if (!this.isPausedByQuiz) {
        this.elapsedTime += dt;
      }

      // Gerak pemain jika tidak di dalam lemari & tidak sedang kuis
      if (!this.isHiddenInCloset && !this.isPausedByQuiz) {
        let forwardInput = -this.joyInput.y;
        let strafeInput = this.joyInput.x;

        if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) forwardInput += 1;
        if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) forwardInput -= 1;
        if (this.keysDown.has('KeyD')) strafeInput += 1;
        if (this.keysDown.has('KeyA')) strafeInput -= 1;

        // 🕹️ Kamera Otomatis Mengikuti Gerakan Joystick (Auto-Turn / Camera Follow)
        const joyX = this.joyInput.x;
        const joyY = this.joyInput.y;
        const joyMag = Math.hypot(joyX, joyY);

        if (joyMag > 0.06) {
          // Putar kamera (yaw) mengikuti arah belokan joystick secara proporsional & halus
          const turnRate = 2.85; // Kecepatan putar sudut ~163°/detik saat stik penuh
          this.yaw -= joyX * turnRate * dt;

          // Mendorong maju atau menyerong: gerakkan pemain ke arah hadap kamera yang baru
          if (joyY < 0.2) {
            const forwardBoost = Math.max(0, -joyY) + Math.abs(joyX) * 0.75;
            forwardInput = Math.max(forwardInput, forwardBoost);
            strafeInput = joyX * 0.25; // Reduksi strafe agar belokan membulat natural
          }
        }

        // Kontrol putar sudut kamera via keyboard (ArrowLeft / ArrowRight)
        if (this.keysDown.has('ArrowRight')) {
          this.yaw -= 2.85 * dt;
        }
        if (this.keysDown.has('ArrowLeft')) {
          this.yaw += 2.85 * dt;
        }

        const mag = Math.hypot(forwardInput, strafeInput);
        if (mag > 0.05) {
          const normF = forwardInput / Math.max(1, mag);
          const normS = strafeInput / Math.max(1, mag);
          const speed = 4.6;

          const sinY = Math.sin(this.yaw);
          const cosY = Math.cos(this.yaw);
          const vx = (-sinY * normF + cosY * normS) * speed * dt;
          const vz = (-cosY * normF - sinY * normS) * speed * dt;

          this._movePlayerWithCollision(vx, vz);

          this.walkBob += dt * 10.5;
          this.stepAccum += speed * dt;
          if (this.stepAccum >= 1.75) {
            this.stepAccum = 0;
            this.audio.playFootstep(false);
          }
        } else {
          this.walkBob = 0;
        }
      }

      // Update kamera & senter
      this.camera.position.set(
        this.playerPos.x,
        1.65 + Math.sin(this.walkBob) * 0.045,
        this.playerPos.z
      );
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;

      const lookDir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
      this.flashlight.position.copy(this.camera.position);
      this.flashlightTarget.position.copy(this.camera.position).addScaledVector(lookDir, 6);

      // Update entitas Sosok Bayangan Pucat
      this.ghost.update(dt, {
        playerPos: this.playerPos,
        isFlashlightOn: this.flashlightOn,
        isPlayerHidden: this.isHiddenInCloset,
        isQuizOpen: this.isPausedByQuiz,
        wallMeshes: this.world.wallMeshes,
        audio: this.audio,
        onSpotted: () => {
          this.audio.playEyeSpotSting();
          this.ui.showToast('MATA SOSOK MELIHATMU! Segera lari dan bersembunyi di dalam lemari!');
        },
        onCatch: () => {
          this._finishGame(false);
        }
      });

      const ghostDist = Math.hypot(
        this.ghost.position.x - this.playerPos.x,
        this.ghost.position.z - this.playerPos.z
      );
      const dangerLevel = this.ghost.state === 'chasing' ? Math.max(0.35, 1 - ghostDist / 18) : Math.max(0, 1 - ghostDist / 14) * 0.35;
      this.audio.setTensionLevel(dangerLevel);

      this._detectTargetObject();
      this.ecgPhase += dt * (1.5 + dangerLevel * 4.5);

      // Kirim telemetri ke UI HUD
      this.ui.updateHud({
        elapsedTime: this.elapsedTime,
        keysFound: this.keysFound,
        room: getRoomAt(this.playerPos.x, this.playerPos.z),
        playerPos: this.playerPos,
        yaw: this.yaw,
        targetedObject: this.targetedObject,
        isHiddenInCloset: this.isHiddenInCloset,
        closetPauseRemaining: this.ghost.pauseTimer,
        ghost: this.ghost,
        drawers: this.world.drawerObjects,
        closets: this.world.closetObjects,
        dangerLevel,
        ecgPhase: this.ecgPhase
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}
