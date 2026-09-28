import type {
  MeetingMinute,
  CreateMeetingMinuteDTO,
} from '../types/meeting-minutes.types';
import { ProviderFactory } from '../providers/provider-factory';

export const MEETING_MINUTES_STORAGE_KEY = 'smart_absensi_meeting_minutes';
export const MEETING_MINUTES_UPDATED_EVENT = 'smart_absensi_meeting_minutes_updated';

const SEED_MINUTES: MeetingMinute[] = [
  {
    id: 'min_seed_001',
    title: 'Rapat Pleno Persiapan Asesmen Tengah Semester (ASTS) & Ketertiban KBM',
    meetingType: 'KURIKULUM',
    date: '2026-09-24',
    startTime: '13:00',
    endTime: '15:15',
    location: 'Ruang Rapat Utama Lt. 2',
    leaderName: 'Dr. H. Mulyadi, M.Pd (Kepala Sekolah)',
    secretaryName: 'Siti Rahmawati, S.Pd',
    attendeesSummary: 'Seluruh Dewan Guru & Staf Tata Usaha (28 Orang Hadir)',
    roughNotes: `- Rapat dibuka kepsek jam 1 siang
- Bahas ASTS ganjil target mulai 5 oktober
- Kisi-kisi soal dikumpul maks tgl 29 sept pic bu dewi
- Ruang ujian pake 6 rombel smp dan 4 rombel sma
- Pengawas wajib hadir 15 menit sblm sesi 1 (07.45)
- Kartu peserta ujian cetak A4 barcode nisn pic pak rahmat tgl 1 okt
- Siswa yg nunggak spp diarahkan konseling dlu ke ruang bk bkn dilarang ujian
- Disiplin absen guru ditingkatkan, tdk boleh nitip presensi`,
    formattedContent: {
      executiveSummary:
        'Rapat pleno dewan guru mengesahkan persiapan teknis Asesmen Tengah Semester (ASTS) Tahun Ajaran 2026/2027. Seluruh pendidik menyepakati penguatan integritas pelaksanaan ujian, pengumpulan naskah soal tepat waktu, serta pemenuhan hak belajar seluruh peserta didik.',
      agendaPoints: [
        'Finalisasi kalender pelaksanaan Asesmen Tengah Semester (ASTS) Ganjil',
        'Distribusi beban tugas pengawas ruang ujian SMP dan SMA',
        'Penetapan batas akhir pengumpulan naskah dan kisi-kisi soal evaluasi',
        'Mekanisme pencetakan kartu peserta ujian berbarcode NISN',
        'Kebijakan afirmasi bimbingan konseling bagi siswa dengan kendala administrasi',
      ],
      keyDecisions: [
        'Pelaksanaan ASTS Ganjil resmi dimulai serentak pada tanggal 5 Oktober 2026.',
        'Seluruh pengawas ujian wajib hadir di ruang piket 15 menit sebelum sesi dimulai (pukul 07.45 WIB).',
        'Peserta didik yang memiliki kendala administrasi SPP tetap berhak mengikuti ujian melalui pendampingan khusus Guru BK.',
        'Pemberlakuan toleransi keterlambatan kehadiran guru diperketat sesuai sistem Smart Absensi.',
      ],
      actionItems: [
        {
          id: 'act_seed_1',
          task: 'Pengumpulan master naskah soal & kisi-kisi ASTS ke panitia',
          pic: 'Dewi Sartika, M.Pd & Seluruh Guru Mapel',
          deadline: '29 September 2026',
          status: 'PENDING',
        },
        {
          id: 'act_seed_2',
          task: 'Pencetakan dan laminasi Kartu Peserta Ujian format A4 barcode NISN',
          pic: 'Rahmat Hidayat, S.Kom (Sekretariat)',
          deadline: '1 Oktober 2026',
          status: 'IN_PROGRESS',
        },
        {
          id: 'act_seed_3',
          task: 'Penataan denah meja dan penempelan nomor peserta pada 10 ruang ujian',
          pic: 'Tim Sarpras & Guru Piket',
          deadline: '3 Oktober 2026',
          status: 'PENDING',
        },
      ],
      additionalNotes:
        'Seluruh bapak/ibu guru dimohon mencermati jadwal mengawas masing-masing pada fitur Jadwal Mengawas di aplikasi.',
    },
    status: 'PUBLISHED',
    readBy: ['usr_guru_sample'],
    createdByUserId: 'usr_admin_master',
    createdByName: 'Administrator Sekolah',
    createdAt: '2026-09-24T15:30:00.000Z',
    updatedAt: '2026-09-24T15:30:00.000Z',
  },
  {
    id: 'min_seed_002',
    title: 'Rapat Koordinasi Pembinaan Karakter, Poin Disiplin Siswa & Ekstrakurikuler',
    meetingType: 'KESISWAAN',
    date: '2026-09-18',
    startTime: '10:00',
    endTime: '11:45',
    location: 'Ruang Guru Terpadu',
    leaderName: 'Ahmad Fauzi, S.Pd (Wakasek Kesiswaan)',
    secretaryName: 'Nurul Hidayati, S.Pd',
    attendeesSummary: 'Wakasek Kesiswaan, Pembina OSIS, dan Seluruh Wali Kelas 7-12',
    roughNotes: `- Poin kebaikan dan kedisiplinan siswa hrs rutin diisi lewat menu baru
- Wali kelas wajib followup siswa yg punya poin pelanggaran > 30
- Ekstrakurikuler wajib pramuka hari jumat sore jam 14.30
- Lomba FLS2N dan O2SN tingkat rayon seleksi minggu depan pic pak hendra
- Sosialisasi tata tertib seragam sekolah sepatu hitam polos`,
    formattedContent: {
      executiveSummary:
        'Koordinasi kesiswaan menekankan sinkronisasi pencatatan poin kebaikan dan kedisiplinan siswa secara harian di aplikasi oleh seluruh wali kelas dan guru pengajar, guna mewujudkan iklim sekolah yang aman, santun, dan berprestasi.',
      agendaPoints: [
        'Optimalisasi fitur input Poin Kebaikan & Kedisiplinan Siswa di Smart Absensi',
        'Standar Operasional Penanganan Siswa dengan akumulasi pelanggaran tata tertib',
        'Jadwal pembinaan ekstrakurikuler wajib Gerakan Pramuka',
        'Persiapan seleksi kontingen sekolah pada ajang FLS2N dan O2SN tingkat Rayon',
      ],
      keyDecisions: [
        'Wali kelas diwajibkan melakukan pemanggilan orang tua apabila siswa mencapai akumulasi poin minus di atas 30.',
        'Guru mata pelajaran berhak memberikan +5 poin apresiasi kebaikan bagi siswa yang menunjukkan integritas dan keteladanan di kelas.',
        'Kegiatan Pramuka wajib dilaksanakan setiap hari Jumat pukul 14.30 - 16.30 WIB.',
      ],
      actionItems: [
        {
          id: 'act_seed_4',
          task: 'Rekapitulasi berkas rekam disiplin siswa bermasalah untuk konseling khusus',
          pic: 'Guru BK & Seluruh Wali Kelas',
          deadline: '22 September 2026',
          status: 'COMPLETED',
        },
        {
          id: 'act_seed_5',
          task: 'Pendaftaran delegasi siswa untuk seleksi FLS2N & O2SN',
          pic: 'Hendra Setiawan, S.Pd (Pembina OSIS)',
          deadline: '25 September 2026',
          status: 'COMPLETED',
        },
      ],
      additionalNotes:
        'Sinergi komunikasi dengan wali murid diharapkan mengutamakan pendekatan persuasif dan edukatif.',
    },
    status: 'PUBLISHED',
    readBy: ['usr_guru_sample'],
    createdByUserId: 'usr_admin_master',
    createdByName: 'Wakasek Kesiswaan',
    createdAt: '2026-09-18T12:00:00.000Z',
    updatedAt: '2026-09-18T12:00:00.000Z',
  },
];

