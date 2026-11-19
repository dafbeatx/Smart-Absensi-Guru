const STORAGE_QUIZ_KEY = 'rumah_sunyi_teacher_quiz_v2';

export const QUIZ_PRESETS = {
  informatika: {
    subject: 'Informatika',
    questions: [
      {
        q: 'Perangkat keras yang berfungsi sebagai otak pemroses utama instruksi pada komputer disebut...',
        options: ['CPU (Central Processing Unit)', 'RAM (Random Access Memory)', 'Hard Disk Drive', 'Power Supply Unit'],
        answer: 0
      },
      {
        q: 'Bilangan biner 1010 jika dikonversi ke dalam sistem bilangan desimal bernilai...',
        options: ['8', '10', '12', '14'],
        answer: 1
      },
      {
        q: 'Urutan langkah logis dan sistematis untuk menyelesaikan suatu masalah pemrograman disebut...',
        options: ['Algoritma', 'Kompilator', 'Topologi', 'Enkripsi'],
        answer: 0
      }
    ]
  },
  matematika: {
    subject: 'Matematika',
    questions: [
      {
        q: 'Jika 3x + 7 = 22, maka nilai x yang memenuhi persamaan tersebut adalah...',
        options: ['3', '4', '5', '6'],
        answer: 2
      },
      {
        q: 'Sebuah segitiga siku-siku memiliki panjang sisi tegak 6 cm dan 8 cm. Panjang sisi miringnya adalah...',
        options: ['10 cm', '12 cm', '14 cm', '15 cm'],
        answer: 0
      },
      {
        q: 'Hasil dari 2^4 + 3^2 adalah...',
        options: ['17', '21', '25', '27'],
        answer: 2
      }
    ]
  },
  ipa: {
    subject: 'IPA Terpadu',
    questions: [
      {
        q: 'Perubahan wujud benda dari gas langsung menjadi padat tanpa melalui fase cair disebut...',
        options: ['Menyublim', 'Mengkristal (Deposisi)', 'Mengembun', 'Membeku'],
        answer: 1
      },
      {
        q: 'Organel sel tumbuhan yang berperan utama dalam proses fotosintesis adalah...',
        options: ['Mitokondria', 'Ribosom', 'Kloroplas', 'Lisosom'],
        answer: 2
      },
      {
        q: 'Satuan Internasional (SI) untuk besaran gaya adalah...',
        options: ['Joule', 'Watt', 'Pascal', 'Newton'],
        answer: 3
      }
    ]
  },
  ips: {
    subject: 'IPS',
    questions: [
      {
        q: 'Garis khayal yang membagi bumi menjadi belahan bumi utara dan belahan bumi selatan adalah...',
        options: ['Garis Bujur 0°', 'Garis Khatulistiwa (Ekuator)', 'Garis Balik Utara', 'Garis Tanggal Internasional'],
        answer: 1
      },
      {
        q: 'Peristiwa Rengasdengklok terjadi pada tanggal 16 Agustus 1945 dengan tujuan utama untuk...',
        options: [
          'Menyusun teks Undang-Undang Dasar',
          'Menjauhkan Soekarno-Hatta dari pengaruh Jepang agar segera memproklamasikan kemerdekaan',
          'Membentuk Badan Keamanan Rakyat',
          'Menyambut kedatangan pasukan Sekutu'
        ],
        answer: 1
      },
      {
        q: 'Kegiatan menyalurkan barang dan jasa dari produsen kepada konsumen disebut...',
        options: ['Produksi', 'Konsumsi', 'Distribusi', 'Investasi'],
        answer: 2
      }
    ]
  },
  bahasa: {
    subject: 'Bahasa Indonesia',
    questions: [
      {
        q: 'Penulisan kata baku yang sesuai dengan Kamus Besar Bahasa Indonesia (KBBI) adalah...',
        options: ['Aktifitas', 'Apotik', 'Analisis', 'Resiko'],
        answer: 2
      },
      {
        q: 'Majas yang memberikan sifat-sifat manusia kepada benda mati disebut majas...',
        options: ['Hiperbola', 'Personifikasi', 'Metafora', 'Litotes'],
        answer: 1
      },
      {
        q: 'Bagian struktur teks eksplanasi yang berisi gambaran umum tentang fenomena yang dibahas adalah...',
        options: ['Pernyataan umum', 'Deretan penjelas', 'Interpretasi', 'Orientasi'],
        answer: 0
      }
    ]
  }
};

export function loadTeacherQuiz() {
  try {
    const raw = localStorage.getItem(STORAGE_QUIZ_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.subject && Array.isArray(parsed.questions) && parsed.questions.length === 3) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca soal dari localStorage:', e);
  }
  return JSON.parse(JSON.stringify(QUIZ_PRESETS.informatika));
}

export function saveTeacherQuiz(quizData) {
  try {
    localStorage.setItem(STORAGE_QUIZ_KEY, JSON.stringify(quizData));
  } catch (e) {
    console.warn('Gagal menyimpan soal ke localStorage:', e);
  }
}
