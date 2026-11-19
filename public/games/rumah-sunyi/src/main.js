import { QUIZ_PRESETS, loadTeacherQuiz, saveTeacherQuiz } from './data/quizPresets.js';
import { DIFFICULTY_CONFIG, getBestTimes, formatTime } from './data/mansionLayout.js';
import { HorrorGameEngine } from './game/HorrorGameEngine.js';

let selectedDiff = 'normal';
let stickOnRight = false;
let teacherQuiz = loadTeacherQuiz();
let activeQuizQuestion = null;

// Referensi Elemen UI
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');
const hud = document.getElementById('hud');
const reticle = document.getElementById('reticle');
const dangerPulse = document.getElementById('danger-pulse');
const alertBanner = document.getElementById('alert-banner');
const toastMsg = document.getElementById('toast-msg');
const closetOverlay = document.getElementById('closet-overlay');
const closetTimerText = document.getElementById('closet-timer-text');

const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');
const ecgCanvas = document.getElementById('ecg-canvas');
const ecgCtx = ecgCanvas.getContext('2d');

let toastTimeout = null;
function showToast(text) {
  toastMsg.textContent = text;
  toastMsg.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastMsg.classList.remove('show'), 2800);
}

// Inisialisasi Mesin Gim 3D
const engine = new HorrorGameEngine(document.getElementById('game-canvas'), {
  showToast,
  onSessionStarted: () => {
    document.body.classList.remove('in-closet');
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    hud.classList.add('active');
    closetOverlay.classList.remove('visible');
    showToast('Gunakan kompas di atas untuk menemukan 3 laci berisi Kunci Kuningan!');
  },
  setClosetOverlay: (visible, remaining) => {
    if (visible) {
      document.body.classList.add('in-closet');
      closetOverlay.classList.add('visible');
      closetTimerText.textContent = `${remaining.toFixed(1)} dtk`;
      alertBanner.classList.remove('visible');
      dangerPulse.classList.remove('active');
    } else {
      document.body.classList.remove('in-closet');
      closetOverlay.classList.remove('visible');
    }
  },
  openQuizModal: (subject, keyNumber, questionObj) => {
    activeQuizQuestion = questionObj;
    document.getElementById('quiz-modal-title').textContent = `UJI KUNCI KUNINGAN #${keyNumber} — ${subject.toUpperCase()}`;
    document.getElementById('quiz-question-text').textContent = questionObj.q;
    document.getElementById('quiz-feedback').textContent = '';

    const optContainer = document.getElementById('quiz-options');
    optContainer.innerHTML = '';

    // Acak urutan tampilan opsi dengan tetap melacak jawaban benar
    const indexedOpts = questionObj.options.map((text, idx) => ({
      text,
      isCorrect: idx === questionObj.answer
    }));
    indexedOpts.sort(() => Math.random() - 0.5);

    const letters = ['A', 'B', 'C', 'D'];
    indexedOpts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt-btn';
      btn.textContent = `${letters[i]}. ${opt.text}`;
      btn.onclick = () => {
        if (opt.isCorrect) {
          engine.resolveQuizAnswer(true);
        } else {
          document.getElementById('quiz-feedback').textContent =
            'Gembok membanting keras! Jawaban belum tepat — urutan opsi diacak ulang, coba lagi!';
          engine.resolveQuizAnswer(false);
          // Re-render urutan baru saat salah
          setTimeout(() => {
            if (engine.isPausedByQuiz && activeQuizQuestion) {
              engine.ui.openQuizModal(subject, keyNumber, activeQuizQuestion);
            }
          }, 420);
        }
      };
      optContainer.appendChild(btn);
    });

    document.getElementById('quiz-modal').classList.add('open');
  },
  closeQuizModal: () => {
    document.getElementById('quiz-modal').classList.remove('open');
    activeQuizQuestion = null;
    engine.audio.stopWaitingQuizBgm();
    if (engine.isPlaying) {
      engine.audio.resumeExploreBgm();
    }
  },
  updateHud: (state) => {
    document.getElementById('hud-timer').textContent = formatTime(state.elapsedTime);

    for (let i = 1; i <= 3; i++) {
      const slot = document.getElementById(`key-slot-${i}`);
      if (state.keysFound >= i) {
        slot.classList.add('found');
        slot.textContent = `Kunci ${i} ✓`;
      } else {
        slot.classList.remove('found');
        slot.textContent = `Kunci ${i}`;
      }
    }

    document.getElementById('hud-room-name').textContent = `LOKASI: ${state.room.name} (${state.room.wing})`;

    // Panduan Misi Kontekstual untuk Siswa
    const guideEl = document.getElementById('hud-mission-guide');
    if (state.ghost.state === 'chasing') {
      guideEl.textContent = 'BAHAYA! Mata hantu melihatmu — segera masuk ke [LEMARI] terdekat!';
    } else if (state.keysFound >= 3) {
      guideEl.textContent = '3 Kunci lengkap! Ikuti penanda [PINTU KELUAR] di Serambi Utama!';
    } else {
      const remainingWings = [
        ...new Set(
          state.drawers
            .filter((d) => d.hasKey && !d.keyCollected)
            .map((d) => d.spot.wing)
        )
      ];
      guideEl.textContent = `Cari ${3 - state.keysFound} kunci lagi (tersisa di: ${remainingWings.join(', ')}) • Ketuk laci 2×`;
    }

    // Peringatan Penglihatan Mata Hantu
    if (state.ghost.state === 'chasing') {
      alertBanner.classList.add('visible');
      dangerPulse.classList.add('active');
    } else {
      alertBanner.classList.remove('visible');
      dangerPulse.classList.remove('active');
    }

    if (state.isHiddenInCloset) {
      if (!document.body.classList.contains('in-closet')) {
        document.body.classList.add('in-closet');
      }
      if (!closetOverlay.classList.contains('visible')) {
        closetOverlay.classList.add('visible');
      }
      closetTimerText.textContent = `${Math.max(0, state.closetPauseRemaining).toFixed(1)} dtk`;
      return;
    } else if (document.body.classList.contains('in-closet')) {
      document.body.classList.remove('in-closet');
      closetOverlay.classList.remove('visible');
    }

    // Reticle & Tombol Aksi Kontekstual PID
    const actionBtn = document.getElementById('pid-action-btn');
    if (state.targetedObject) {
      reticle.classList.add('interactive');
      actionBtn.classList.remove('disabled');
      const t = state.targetedObject;
      if (t.interactType === 'drawer') {
        if (t.ref.tapStage === 0) actionBtn.textContent = '1× Ketuk: Buka Celah Laci';
        else if (t.ref.tapStage === 1) actionBtn.textContent = '2× Ketuk: Geledah Isi Laci';
        else actionBtn.textContent = 'Laci Sudah Digeledah';
      } else if (t.interactType === 'closet') {
        actionBtn.textContent = 'Masuk Sembunyi ke Lemari';
      } else if (t.interactType === 'exit_door') {
        actionBtn.textContent =
          state.keysFound >= 3 ? 'Buka Pintu Keluar Utama!' : `Pintu Terkunci (${state.keysFound}/3)`;
      }
    } else {
      reticle.classList.remove('interactive');
      actionBtn.classList.add('disabled');
      actionBtn.textContent = 'Dekati Objek Interaktif';
    }

    renderCompass(state);
    renderMinimap(state);
    renderEcg(state.ecgPhase, state.dangerLevel);
  },
  showEndScreen: (won, elapsed, best, isNewRecord, keysFound) => {
    document.body.classList.remove('in-closet');
    hud.classList.remove('active');
    closetOverlay.classList.remove('visible');
    alertBanner.classList.remove('visible');
    dangerPulse.classList.remove('active');
    endScreen.classList.remove('hidden');

    const stamp = document.getElementById('end-stamp');
    const title = document.getElementById('end-title');
    const desc = document.getElementById('end-desc');

    if (won) {
      stamp.className = 'stamp-badge stamp-win';
      stamp.textContent = 'MISI BERHASIL • SELAMAT KELUAR';
      title.textContent = 'Pintu Utama Berhasil Dibuka!';
      desc.textContent = isNewRecord
        ? `Luar biasa! Kamu mencetak REKOR WAKTU TERCEPAT baru pada tingkat ${DIFFICULTY_CONFIG[selectedDiff].label}.`
        : 'Ketiga Kunci Kuningan berhasil dikumpulkan dan dijawab dengan tepat.';
    } else {
      stamp.className = 'stamp-badge stamp-lose';
      stamp.textContent = 'INVESTIGASI GAGAL • TERTANGKAP';
      title.textContent = 'Sosok Bayangan Pucat Menangkapmu';
      desc.textContent =
        'Ingat: hantu baru bergerak jika matanya melihatmu. Matikan senter saat terdesak dan segera bersembunyi di lemari berjalusi.';
    }

    document.getElementById('stat-time').textContent = formatTime(elapsed);
    document.getElementById('stat-keys').textContent = `${keysFound} / 3`;
    document.getElementById('stat-best').textContent = best !== null ? formatTime(best) : formatTime(getBestTimes()[selectedDiff]);
    refreshBestTimeBadges();
  }
});