export class MeetingMinutesRepository {
  /**
   * Retrieves all meeting minutes from persistent storage with fallback seeds
   */
  public static getAllMinutes(): MeetingMinute[] {
    if (typeof window === 'undefined') return SEED_MINUTES;

    try {
      const stored = localStorage.getItem(MEETING_MINUTES_STORAGE_KEY);
      if (stored) {
        const parsed: MeetingMinute[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.sort((a, b) => {
            const dateCmp = b.date.localeCompare(a.date);
            if (dateCmp !== 0) return dateCmp;
            return b.startTime.localeCompare(a.startTime);
          });
        }
      }
    } catch (err) {
      console.warn('Failed to parse meeting minutes from storage:', err);
    }

    // Seed initial demo data
    this.saveToStorage(SEED_MINUTES);
    return SEED_MINUTES;
  }

  /**
   * Get single meeting minute by ID
   */
  public static getMinuteById(id: string): MeetingMinute | null {
    const all = this.getAllMinutes();
    return all.find((m) => m.id === id) || null;
  }

  /**
   * Save (create or update) a meeting minute
   */
  public static async saveMinute(minute: MeetingMinute): Promise<MeetingMinute> {
    const all = this.getAllMinutes();
    const existingIndex = all.findIndex((m) => m.id === minute.id);

    const updatedMinute: MeetingMinute = {
      ...minute,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      all[existingIndex] = updatedMinute;
    } else {
      all.unshift(updatedMinute);
    }

    this.saveToStorage(all);
    this.dispatchUpdateEvent();

    // Async cloud sync if Supabase is active
    this.syncCloudMinute(updatedMinute).catch((err) => {
      console.warn('Async cloud sync error for meeting minute:', err);
    });

    return updatedMinute;
  }

