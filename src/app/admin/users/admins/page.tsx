"use client";

import React, { useState, useEffect, useTransition } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Trash2,
  CheckCircle2,
  Mail,
  Phone,
  Lock,
  User,
  Key,
  Users,
} from 'lucide-react';
import {
  getAdminUsersList,
  createAdminUserAction,
  deleteUserAction,
  resetUserPasswordAction,
} from '../../../../actions/userManagementActions';

export default function AdminAdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal State: Tambah Admin Baru
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'SUPERADMIN'>('ADMIN');

  // Modal State: Reset Password
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const fetchAdmins = async () => {
    setLoading(true);
    const res = await getAdminUsersList(search);
    if (res.success) {
      setAdmins(res.admins);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAdmins();
  };

  // Submit Create Admin User
  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      alert('Nama, email, dan kata sandi wajib diisi.');
      return;
    }

    startTransition(async () => {
      const res = await createAdminUserAction({
        name: newName,
        email: newEmail,
        phone: newPhone,
        password: newPassword,
        role: newRole,
        unitNotes: newNotes,
      });

      if (res.success) {
        showToast(
          `Petugas admin "${newName}" (${newRole}) berhasil ditambahkan!`
        );
        setIsCreateModalOpen(false);
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setNewPassword('');
        setNewNotes('');
        setNewRole('ADMIN');
        fetchAdmins();
      } else {
        alert(res.error || 'Gagal menambahkan admin baru.');
      }
    });
  };

  // Submit Reset Password
  const handleConfirmResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetPasswordVal) return;

    startTransition(async () => {
      const res = await resetUserPasswordAction(resetTargetUser.id, resetPasswordVal);
      if (res.success) {
        showToast(`Kata sandi untuk "${resetTargetUser.name}" berhasil direset.`);
        setResetTargetUser(null);
        setResetPasswordVal('');
      } else {
        alert(res.error || 'Gagal mereset kata sandi.');
      }
    });
  };

  // Delete User
  const handleDeleteUser = (u: any) => {
    if (!confirm(`Hapus akun admin "${u.name}" (${u.email})?`)) return;

    startTransition(async () => {
      const res = await deleteUserAction(u.id);
      if (res.success) {
        showToast(`Akun admin "${u.name}" berhasil dihapus.`);
        fetchAdmins();
      } else {
        alert(res.error || 'Gagal menghapus admin.');
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-xs font-bold text-emerald-700 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Navigation Tabs (Admin vs User Penyewa) */}
      <div className="flex border-b border-line">
        <a
          href="/admin/users/admins"
          className="flex items-center gap-2 border-b-2 border-purple-500 pb-3 px-4 text-xs font-black text-purple-700"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Kelola Petugas Admin ({admins.length})</span>
        </a>
        <a
          href="/admin/users/customers"
          className="flex items-center gap-2 border-b-2 border-transparent pb-3 px-4 text-xs font-bold text-fg-muted hover:text-fg transition"
        >
          <Users className="h-4 w-4" />
          <span>Data User Penyewa (Customer)</span>
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2">
            <span>Daftar Petugas Administrator DISBUDPORA</span>
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Manajemen hak akses staf loket, admin verifikasi mutasi, dan superadmin Kabupaten Bekasi.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-purple-600/20 hover:from-purple-500 hover:to-indigo-500 transition"
        >
          <UserPlus className="h-4 w-4" />
          <span>Tambah Petugas Admin Baru</span>
        </button>
      </div>

      {/* Search */}
      <div className="rounded-3xl border border-line bg-surface p-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <input
            type="text"
            placeholder="Cari nama atau email petugas admin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-line-strong bg-field py-2 pl-10 pr-4 text-xs font-semibold text-fg placeholder-slate-400 outline-none focus:border-purple-500"
          />
        </form>
      </div>

      {/* Admins Table */}
      <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xl shadow-slate-200/60 backdrop-blur-xl">
        {loading ? (
          <div className="py-20 text-center text-xs font-bold text-fg-faint">
            Memuat data petugas admin...
          </div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-xs text-fg-muted">
            Tidak ada petugas admin yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-field text-[11px] font-extrabold uppercase text-fg-muted">
                <tr>
                  <th className="p-4">Petugas Administrator</th>
                  <th className="p-4">Email Kedinasan</th>
                  <th className="p-4">No. WhatsApp / HP</th>
                  <th className="p-4">Tingkat Hak Akses</th>
                  <th className="p-4">Tanggal Registrasi</th>
                  <th className="p-4 text-right">Aksi Superadmin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-medium">
                {admins.map((u) => {
                  const isPrimary = u.id === 'admin-1';
                  return (
                    <tr key={u.id} className="hover:bg-surface-soft transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-black text-xs shadow-md shadow-purple-600/20">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-fg flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isPrimary && (
                                <span className="rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 text-[9px] font-black">
                                  Super Admin Utama
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-fg-muted">DISBUDPORA Kab. Bekasi</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-mono text-fg-subtle text-[11px]">{u.email}</td>

                      <td className="p-4 font-mono text-fg-subtle text-[11px]">{u.phone || '-'}</td>

                      <td className="p-4">
                        {u.role === 'SUPERADMIN' ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-bold text-amber-700">
                            <ShieldCheck className="h-3 w-3" />
                            SUPERADMIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1 text-[10px] font-bold text-purple-700">
                            <Users className="h-3 w-3" />
                            ADMIN
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-fg-muted text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setResetTargetUser(u);
                              setResetPasswordVal('');
                            }}
                            className="flex items-center gap-1 rounded-lg border border-line-strong bg-subtle px-2.5 py-1 text-[10px] font-bold text-fg-subtle hover:bg-subtle-strong hover:text-fg"
                          >
                            <Key className="h-3 w-3 text-amber-700" />
                            <span>Reset Password</span>
                          </button>

                          {!isPrimary && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-50"
                              title="Hapus Akun Admin"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: TAMBAH ADMIN BARU */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fg">Tambah Petugas Admin Baru</h3>
                  <p className="text-xs text-fg-muted">DISBUDPORA Kabupaten Bekasi</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-bold text-fg-subtle block mb-1">Nama Lengkap Petugas</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rahmat Hidayat, S.Pd"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-field py-2.5 pl-9 pr-3 text-xs font-semibold text-fg outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-fg-subtle block mb-1">Email Kedinasan / Login</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
                  <input
                    type="email"
                    required
                    placeholder="petugas@sportbekasi.id"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-field py-2.5 pl-9 pr-3 text-xs font-semibold text-fg outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-fg-subtle block mb-1">No. WhatsApp / HP</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-field py-2.5 pl-9 pr-3 text-xs font-semibold text-fg outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-fg-subtle block mb-1">Kata Sandi Akses Awal</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-line-strong bg-field py-2.5 pl-9 pr-3 text-xs font-semibold text-fg outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-fg-subtle block mb-1">
                  Tingkat Hak Akses (Role)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole('ADMIN')}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      newRole === 'ADMIN'
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/30'
                        : 'border-line-strong bg-field hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Users
                        className={`h-3.5 w-3.5 ${
                          newRole === 'ADMIN' ? 'text-purple-700' : 'text-fg-faint'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-black ${
                          newRole === 'ADMIN' ? 'text-purple-700' : 'text-fg-subtle'
                        }`}
                      >
                        ADMIN
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-fg-faint">
                      Kelola venue, jadwal, dan verifikasi pembayaran QRIS. Tidak bisa hapus user.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('SUPERADMIN')}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      newRole === 'SUPERADMIN'
                        ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/30'
                        : 'border-line-strong bg-field hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck
                        className={`h-3.5 w-3.5 ${
                          newRole === 'SUPERADMIN' ? 'text-amber-700' : 'text-fg-faint'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-black ${
                          newRole === 'SUPERADMIN' ? 'text-amber-700' : 'text-fg-subtle'
                        }`}
                      >
                        SUPERADMIN
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-fg-faint">
                      Akses penuh termasuk tambah/hapus petugas dan ubah role akun lain.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-fg-subtle block mb-1">Unit Kerja / Catatan Tugas</label>
                <input
                  type="text"
                  placeholder="Contoh: Petugas Loket Sukatani / Admin QRIS DISBUDPORA"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-500 disabled:opacity-50"
                >
                  {isPending ? 'Menyimpan...' : 'Simpan Petugas Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-slate-200/60">
            <h4 className="text-base font-bold text-fg flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-700" />
              Reset Kata Sandi Petugas
            </h4>
            <p className="mt-1 text-xs text-fg-muted">
              Atur ulang kata sandi login untuk <strong>{resetTargetUser.name}</strong> ({resetTargetUser.email}).
            </p>

            <form onSubmit={handleConfirmResetPassword} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-fg-subtle block mb-1">Kata Sandi Baru</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-field p-2.5 text-xs font-semibold text-fg outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="rounded-xl border border-line-strong px-4 py-2 text-xs font-bold text-fg-muted hover:bg-subtle"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || resetPasswordVal.length < 6}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  Konfirmasi Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
