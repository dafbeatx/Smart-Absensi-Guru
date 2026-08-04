import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { ApprovalEngine } from '../../../services/approval-engine.service';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import type { LeaveRequest } from '../../../types/database.types';

export interface PendingApprovalWidgetProps {
  requests?: LeaveRequest[];
  onRefresh?: () => void;
}

export const PendingApprovalWidget: React.FC<PendingApprovalWidgetProps> = ({
  requests = [],
  onRefresh,
}) => {
  const { user, token } = useAuthStore();
  const { showToast } = useToastStore();

  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenAction = (req: LeaveRequest, action: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req);
    setActionType(action);
    setNotes('');
    setErrorMsg(null);
  };

  const handleConfirmDecision = async () => {
    if (!selectedRequest || !actionType) return;
    setErrorMsg(null);

    // Validate State Transition
    const actorRole = user?.role || 'KEPSEK';
    const transitionResult = ApprovalEngine.executeStateTransition(
      selectedRequest,
      actionType,
      actorRole,
      notes
    );

    if (!transitionResult.success && transitionResult.error) {
      setErrorMsg(`${transitionResult.error.message} ${transitionResult.error.solution}`);
      return;
    }

    setIsLoading(true);

    try {
      await LeaveRepository.approveLeave(
        selectedRequest.id,
        actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        notes,
        token || 'MOCK_TOKEN'
      );

      showToast(
        'success',
        'Keputusan Disimpan!',
        `Pengajuan berhasil di-${actionType === 'APPROVE' ? 'setujui' : 'tolak'}.`
      );

      setIsLoading(false);
      setSelectedRequest(null);
      setActionType(null);
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan keputusan approval';
      setErrorMsg(msg);
    }
  };

  const defaultMockRequests: LeaveRequest[] = [
    {
      id: 'req_mock_1',
      user_id: 'Ahmad Fauzi, S.Pd',
      leave_type: 'SAKIT',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: 'Demam Tinggi & Flu Berat (Ada Surat Dokter)',
      attachment_url: null,
      approval_status: 'PENDING',
      approval_deadline: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'req_mock_2',
      user_id: 'Siti Nurhaliza, S.Pd',
      leave_type: 'IZIN',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: 'Urusan Keluarga Kandung',
      attachment_url: null,
      approval_status: 'PENDING',
      approval_deadline: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'req_mock_3',
      user_id: 'Dedi Kurniawan, S.Pd',
      leave_type: 'DINAS_LUAR',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      reason: 'Pendampingan Lomba OSN Tingkat Kabupaten',
      attachment_url: null,
      approval_status: 'PENDING',
      approval_deadline: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  const displayRequests = requests.length > 0 ? requests : defaultMockRequests;

  if (displayRequests.length === 0) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center space-y-2">
        <span className="text-3xl">🎉</span>
        <h4 className="font-extrabold text-slate-800 text-sm">Semua Pengajuan Telah Diproses</h4>
        <p className="text-xs text-slate-400">Tidak ada pengajuan izin/sakit yang menunggu persetujuan Anda saat ini.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-card space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span>⚠️ Menunggu Persetujuan Anda</span>
            <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {displayRequests.length}
            </span>
          </h3>
        </div>

        <div className="space-y-3">
          {displayRequests.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">Guru ID: {req.user_id}</h4>
                  <Badge status="IZIN">{req.leave_type}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {req.reason} • {req.start_date} s/d {req.end_date}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenAction(req, 'APPROVE')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  ✓ Setujui
                </button>
                <button
                  onClick={() => handleOpenAction(req, 'REJECT')}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-300 active:scale-95 transition-all"
                >
                  Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kepsek Decision Modal */}
      <Modal
        isOpen={Boolean(selectedRequest && actionType)}
        onClose={() => setSelectedRequest(null)}
        title={actionType === 'APPROVE' ? '🟢 Konfirmasi Persetujuan Izin' : '🔴 Konfirmasi Penolakan Izin'}
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
              ⚠️ {errorMsg}
            </div>
          )}

          <p className="text-xs text-slate-600">
            Anda akan memproses pengajuan ketidakhadiran{' '}
            <span className="font-bold text-slate-900">{selectedRequest?.leave_type}</span> untuk tanggal{' '}
            <span className="font-bold text-slate-900">{selectedRequest?.start_date}</span>.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Catatan Kepsek / Alasan Penolakan {actionType === 'REJECT' && '(Wajib Min 5 Karakter)'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={actionType === 'REJECT' ? 'Tuliskan alasan penolakan pengajuan...' : 'Catatan tambahan (opsional)...'}
              className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" className="w-1/2" onClick={() => setSelectedRequest(null)}>
              Batal
            </Button>
            <Button
              variant={actionType === 'APPROVE' ? 'primary' : 'danger'}
              className="w-1/2"
              isLoading={isLoading}
              onClick={handleConfirmDecision}
            >
              {actionType === 'APPROVE' ? 'Ya, Setujui' : 'Ya, Tolak'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
