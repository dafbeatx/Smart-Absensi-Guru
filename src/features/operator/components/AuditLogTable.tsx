import React, { useState, useEffect } from 'react';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import type { AuditLog } from '../../../types/database.types';
import { AuditLogger } from '../../../services/audit-logger.service';

export interface AuditLogTableProps {
  auditLogs?: AuditLog[];
}

export const AuditLogTable: React.FC<AuditLogTableProps> = ({
  auditLogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>(() => auditLogs || AuditLogger.getLogs());

  useEffect(() => {
    if (auditLogs && auditLogs.length > 0) {
      setLogs(auditLogs);
    } else {
      setLogs(AuditLogger.getLogs());
    }
  }, [auditLogs]);

  useEffect(() => {
    const handleUpdate = () => {
      setLogs(AuditLogger.getLogs());
    };

    window.addEventListener('smart_absensi_audit_log_added', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('smart_absensi_audit_log_added', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const activeLogs = logs;

  const filteredLogs = activeLogs.filter(
    (l) =>
      l.action_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actor_role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.change_reason && l.change_reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.request_id && l.request_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-card space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">📜 Jurnal Audit Log Sistem (Strict Append-Only)</h3>
          <p className="text-xs text-slate-500">Mencatat seluruh perubahan data, reset kredensial, dan keputusan approval.</p>
        </div>

        <Input
          placeholder="Cari Action, Role, atau Reason..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">Waktu & Request ID</th>
              <th className="p-3">Aktor & Role</th>
              <th className="p-3">Aktivitas (Action)</th>
              <th className="p-3">Keterangan / Alasan</th>
              <th className="p-3 text-right">Inspeksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/50">
                <td className="p-3">
                  <p className="font-bold text-slate-900">
                    {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">{log.request_id || '-'}</p>
                </td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    log.actor_role === 'OPERATOR' ? 'bg-blue-100 text-blue-800' : log.actor_role === 'KEPSEK' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {log.actor_role}
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{log.actor_id}</p>
                </td>
                <td className="p-3">
                  <span className="font-bold text-slate-900 font-mono text-[11px]">{log.action_type}</span>
                  <p className="text-[10px] text-slate-400">Target: {log.target_entity}</p>
                </td>
                <td className="p-3 text-slate-700 font-medium">{log.change_reason || '-'}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg transition-colors"
                  >
                    🔍 Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Log Detail Inspector Modal */}
      <Modal isOpen={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title="🔍 Inspeksi Detail Audit Log Entry">
        <div className="space-y-3 font-mono text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">REQUEST ID & TIMESTAMP:</span>
            <p className="font-bold text-slate-900">{selectedLog?.request_id} • {selectedLog?.created_at}</p>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">AKTOR & PERANGKAT:</span>
            <p className="font-bold text-slate-900">{selectedLog?.actor_role} ({selectedLog?.actor_id}) • IP: {selectedLog?.ip_address}</p>
            <p className="text-[11px] text-slate-500">{selectedLog?.device}</p>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">NILAI SEBELUMNYA (BEFORE VALUE):</span>
            <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-xl overflow-x-auto text-[11px]">
              {selectedLog?.before_value || 'NULL'}
            </pre>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">NILAI SESUDAHNYA (AFTER VALUE):</span>
            <pre className="bg-slate-900 text-blue-400 p-2.5 rounded-xl overflow-x-auto text-[11px]">
              {selectedLog?.after_value || 'NULL'}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
};
