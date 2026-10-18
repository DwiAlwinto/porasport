import React from 'react';
import { useApp } from '../../context/AppContext';

export const Footer: React.FC = () => {
  const { setActiveView, t } = useApp();

  return (
    <footer className="border-t border-slate-200 bg-white pt-16 pb-8 text-slate-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Main Footer Links */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 lg:gap-16">
          {/* Logo & Company Info */}
          <div className="space-y-4">
            <div
              onClick={() => {
                setActiveView('HOME');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex cursor-pointer items-center gap-3"
            >
              <img 
                src="/images/logo.png" 
                alt="Sport Bekasi Logo" 
                className="h-14 w-auto object-contain"
              />
              <span className="text-[22px] font-extrabold tracking-tighter text-[#213555] lowercase leading-none">
                disbudpora sport
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {t.footer.tagline}
            </p>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 mb-5">
              {t.footer.products}
            </h3>
            <ul className="space-y-3 text-sm text-slate-500 font-medium">
              <li>
                <button
                  onClick={() => { setActiveView('EXPLORE'); window.scrollTo(0,0); }}
                  className="hover:text-[#05BB75] transition"
                >
                  {t.footer.searchVenues}
                </button>
              </li>
              <li><button className="hover:text-[#05BB75] transition">{t.footer.activities}</button></li>
              <li><button className="hover:text-[#05BB75] transition">{t.footer.community}</button></li>
              <li>
                <a href="/login" className="hover:text-[#05BB75] transition">
                  {t.footer.businessPartner}
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 mb-5">
              {t.footer.support}
            </h3>
            <ul className="space-y-3 text-sm text-slate-500 font-medium">
              <li><button className="hover:text-[#05BB75] transition">{t.footer.faq}</button></li>
              <li><button className="hover:text-[#05BB75] transition">{t.footer.terms}</button></li>
              <li><button className="hover:text-[#05BB75] transition">{t.footer.liveChat}</button></li>
            </ul>
          </div>

          {/* Download App */}
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-900 mb-5">
              {t.footer.downloadApp}
            </h3>
            <p className="text-sm text-slate-500 mb-4 font-medium leading-relaxed">
              {t.footer.downloadSub}
            </p>
            <div className="flex flex-row gap-3">
              <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-black px-3 py-1.5 text-white transition hover:scale-105 hover:shadow-lg">
                <svg viewBox="0 0 512 512" className="h-6 w-6" fill="currentColor">
                  <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" fill="url(#play-gradient)"/>
                  <defs>
                    <linearGradient id="play-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00f0ff"/>
                      <stop offset="50%" stopColor="#00ff00"/>
                      <stop offset="100%" stopColor="#ff0000"/>
                    </linearGradient>
                  </defs>
                  {/* Simplification: using standard colored paths for Play Store */}
                  <path fill="#ea4335" d="M104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                  <path fill="#fbbc04" d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1z"/>
                  <path fill="#4285f4" d="M47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0z"/>
                  <path fill="#34a853" d="M425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8z"/>
                </svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider text-slate-300">GET IT ON</div>
                  <div className="text-sm font-bold leading-tight tracking-wide">Google Play</div>
                </div>
              </button>
              
              <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-black px-3 py-1.5 text-white transition hover:scale-105 hover:shadow-lg">
                <svg viewBox="0 0 384 512" className="h-6 w-6" fill="currentColor">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                <div className="text-left">
                  <div className="text-[9px] uppercase tracking-wider text-slate-300">Download on the</div>
                  <div className="text-sm font-bold leading-tight tracking-wide">App Store</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-slate-200 pt-8 md:flex-row text-sm text-slate-500 font-medium">
          <div className="text-center md:text-left">
            <div className="font-bold text-slate-900 mb-1">DISBUDPORA SPORT</div>
            <div className="text-xs">
              Stadion Wibawa Mukti, Sertajaya, Kec. Cikarang Timur, Kabupaten Bekasi, Jawa Barat 17530
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6">
            <button className="hover:text-[#05BB75] transition">Kebijakan Privasi</button>
            <button className="hover:text-[#05BB75] transition">Legalitas</button>
            <button className="hover:text-[#05BB75] transition">disbudporasport@bekasikab.go.id</button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-900 mr-2">FIND US</span>
            <button className="text-slate-400 hover:text-[#05BB75] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            </button>
            <button className="text-slate-400 hover:text-[#05BB75] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