// Render Kompas Arah Dinamis
function renderCompass(state) {
  const bar = document.getElementById('compass-bar');
  bar.querySelectorAll('.compass-marker').forEach((el) => el.remove());

  const targets = [];

  // 1. Kunci terdekat yang belum diambil
  let nearestKey = null;
  let nearestKeyDist = Infinity;
  for (const d of state.drawers) {
    if (d.hasKey && !d.keyCollected) {
      const dist = Math.hypot(d.spot.x - state.playerPos.x, d.spot.z - state.playerPos.z);
      if (dist < nearestKeyDist) {
        nearestKeyDist = dist;
        nearestKey = d.spot;
      }
    }
  }
  if (nearestKey) {
    targets.push({
      label: `[KUNCI ${Math.round(nearestKeyDist)}m]`,
      x: nearestKey.x,
      z: nearestKey.z,
      cls: 'marker-key'
    });
  }

  // 2. Lemari terdekat
  let nearestCloset = null;
  let nearestClosetDist = Infinity;
  for (const c of state.closets) {
    const dist = Math.hypot(c.spot.x - state.playerPos.x, c.spot.z - state.playerPos.z);
    if (dist < nearestClosetDist) {
      nearestClosetDist = dist;
      nearestCloset = c.spot;
    }
  }
  if (nearestCloset) {
    targets.push({
      label: `[LEMARI ${Math.round(nearestClosetDist)}m]`,
      x: nearestCloset.x,
      z: nearestCloset.z,
      cls: 'marker-closet'
    });
  }

  // 3. Pintu Keluar Utama (x: 0, z: 15.65)
  const exitDist = Math.hypot(0 - state.playerPos.x, 15.65 - state.playerPos.z);
  targets.push({
    label: `[PINTU KELUAR ${Math.round(exitDist)}m]`,
    x: 0,
    z: 15.65,
    cls: state.keysFound >= 3 ? 'marker-exit ready' : 'marker-exit'
  });

  targets.forEach((t) => {
    const dx = t.x - state.playerPos.x;
    const dz = t.z - state.playerPos.z;
    const worldAngle = Math.atan2(-dx, -dz);
    let relAngle = ((worldAngle - state.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (relAngle < -Math.PI) relAngle += Math.PI * 2;

    const clamped = Math.max(-1.25, Math.min(1.25, relAngle));
    const pct = 50 - (clamped / 1.25) * 44;

    const el = document.createElement('div');
    el.className = `compass-marker ${t.cls}`;
    el.style.left = `${pct}%`;
    el.textContent = t.label;
    bar.appendChild(el);
  });
}

// Render Denah Cetak Biru 9 Ruangan
function renderMinimap(state) {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  minimapCtx.clearRect(0, 0, w, h);

  minimapCtx.fillStyle = '#120f0c';
  minimapCtx.fillRect(0, 0, w, h);

  const toMapX = (wx) => ((wx + 18) / 36) * (w - 16) + 8;
  const toMapY = (wz) => ((wz + 16) / 32) * (h - 16) + 8;

  // Grid 9 ruangan
  minimapCtx.strokeStyle = 'rgba(201, 154, 69, 0.42)';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(8, 8, w - 16, h - 16);

  [toMapX(-6), toMapX(6)].forEach((gx) => {
    minimapCtx.beginPath();
    minimapCtx.moveTo(gx, 8);
    minimapCtx.lineTo(gx, h - 8);
    minimapCtx.stroke();
  });

  [toMapY(-5.33), toMapY(5.33)].forEach((gy) => {
    minimapCtx.beginPath();
    minimapCtx.moveTo(8, gy);
    minimapCtx.lineTo(w - 8, gy);
    minimapCtx.stroke();
  });

  // Pintu Keluar Utama
  minimapCtx.fillStyle = state.keysFound >= 3 ? '#eab95c' : '#b52b21';
  minimapCtx.fillRect(toMapX(0) - 8, h - 10, 16, 4);

  // Lemari Persembunyian (titik hijau)
  minimapCtx.fillStyle = '#4a8c5e';
  state.closets.forEach((c) => {
    minimapCtx.fillRect(toMapX(c.spot.x) - 2, toMapY(c.spot.z) - 2, 4, 4);
  });

  // Laci belum dibuka (titik kuning redup)
  state.drawers.forEach((d) => {
    if (d.tapStage < 2) {
      minimapCtx.fillStyle = '#c99a45';
      minimapCtx.beginPath();
      minimapCtx.arc(toMapX(d.spot.x), toMapY(d.spot.z), 2.3, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  });

  // Hantu hanya terlihat di denah jika matanya sedang melihat pemain
  if (state.ghost.seesPlayer) {
    minimapCtx.fillStyle = '#ff3b30';
    minimapCtx.beginPath();
    minimapCtx.arc(toMapX(state.ghost.position.x), toMapY(state.ghost.position.z), 4.2, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  // Posisi & Arah Hadap Pemain
  const px = toMapX(state.playerPos.x);
  const py = toMapY(state.playerPos.z);
  minimapCtx.save();
  minimapCtx.translate(px, py);
  minimapCtx.rotate(-state.yaw);
  minimapCtx.fillStyle = '#dfd6c5';
  minimapCtx.beginPath();
  minimapCtx.moveTo(0, -6);
  minimapCtx.lineTo(4, 4);
  minimapCtx.lineTo(-4, 4);
  minimapCtx.closePath();
  minimapCtx.fill();
  minimapCtx.restore();
}

// Render Monitor Detak Jantung ECG
function renderEcg(phase, dangerLevel) {
  const w = ecgCanvas.width;
  const h = ecgCanvas.height;
  ecgCtx.clearRect(0, 0, w, h);

  ecgCtx.strokeStyle = dangerLevel > 0.35 ? '#e03c30' : '#6bc485';
  ecgCtx.lineWidth = 1.6;
  ecgCtx.beginPath();

  for (let x = 0; x < w; x++) {
    const t = (x / w) * 6 + phase;
    const beat = Math.sin(t * 3.1415);
    const spike = beat > 0.92 ? (beat - 0.92) * 140 : 0;
    const y = h / 2 - spike + Math.sin(t * 2) * 2;
    if (x === 0) ecgCtx.moveTo(x, y);
    else ecgCtx.lineTo(x, y);
  }
  ecgCtx.stroke();
}

// Virtual Joystick Analog Multi-Sentuh
function setupVirtualJoystick() {
  const zone = document.getElementById('joystick-zone');
  const knob = document.getElementById('joystick-knob');
  let joyPointerId = null;
  const maxRadius = 42;

  const updateStick = (clientX, clientY) => {
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    engine.setJoystickInput(dx / maxRadius, dy / maxRadius);
  };

  zone.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (joyPointerId === null) {
      joyPointerId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      updateStick(e.clientX, e.clientY);
    }
  });

  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joyPointerId) return;
    e.stopPropagation();
    updateStick(e.clientX, e.clientY);
  });

  const resetStick = (e) => {
    if (e.pointerId !== joyPointerId) return;
    joyPointerId = null;
    knob.style.transform = 'translate(-50%, -50%)';
    engine.setJoystickInput(0, 0);
  };

  zone.addEventListener('pointerup', resetStick);
  zone.addEventListener('pointercancel', resetStick);
}

// Pengelolaan UI Layar Awal & Editor Soal Guru
function refreshBestTimeBadges() {
  const bests = getBestTimes();
  ['mudah', 'normal', 'sulit'].forEach((id) => {
    const el = document.getElementById(`best-${id}`);
    if (el) el.textContent = `Rekor: ${formatTime(bests[id])}`;
  });
}

function renderQuizPreview() {
  document.getElementById('active-subject-label').textContent = teacherQuiz.subject;
  const list = document.getElementById('quiz-preview-list');
  list.innerHTML = '';
  teacherQuiz.questions.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'quiz-preview-item';
    div.textContent = `Kunci ${idx + 1}: ${item.q}`;
    list.appendChild(div);
  });
}

