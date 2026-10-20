import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ComplaintRepository } from '../../../repositories/ComplaintRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { logger } from '../../../utils/logger.utils';
import type {
  TeacherComplaint,
  ComplaintStatus,
} from '../../../types/database.types';

export interface AnonymousComplaintManagementProps {
  role?: 'ADMIN' | 'KEPSEK';
}

export const AnonymousComplaintManagement: React.FC<AnonymousComplaintManagementProps> = ({
  role = 'ADMIN',
}) => {
  const [complaints, setComplaints] = useState<TeacherComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Response Modal State
  const [selectedComplaint, setSelectedComplaint] = useState<TeacherComplaint | null>(null);
  const [responseText, setResponseText] = useState<string>('');
  const [responseStatus, setResponseStatus] = useState<ComplaintStatus>('RESOLVED');
  const [isSavingResponse, setIsSavingResponse] = useState<boolean>(false);

  // Deletion & Purge Test Data States
  const [complaintToDelete, setComplaintToDelete] = useState<TeacherComplaint | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const { token } = useAuthStore();
  const { showToast } = useToastStore();

  const fetchComplaints = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await ComplaintRepository.getAllComplaints(token || undefined);
      const cleanData = data.filter((c) => !ComplaintRepository.isTestComplaint(c));
      setComplaints(cleanData);
      if (cleanData.length !== data.length) {
        ComplaintRepository.purgeTestComplaints(token || undefined).catch(() => {});
      }
      logger.info('AnonymousComplaintManagement', 'Complaints fetched successfully', { count: cleanData.length });
    } catch (err) {
      logger.error('AnonymousComplaintManagement', 'Failed to fetch complaints:', err);
      showToast('error', 'Gagal Memuat Data', 'Gagal memuat catatan dan keluhan dari server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token, showToast]);

  useEffect(() => {
    // Proactively purge test items from local device storage immediately on mount
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('smart_absensi_teacher_complaints');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((c) => !ComplaintRepository.isTestComplaint(c));
            if (cleaned.length !== parsed.length) {
              localStorage.setItem('smart_absensi_teacher_complaints', JSON.stringify(cleaned));
            }
          }
        }
      }
    } catch {
      // ignore
    }

    fetchComplaints();

    const handleUpdateEvent = () => {
      fetchComplaints(true);
    };

    window.addEventListener('smart_absensi_complaints_updated', handleUpdateEvent);
    window.addEventListener('storage', handleUpdateEvent);

    return () => {
      window.removeEventListener('smart_absensi_complaints_updated', handleUpdateEvent);
      window.removeEventListener('storage', handleUpdateEvent);
    };
  }, [fetchComplaints]);

  // Statistics calculation
  const stats = useMemo(() => {
    const validComplaints = complaints.filter((c) => !ComplaintRepository.isTestComplaint(c));
    const total = validComplaints.length;
    const submitted = validComplaints.filter((c) => c.status === 'SUBMITTED').length;
    const inReview = validComplaints.filter((c) => c.status === 'IN_REVIEW').length;
    const resolved = validComplaints.filter((c) => c.status === 'RESOLVED').length;
    return { total, submitted, inReview, resolved };
  }, [complaints]);

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints
      .filter((item) => !ComplaintRepository.isTestComplaint(item))
      .filter((item) => {
        const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
        const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
        const matchSearch =
          !searchQuery.trim() ||
          item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.admin_response && item.admin_response.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchCat && matchStatus && matchSearch;
      });
  }, [complaints, selectedCategory, selectedStatus, searchQuery]);

  const handleOpenResponseModal = (item: TeacherComplaint) => {
    setSelectedComplaint(item);
    setResponseText(item.admin_response || '');
    setResponseStatus(item.status === 'SUBMITTED' ? 'RESOLVED' : item.status);
  };

  const handleCloseResponseModal = () => {
    if (!isSavingResponse) {
      setSelectedComplaint(null);
      setResponseText('');
    }
  };

  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    const trimmed = responseText.trim();
    if (!trimmed) {
      showToast('warning', 'Tanggapan Kosong', 'Silakan ketikkan tanggapan atau tindakan solusi yang dilakukan.');
      return;
    }

    setIsSavingResponse(true);
    try {
      const currentRole = role === 'KEPSEK' ? 'KEPSEK' : 'ADMIN';
      const success = await ComplaintRepository.updateComplaintStatus(
        {
          complaintId: selectedComplaint.id,
          status: responseStatus,
          adminResponse: trimmed,
          respondedByRole: currentRole,
        },
        token || undefined
      );

      if (success) {
        showToast('success', 'Tanggapan Tersimpan! ✨', 'Tanggapan resmi telah diperbarui dan langsung tampil di HP guru bersangkutan.');
        fetchComplaints(true);
        handleCloseResponseModal();
      } else {
        showToast('error', 'Gagal Memperbarui', 'Catatan tidak ditemukan di sistem.');
      }
    } catch (err) {
      logger.error('AnonymousComplaintManagement', 'Failed to save response:', err);
      showToast('error', 'Gagal Menyimpan Tanggapan', 'Terjadi kesalahan sistem saat memperbarui tanggapan.');
    } finally {
      setIsSavingResponse(false);
    }
  };

  const handleQuickStatusChange = async (item: TeacherComplaint, newStatus: ComplaintStatus) => {
    try {
      const currentRole = role === 'KEPSEK' ? 'KEPSEK' : 'ADMIN';
      await ComplaintRepository.updateComplaintStatus(
        {
          complaintId: item.id,
          status: newStatus,
          respondedByRole: currentRole,
        },
        token || undefined
      );
      showToast('success', 'Status Diperbarui', `Status catatan berhasil diubah menjadi ${ComplaintRepository.STATUS_META[newStatus].label}.`);
      fetchComplaints(true);
    } catch (err) {
      logger.error('AnonymousComplaintManagement', 'Failed to update quick status:', err);
      showToast('error', 'Gagal Mengubah Status', 'Terjadi kesalahan sistem.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!complaintToDelete) return;
    setIsDeleting(true);
    try {
      const ok = await ComplaintRepository.deleteComplaint(complaintToDelete.id, token || undefined);
      if (ok) {
        showToast('success', 'Catatan Berhasil Dihapus! 🗑️', 'Catatan aspirasi telah dihapus permanen.');
        setComplaintToDelete(null);
        fetchComplaints(true);
      } else {
        showToast('error', 'Gagal Menghapus', 'Catatan tidak ditemukan atau sudah terhapus.');
      }
    } catch (err) {
      logger.error('AnonymousComplaintManagement', 'Failed to delete complaint:', err);
      showToast('error', 'Gagal Menghapus', 'Terjadi kesalahan sistem saat menghapus catatan.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePurgeTestComplaints = async () => {
    setIsPurging(true);
    try {
      const purged = await ComplaintRepository.purgeTestComplaints(token || undefined);
      showToast('success', 'Data Test Dibersihkan! 🧹', `Berhasil menghapus ${purged} catatan aspirasi uji coba.`);
      fetchComplaints(true);
    } catch (err) {
      logger.error('AnonymousComplaintManagement', 'Failed to purge test complaints:', err);
      showToast('error', 'Gagal Membersihkan', 'Terjadi kesalahan saat membersihkan data uji coba.');
    } finally {
      setIsPurging(false);
    }
  };

  const testComplaints = useMemo(() => {
    return complaints.filter((c) => ComplaintRepository.isTestComplaint(c));
  }, [complaints]);

  const hasTestComplaints = testComplaints.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── 1. HEADER BANNER & SYNC CONTROL ───────────────────────────── */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-900 border border-amber-300 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
            💬
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-[#023246] text-base sm:text-lg tracking-tight">
                Kotak Aspirasi &amp; Keluhan Guru
              </h2>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black rounded-full shadow-2xs flex items-center gap-1">
                <span>🔒</span>
                <span>100% Anonim</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Pantau laporan sarana prasarana, kendala sistem, serta masukan konstruktif dari dewan guru tanpa mengungkap identitas pengirim.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {hasTestComplaints && (
            <button
              type="button"
              onClick={handlePurgeTestComplaints}
              disabled={isPurging}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl border border-rose-300 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
              title="Hapus seluruh data test/dummy dari kotak aspirasi"
            >
              <span>🧹</span>
              <span>{isPurging ? 'Membersihkan...' : `Hapus Data Test (${testComplaints.length})`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchComplaints(true)}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-[#023246] text-xs font-extrabold rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-2xs"
            title="Perbarui daftar keluhan"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
            <span>{isRefreshing ? 'Memuat...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. METRICS STATS SUMMARY CARDS ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Aspirasi
          </span>
          <p className="text-xl sm:text-2xl font-black text-[#023246] font-mono">
            {stats.total}
          </p>
          <span className="text-[10px] text-slate-400 font-medium block">
            Semua catatan masuk
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-1 bg-amber-50/30">
          <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Menunggu</span>
          </span>
          <p className="text-xl sm:text-2xl font-black text-amber-900 font-mono">
            {stats.submitted}
          </p>
          <span className="text-[10px] text-amber-700 font-medium block">
            Perlu ditinjau
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl border border-sky-200 shadow-2xs space-y-1 bg-sky-50/30">
          <span className="text-[10px] sm:text-[11px] font-bold text-sky-800 uppercase tracking-wider block">
            Sedang Ditinjau
          </span>
          <p className="text-xl sm:text-2xl font-black text-sky-900 font-mono">
            {stats.inReview}
          </p>
          <span className="text-[10px] text-sky-700 font-medium block">
            Dalam proses perbaikan
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-1 bg-emerald-50/30">
          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
            Ditindaklanjuti
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-900 font-mono">
            {stats.resolved}
          </p>
          <span className="text-[10px] text-emerald-700 font-medium block">
            Selesai ditangani
          </span>
        </div>
      </div>

      {/* ── 3. FILTER CONTROLS & SEARCH BAR ───────────────────────────── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer flex-1 sm:flex-none shadow-2xs"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="SARANA_PRASARANA">🏢 Sarana &amp; Fasilitas</option>
            <option value="SISTEM_APLIKASI">📱 Sistem &amp; Aplikasi</option>
            <option value="KEBIJAKAN_MANAJEMEN">📋 Kebijakan &amp; Jadwal</option>
            <option value="KESEJAHTERAAN">🌱 Kesejahteraan Guru</option>
            <option value="LAINNYA">💡 Aspirasi Lainnya</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer flex-1 sm:flex-none shadow-2xs"
          >
            <option value="ALL">Semua Status</option>
            <option value="SUBMITTED">⏳ Menunggu Tinjauan</option>
            <option value="IN_REVIEW">🔍 Sedang Ditinjau</option>
            <option value="RESOLVED">✅ Selesai / Ditindaklanjuti</option>
            <option value="ARCHIVED">📦 Diarsipkan</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci isi keluhan..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] shadow-2xs"
          />
        </div>
      </div>

      {/* ── 4. COMPLAINTS LIST ─────────────────────────────────────────── */}
      <div className="space-y-3.5">
        {isLoading ? (
          <SkeletonList count={4} />
        ) : filteredComplaints.length === 0 ? (
          <EmptyState
            icon="💬"
            title="Tidak Ada Catatan / Keluhan Ditemukan"
            description={
              searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'
                ? 'Tidak ada keluhan yang cocok dengan filter pencarian saat ini.'
                : 'Belum ada aspirasi atau keluhan yang dikirimkan oleh dewan guru.'
            }
          />
        ) : (
          filteredComplaints.map((item) => {
            const catMeta = ComplaintRepository.CATEGORY_META[item.category] || {
              label: item.category,
              emoji: '💡',
              colorClass: 'text-slate-800',
              bgClass: 'bg-slate-100',
              borderClass: 'border-slate-200',
            };
            const statusMeta = ComplaintRepository.STATUS_META[item.status] || {
              label: item.status,
              colorClass: 'text-slate-700',
              bgClass: 'bg-slate-100',
              borderClass: 'border-slate-200',
              badgeStatus: 'DEFAULT' as const,
            };

            const isSubmitted = item.status === 'SUBMITTED';
            const isInReview = item.status === 'IN_REVIEW';

            return (
              <div
                key={item.id}
                className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-card space-y-3 transition-all hover:border-slate-300"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${catMeta.bgClass} ${catMeta.colorClass} ${catMeta.borderClass}`}>
                      <span>{catMeta.emoji}</span>
                      <span>{catMeta.label}</span>
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px] flex items-center gap-1">
                      <span>🔒</span>
                      <span>Pendidik Anonim</span>
                    </span>

                    <span className="text-[11px] font-mono text-slate-400 font-medium">
                      {new Date(item.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      WIB
                    </span>
                  </div>

                  <span className={`px-2.5 py-1 text-xs font-black rounded-xl border shrink-0 ${statusMeta.bgClass} ${statusMeta.colorClass} ${statusMeta.borderClass}`}>
                    {statusMeta.label}
                  </span>
                </div>

                {/* Complaint Content */}
                <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs text-slate-900 font-medium leading-relaxed">
                  "{item.content}"
                </div>

                {/* Existing Official Response Display (If any) */}
                {item.admin_response && (
                  <div className="bg-emerald-50/90 border border-emerald-300/80 p-3.5 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-extrabold text-emerald-950">
                      <span className="flex items-center gap-1.5">
                        <span>💬</span>
                        <span>
                          Tanggapan Resmi ({item.responded_by_role === 'KEPSEK' ? 'Kepala Sekolah' : 'Admin / Manajemen'}):
                        </span>
                      </span>
                      {item.responded_at && (
                        <span className="font-mono text-[10px] text-emerald-800 font-semibold">
                          {new Date(item.responded_at).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                      {item.admin_response}
                    </p>
                  </div>
                )}

                {/* Bottom Action Palette */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isSubmitted && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(item, 'IN_REVIEW')}
                        className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                      >
                        🔍 Tandai Sedang Ditinjau
                      </button>
                    )}

                    {isInReview && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(item, 'RESOLVED')}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                      >
                        ✅ Tandai Selesai
                      </button>
                    )}

                    {item.status !== 'ARCHIVED' && (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(item, 'ARCHIVED')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95"
                      >
                        📦 Arsipkan
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setComplaintToDelete(item)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                      title="Hapus catatan aspirasi ini secara permanen"
                    >
                      <span>🗑️</span>
                      <span className="hidden sm:inline">Hapus</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenResponseModal(item)}
                      className="px-4 py-1.5 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-extrabold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      <span>💬</span>
                      <span>{item.admin_response ? 'Ubah Tanggapan' : 'Beri Tanggapan Resmi'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 5. RESPONSE MODAL ───────────────────────────────────────────── */}
      {selectedComplaint && (
        <Modal
          isOpen={true}
          onClose={handleCloseResponseModal}
          title="💬 Beri Tanggapan Resmi Pihak Sekolah"
          maxWidth="md"
        >
          <form onSubmit={handleSaveResponse} className="space-y-4 pt-1">
            {/* Complaint snippet recap */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>Catatan Guru ({ComplaintRepository.CATEGORY_META[selectedComplaint.category]?.label}):</span>
                <span className="font-mono">{selectedComplaint.date}</span>
              </div>
              <p className="text-slate-800 font-medium italic">
                "{selectedComplaint.content}"
              </p>
            </div>

            {/* Target Status Selector */}
            <div className="space-y-1.5">
              <label htmlFor="target-status" className="text-xs font-extrabold text-slate-800 block">
                Update Status Penanganan:
              </label>
              <select
                id="target-status"
                value={responseStatus}
                onChange={(e) => setResponseStatus(e.target.value as ComplaintStatus)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#0D7A5F]"
              >
                <option value="IN_REVIEW">🔍 Sedang Ditinjau / Dalam Pengerjaan</option>
                <option value="RESOLVED">✅ Selesai / Ditindaklanjuti</option>
                <option value="ARCHIVED">📦 Arsipkan</option>
              </select>
            </div>

            {/* Response Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="response-text" className="text-xs font-extrabold text-slate-800">
                  Isi Tanggapan Resmi (Akan tampil di HP Guru pengirim):
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {responseText.length}/1000
                </span>
              </div>
              <textarea
                id="response-text"
                rows={4}
                maxLength={1000}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Contoh: Terima kasih atas laporannya. Tim sarpras telah memperbaiki proyektor tersebut hari ini..."
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] transition-all resize-none shadow-2xs leading-relaxed"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const toDelete = selectedComplaint;
                  handleCloseResponseModal();
                  setComplaintToDelete(toDelete);
                }}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>🗑️</span>
                <span>Hapus Catatan</span>
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseResponseModal}
                  disabled={isSavingResponse}
                  className="min-h-11 px-4 text-xs font-bold"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSavingResponse || !responseText.trim()}
                  className="min-h-11 px-5 bg-[#0D7A5F] hover:bg-[#095744] text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
                >
                  <span>{isSavingResponse ? 'Menyimpan...' : 'Simpan & Kirim Tanggapan'}</span>
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── 6. DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
      {complaintToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setComplaintToDelete(null)}
          title="🗑️ Konfirmasi Hapus Aspirasi"
          maxWidth="sm"
        >
          <div className="space-y-4 pt-1 text-xs">
            <p className="text-slate-700 leading-relaxed font-medium">
              Apakah Anda yakin ingin menghapus catatan aspirasi ini secara permanen dari sistem sekolah?
            </p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 italic line-clamp-3">
              "{complaintToDelete.content}"
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setComplaintToDelete(null)}
                disabled={isDeleting}
                className="min-h-10 px-4 text-xs font-bold"
              >
                Batal
              </Button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🗑️</span>
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
