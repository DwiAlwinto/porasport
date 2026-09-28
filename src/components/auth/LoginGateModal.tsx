import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, UserPlus, X, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoginGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export const LoginGateModal: React.FC<LoginGateModalProps> = ({
  isOpen,
  onClose,
  message = 'Silakan masuk atau daftar terlebih dahulu untuk melanjutkan.',
}) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all duration-300">
      <div 
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration */}
        <div className="absolute left-0 right-0 top-0 h-32 bg-gradient-to-br from-emerald-500 to-[#05BB75] opacity-20"></div>
        <div className="absolute left-0 right-0 top-0 h-32 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/50 p-2 text-slate-600 backdrop-blur-md transition-all hover:bg-white hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative px-6 pb-6 pt-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-[#05BB75] shadow-lg shadow-emerald-500/30">
            <Lock className="h-8 w-8 text-white" />
          </div>

          <h3 className="mb-2 text-xl font-black text-slate-900 tracking-tight">
            Akses Membutuhkan Login
          </h3>
          
          <p className="mb-8 text-sm text-slate-500 leading-relaxed">
            {message}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/login')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 active:scale-[0.98]"
            >
              <LogIn className="h-4 w-4" />
              Masuk (Login)
            </button>
            
            <button
              onClick={() => router.push('/register')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 px-4 py-3 text-sm font-bold text-emerald-600 transition-all hover:bg-emerald-50 active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              Daftar Akun Baru
            </button>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-5 text-[11px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider"
          >
            Batal
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