function populateQuizEditor() {
  document.getElementById('edit-subject').value = teacherQuiz.subject;
  const grid = document.getElementById('editor-questions-grid');
  grid.innerHTML = '';

  teacherQuiz.questions.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'q-edit-card';
    card.innerHTML = `
      <label>PERTANYAAN KUNCI #${idx + 1}</label>
      <textarea rows="2" id="eq-q-${idx}">${item.q}</textarea>
      <label>PILIHAN A</label>
      <input type="text" id="eq-opt-${idx}-0" value="${item.options[0]}" />
      <label>PILIHAN B</label>
      <input type="text" id="eq-opt-${idx}-1" value="${item.options[1]}" />
      <label>PILIHAN C</label>
      <input type="text" id="eq-opt-${idx}-2" value="${item.options[2]}" />
      <label>PILIHAN D</label>
      <input type="text" id="eq-opt-${idx}-3" value="${item.options[3]}" />
      <label>KUNCI JAWABAN BENAR</label>
      <select id="eq-ans-${idx}">
        <option value="0" ${item.answer === 0 ? 'selected' : ''}>Pilihan A</option>
        <option value="1" ${item.answer === 1 ? 'selected' : ''}>Pilihan B</option>
        <option value="2" ${item.answer === 2 ? 'selected' : ''}>Pilihan C</option>
        <option value="3" ${item.answer === 3 ? 'selected' : ''}>Pilihan D</option>
      </select>
    `;
    grid.appendChild(card);
  });
}

