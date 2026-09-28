import { redirect } from 'next/navigation';
import { getAdminSession } from '../actions/authActions';

/**
 * Server Component Guard: Panggil di awal page.tsx admin.
 * Otomatis me-redirect ke /admin/login jika belum login sebagai ADMIN.
 */
export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
    redirect('/admin/login');
  }
  return session;
}