  /**
   * Create a new minute from DTO
   */
  public static async createMinute(
    dto: CreateMeetingMinuteDTO,
    authorUser: { id: string; full_name?: string }
  ): Promise<MeetingMinute> {
    const nowIso = new Date().toISOString();
    const newMinute: MeetingMinute = {
      id: `min_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: dto.title.trim(),
      meetingType: dto.meetingType,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      location: dto.location.trim() || 'Ruang Pertemuan Sekolah',
      leaderName: dto.leaderName.trim() || 'Pimpinan Rapat',
      secretaryName: dto.secretaryName.trim() || authorUser.full_name || 'Notulis',
      attendeesSummary: dto.attendeesSummary?.trim(),
      roughNotes: dto.roughNotes.trim(),
      formattedContent: {
        executiveSummary: dto.formattedContent?.executiveSummary || '',
        agendaPoints: dto.formattedContent?.agendaPoints || [],
        keyDecisions: dto.formattedContent?.keyDecisions || [],
        actionItems: dto.formattedContent?.actionItems || [],
        additionalNotes: dto.formattedContent?.additionalNotes || '',
      },
      status: dto.status || 'PUBLISHED',
      readBy: [authorUser.id], // Creator has read it
      createdByUserId: authorUser.id,
      createdByName: authorUser.full_name || 'Pencatat',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return this.saveMinute(newMinute);
  }

  /**
   * Mark a minute as read by a teacher/user
   */
  public static markAsRead(minuteId: string, userId: string): void {
    if (!userId) return;
    const all = this.getAllMinutes();
    const minute = all.find((m) => m.id === minuteId);
    if (!minute) return;

    if (!minute.readBy) minute.readBy = [];
    if (!minute.readBy.includes(userId)) {
      minute.readBy.push(userId);
      this.saveToStorage(all);
      this.dispatchUpdateEvent();
    }
  }

  /**
   * Toggle action item status (PENDING -> COMPLETED)
   */
  public static toggleActionItem(minuteId: string, actionItemId: string): void {
    const all = this.getAllMinutes();
    const minute = all.find((m) => m.id === minuteId);
    if (!minute || !minute.formattedContent.actionItems) return;

    const item = minute.formattedContent.actionItems.find((a) => a.id === actionItemId);
    if (!item) return;

    item.status = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    minute.updatedAt = new Date().toISOString();

    this.saveToStorage(all);
    this.dispatchUpdateEvent();
  }

  /**
   * Delete a meeting minute by ID
   */
  public static deleteMinute(minuteId: string): boolean {
    const all = this.getAllMinutes();
    const filtered = all.filter((m) => m.id !== minuteId);
    if (filtered.length === all.length) return false;

    this.saveToStorage(filtered);
    this.dispatchUpdateEvent();
    return true;
  }

  /**
   * Export formatted meeting minute as clean text for sharing (WhatsApp / Print)
   */
  public static exportAsText(minute: MeetingMinute): string {
    const f = minute.formattedContent;
    const agendaLines = (f.agendaPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
    const decisionLines = (f.keyDecisions || []).map((k) => `✓ ${k}`).join('\n');
    const actionLines = (f.actionItems || [])
      .map(
        (a) =>
          `[${a.status === 'COMPLETED' ? 'SELESAI' : 'TUGAS'}] ${a.task}\n   • PIC: ${a.pic}${a.deadline ? ` | Target: ${a.deadline}` : ''}`
      )
      .join('\n\n');

    return `*RISALAH RESMI RAPAT SEKOLAH*
*${minute.title.toUpperCase()}*

📅 *Hari / Tanggal:* ${minute.date}
⏰ *Waktu:* ${minute.startTime} - ${minute.endTime} WIB
📍 *Tempat:* ${minute.location}
👤 *Pimpinan Rapat:* ${minute.leaderName}
✍️ *Notulis:* ${minute.secretaryName}
${minute.attendeesSummary ? `👥 *Kehadiran:* ${minute.attendeesSummary}\n` : ''}
━━━━━━━━━━━━━━━━━━━━
📌 *RINGKASAN EKSEKUTIF*
${f.executiveSummary}

📋 *POIN PEMBAHASAN*
${agendaLines || '-'}

⚖️ *KEPUTUSAN RESMI RAPAT*
${decisionLines || '-'}

✅ *TINDAK LANJUT & PENANGGUNG JAWAB (PIC)*
${actionLines || '- Tidak ada tindak lanjut khusus -'}

${f.additionalNotes ? `📝 *CATATAN TAMBAHAN*\n${f.additionalNotes}\n` : ''}━━━━━━━━━━━━━━━━━━━━
_Dicatat resmi melalui Smart Absensi Notulen AI_`;
  }

  // Storage and Event dispatch helpers
  private static saveToStorage(data: MeetingMinute[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MEETING_MINUTES_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save meeting minutes to localStorage:', e);
    }
  }

  private static dispatchUpdateEvent(): void {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent(MEETING_MINUTES_UPDATED_EVENT));
      // Dispatch storage event to notify other browser tabs
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: MEETING_MINUTES_STORAGE_KEY,
        })
      );
    } catch {
      // ignore
    }
  }

  private static async syncCloudMinute(minute: MeetingMinute): Promise<void> {
    try {
      const provider = ProviderFactory.getProvider();
      if ((provider as any).saveMeetingMinute) {
        await (provider as any).saveMeetingMinute(minute);
      }
    } catch {
      // Fallback silently
    }
  }
}