function initUiBindings() {
  refreshBestTimeBadges();
  renderQuizPreview();
  populateQuizEditor();
  setupVirtualJoystick();

  // Pilih Tingkat Kesulitan
  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDiff = btn.dataset.diff;
    });
  });

  // Preset Mata Pelajaran Guru
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const key = btn.dataset.preset;
      if (QUIZ_PRESETS[key]) {
        teacherQuiz = JSON.parse(JSON.stringify(QUIZ_PRESETS[key]));
        saveTeacherQuiz(teacherQuiz);
        renderQuizPreview();
        populateQuizEditor();
      }
    });
  });

  // Buka / Tutup Editor Soal Guru
  const editorPanel = document.getElementById('teacher-editor-panel');
  document.getElementById('toggle-editor-btn').addEventListener('click', () => {
    editorPanel.classList.toggle('open');
  });

  document.getElementById('save-quiz-btn').addEventListener('click', () => {
    const subject = document.getElementById('edit-subject').value.trim() || 'Mata Pelajaran';
    const updatedQuestions = [];
    for (let idx = 0; idx < 3; idx++) {
      const q = document.getElementById(`eq-q-${idx}`).value.trim() || `Pertanyaan Kunci #${idx + 1}`;
      const options = [0, 1, 2, 3].map(
        (o) => document.getElementById(`eq-opt-${idx}-${o}`).value.trim() || `Opsi ${o + 1}`
      );
      const answer = parseInt(document.getElementById(`eq-ans-${idx}`).value, 10) || 0;
      updatedQuestions.push({ q, options, answer });
    }
    teacherQuiz = { subject, questions: updatedQuestions };
    saveTeacherQuiz(teacherQuiz);
    renderQuizPreview();
    editorPanel.classList.remove('open');
  });

  // Tukar Posisi Stik Kiri / Kanan
  const touchControls = document.getElementById('touch-controls');
  const swapStickStartBtn = document.getElementById('swap-stick-start-btn');
  const swapStickHudBtn = document.getElementById('swap-stick-hud-btn');

  const toggleStickSide = () => {
    stickOnRight = !stickOnRight;
    touchControls.classList.toggle('stick-right', stickOnRight);
    const label = stickOnRight ? '⇄ Stik Kanan' : '⇄ Stik Kiri';
    swapStickStartBtn.textContent = label;
    swapStickHudBtn.textContent = label;
  };
  swapStickStartBtn.addEventListener('click', toggleStickSide);
  swapStickHudBtn.addEventListener('click', toggleStickSide);

  // Tombol Mulai & Ulangi
  document.getElementById('start-game-btn').addEventListener('click', () => {
    engine.startSession(selectedDiff, teacherQuiz);
  });

  document.getElementById('retry-btn').addEventListener('click', () => {
    engine.startSession(selectedDiff, teacherQuiz);
  });

  document.getElementById('back-menu-btn').addEventListener('click', () => {
    endScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    engine.audio.stopExploreBgm();
    engine.audio.stopWaitingQuizBgm();
    engine.audio.playLobbyBgm();
  });

  // Tombol Kontrol PID dalam Permainan
  document.getElementById('pid-action-btn').addEventListener('click', () => engine.triggerPrimaryAction());
  document.getElementById('pid-turn-btn').addEventListener('click', () => engine.turnAround180());
  document.getElementById('pid-flash-btn').addEventListener('click', () => engine.toggleFlashlight());
  document.getElementById('exit-closet-btn').addEventListener('click', () => engine.exitCloset());

  // Tombol Audio BGM & SFX
  const bgmBtn = document.getElementById('toggle-bgm-btn');
  const sfxBtn = document.getElementById('toggle-sfx-btn');
  bgmBtn.addEventListener('click', () => {
    const on = engine.audio.toggleBgm();
    bgmBtn.classList.toggle('off', !on);
  });
  sfxBtn.addEventListener('click', () => {
    const on = engine.audio.toggleSfx();
    sfxBtn.classList.toggle('off', !on);
  });

  // Memulai BGM lobby begitu pengguna berinteraksi pertama kali (kebijakan autoplay peramban)
  const startLobbyOnInteraction = () => {
    if (!engine.isPlaying && !startScreen.classList.contains('hidden')) {
      engine.audio.playLobbyBgm();
    }
  };
  window.addEventListener('pointerdown', startLobbyOnInteraction, { once: true });
  window.addEventListener('keydown', startLobbyOnInteraction, { once: true });
  window.addEventListener('touchstart', startLobbyOnInteraction, { once: true });
}

initUiBindings();
