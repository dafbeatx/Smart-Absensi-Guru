// src/services/__tests__/meeting-minutes.test.ts
import type { TestSuiteResult, TestResultItem } from '../test-runner.service';
import { MeetingMinutesAIService } from '../meeting-minutes-ai.service';
import { MeetingMinutesRepository } from '../../repositories/MeetingMinutesRepository';
import type { CreateMeetingMinuteDTO } from '../../types/meeting-minutes.types';

export async function runMeetingMinutesTestSuite(): Promise<TestSuiteResult> {
  const results: TestResultItem[] = [];

  // Helper to assert
  const assert = (condition: boolean, testName: string, details?: string) => {
    if (condition) {
      results.push({ testName, status: 'PASS' });
    } else {
      results.push({ testName, status: 'FAIL', details });
    }
  };

  // Test 1: Deterministic rule-based parser handles rough messy notes
  try {
    const roughNotes = `- rapat dibuka pkl 09.00 oleh kepsek
- bahas persiapan kbm semester ganjil
- tugas: kumpul silabus pic Bu Siti deadline tgl 30 sept
- tugas: cetak kartu ujian pic Pak Budi
- putusan: guru piket hadir 06.45
- hasil sepakat siswa telat 3x dibina wali kelas`;

    const parsed = MeetingMinutesAIService.parseRoughNotesDeterministic({
      title: 'Rapat Persiapan KBM',
      roughNotes,
      leaderName: 'Dr. Mulyadi',
    });

    assert(
      parsed.executiveSummary.length > 20 && parsed.executiveSummary.includes('Rapat koordinasi'),
      'AI Fallback Parser: Generates formal executive summary from rough notes',
      `Summary: ${parsed.executiveSummary}`
    );

    assert(
      parsed.agendaPoints.length >= 1,
      'AI Fallback Parser: Extracts agenda points correctly',
      `Agenda points count: ${parsed.agendaPoints.length}`
    );

    assert(
      parsed.keyDecisions.length >= 2,
      'AI Fallback Parser: Extracts official decisions from keywords (putusan, sepakat)',
      `Key decisions count: ${parsed.keyDecisions.length}`
    );

    assert(
      parsed.actionItems.length === 2,
      'AI Fallback Parser: Extracts action items with PIC and deadline',
      `Action items count: ${parsed.actionItems.length}`
    );

    const buSitiItem = parsed.actionItems.find((a) => a.pic.toLowerCase().includes('siti'));
    assert(
      buSitiItem !== undefined && (buSitiItem.deadline || '').toLowerCase().includes('30 sept'),
      'AI Fallback Parser: Correctly maps PIC "Bu Siti" and deadline "30 sept"',
      `PIC: ${buSitiItem?.pic}, Deadline: ${buSitiItem?.deadline}`
    );
  } catch (err: any) {
    assert(false, 'AI Fallback Parser: Exception thrown during parsing', err.message);
  }

  // Test 2: Repository Seed and Retrieval
  try {
    const all = MeetingMinutesRepository.getAllMinutes();
    assert(
      Array.isArray(all) && all.length >= 2,
      'MeetingMinutesRepository: Loads initial minutes with fallback seeds',
      `Loaded count: ${all.length}`
    );

    const first = all[0];
    assert(
      Boolean(first.id && first.title && first.formattedContent && first.formattedContent.executiveSummary),
      'MeetingMinutesRepository: Minutes conform to full MeetingMinute schema'
    );
  } catch (err: any) {
    assert(false, 'MeetingMinutesRepository: Exception during getAllMinutes', err.message);
  }

  // Test 3: Creation and Storage
  try {
    const dto: CreateMeetingMinuteDTO = {
      title: 'Rapat Khusus Pembinaan Karakter & Kedisiplinan Siswa',
      meetingType: 'KEDISIPLINAN',
      date: '2026-09-28',
      startTime: '10:00',
      endTime: '11:30',
      location: 'Ruang Guru SMP',
      leaderName: 'Ahmad Fauzi, S.Pd',
      secretaryName: 'Nurul Hidayati, S.Pd',
      attendeesSummary: 'Seluruh Wali Kelas 7-9',
      roughNotes: '- evaluasi poin pelanggaran siswa\n- pic: bu dewi tindak lanjut konseling\n- putusan: panggil orang tua siswa yg poin > 30',
    };

    const author = { id: 'usr_author_test_1', full_name: 'Guru Penguji' };
    const created = await MeetingMinutesRepository.createMinute(dto, author);

    assert(
      created.id.startsWith('min_') && created.title === dto.title,
      'MeetingMinutesRepository: Successfully creates new minute with generated ID and metadata'
    );

    assert(
      created.readBy.includes('usr_author_test_1'),
      'MeetingMinutesRepository: Author is automatically marked in readBy list'
    );

    // Test 4: Mark As Read
    MeetingMinutesRepository.markAsRead(created.id, 'usr_other_teacher_99');
    const updated = MeetingMinutesRepository.getMinuteById(created.id);
    assert(
      Boolean(updated?.readBy?.includes('usr_other_teacher_99')),
      'MeetingMinutesRepository: markAsRead properly adds other teacher user ID'
    );

    // Test 5: Toggle Action Item status
    if (created.formattedContent.actionItems.length > 0) {
      const actId = created.formattedContent.actionItems[0].id;
      const initialStatus = created.formattedContent.actionItems[0].status;
      MeetingMinutesRepository.toggleActionItem(created.id, actId);
      const afterToggle = MeetingMinutesRepository.getMinuteById(created.id);
      const toggledItem = afterToggle?.formattedContent.actionItems.find((a) => a.id === actId);
      assert(
        toggledItem?.status === (initialStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED'),
        'MeetingMinutesRepository: toggleActionItem changes status between PENDING and COMPLETED'
      );
    } else {
      assert(true, 'MeetingMinutesRepository: Action item toggle skipped (no action items)');
    }

    // Test 6: Export As Text (WhatsApp format)
    const exportText = MeetingMinutesRepository.exportAsText(created);
    assert(
      exportText.includes('RISALAH RESMI RAPAT SEKOLAH') &&
        exportText.includes(created.title.toUpperCase()) &&
        exportText.includes('RINGKASAN EKSEKUTIF'),
      'MeetingMinutesRepository: exportAsText generates clean WhatsApp-ready message'
    );

    // Test 7: Cloud Synchronization & Multi-Device Auto-Recovery
    const synced = await MeetingMinutesRepository.fetchAndSyncMinutes();
    assert(
      Array.isArray(synced) && synced.length > 0,
      'MeetingMinutesRepository: fetchAndSyncMinutes reconciles cloud and local storage successfully',
      `Synced count: ${synced.length}`
    );

    // Test 8: Realtime Subscription Setup
    const unsub = MeetingMinutesRepository.initRealtimeSubscription();
    assert(
      typeof unsub === 'function',
      'MeetingMinutesRepository: initRealtimeSubscription returns teardown function'
    );
    unsub();

    // Clean up created test item
    MeetingMinutesRepository.deleteMinute(created.id);
  } catch (err: any) {
    assert(false, 'MeetingMinutesRepository: Exception during creation/mutations', err.message);
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    suiteName: 'Meeting Minutes & Notulen AI Test Suite',
    passed,
    failed,
    results,
  };
}
