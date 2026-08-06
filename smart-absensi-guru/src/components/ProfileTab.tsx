import React, { useState } from 'react';
import { User, Phone, Mail, Award, BookOpen, Shield, LogOut, Settings, RefreshCw, MapPin, CheckCircle2 } from 'lucide-react';
import { TeacherProfile, SchoolGeofence } from '../types';

interface ProfileTabProps {
  profile: TeacherProfile;
  geofence: SchoolGeofence;
  isSimulatedOutside: boolean;
  onToggleSimulatedLocation: () => void;
  onOpenScheduleModal: () => void;
  onResetData: () => void;
  onUpdateProfile: (updatedProfile: TeacherProfile) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  geofence,
  isSimulatedOutside,
  onToggleSimulatedLocation,
  onOpenScheduleModal,
  onResetData,
  onUpdateProfile
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      name,
      phone,
      email
    });
    setIsEditing(false);
  };

  return (
    <div className="p-5 space-y-4 pb-28">
      
      {/* Header Banner & Photo */}
      <div className="bg-[#023246] text-white p-5 rounded-3xl relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>

        <div className="flex items-center gap-4 relative z-10">
          <img
            src={profile.photoUrl}
            alt={profile.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400 bg-white p-0.5 shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold truncate">{profile.name}</h2>
            <p className="text-[10px] text-emerald-300 font-mono">NIP. {profile.nip}</p>
            <div className="mt-1 inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md text-[9px] font-bold border border-emerald-500/30">
              <span>{profile.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Details / View Form */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-xs font-bold text-[#023246]">Data Diri Pengajar</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[10px] font-bold text-[#0D7A5F] hover:underline"
          >
            {isEditing ? 'Batal' : '✏️ Ubah Kontak'}
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nama Lengkap & Gelar</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">No. Handphone (WhatsApp)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Email Sekolah</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#0D7A5F] text-white rounded-xl text-xs font-bold uppercase shadow-xs"
            >
              Simpan Perubahan
            </button>
          </form>
        ) : (
          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-2.5">
              <Award size={15} className="text-[#0D7A5F]" />
              <div>
                <p className="text-[9px] text-slate-400 font-medium">NUPTK</p>
                <p className="font-mono font-bold text-slate-800">{profile.nuptk}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <BookOpen size={15} className="text-[#0D7A5F]" />
              <div>
                <p className="text-[9px] text-slate-400 font-medium">Mata Pelajaran Utama</p>
                <p className="font-bold text-slate-800">{profile.subject}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Phone size={15} className="text-[#0D7A5F]" />
              <div>
                <p className="text-[9px] text-slate-400 font-medium">Telepon / WhatsApp</p>
                <p className="font-mono font-bold text-slate-800">{profile.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Mail size={15} className="text-[#0D7A5F]" />
              <div>
                <p className="text-[9px] text-slate-400 font-medium">Email Resmi</p>
                <p className="font-mono font-medium text-slate-800">{profile.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sekolah Info Box */}
      <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/70 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#0D7A5F] rounded-lg text-white font-bold text-[10px] flex items-center justify-center">
              AI
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#023246]">{profile.schoolName}</h4>
              <p className="text-[9px] text-slate-500">NPSN: 20211890 | Akreditasi A</p>
            </div>
          </div>
          <span className="text-[9px] font-bold bg-emerald-100 text-[#0D7A5F] px-2 py-0.5 rounded-full">
            Geofence 50m
          </span>
        </div>
        <p className="text-[10px] text-slate-500 leading-snug">
          📍 {geofence.address}
        </p>
      </div>

      {/* Simulation Control Box */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
          <Settings size={14} className="text-[#0D7A5F]" />
          <span>Pengaturan & Simulasi Aplikasi</span>
        </h3>

        <div className="space-y-2">
          {/* Toggle location */}
          <button
            onClick={onToggleSimulatedLocation}
            className={`w-full p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
              isSimulatedOutside
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <div className="text-left">
                <p className="text-xs font-bold">Simulasi Lokasi GPS</p>
                <p className="text-[9px] font-normal opacity-80">
                  {isSimulatedOutside ? 'Posisi: Di Luar Radius (250m)' : 'Posisi: Dalam Radius Sekolah (42m)'}
                </p>
              </div>
            </div>
            <span className="text-[10px] underline">Ubah</span>
          </button>

          {/* Schedule button */}
          <button
            onClick={onOpenScheduleModal}
            className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
          >
            <span>📅 Lihat Roster Jadwal Mengajar</span>
            <span className="text-[10px] text-emerald-700">8 Sesi →</span>
          </button>

          {/* Reset button */}
          <button
            onClick={onResetData}
            className="w-full p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} />
            <span>Reset Data Presensi ke Status Awal</span>
          </button>
        </div>
      </div>

    </div>
  );
};
