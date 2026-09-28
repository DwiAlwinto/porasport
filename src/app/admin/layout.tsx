import React from 'react';
import { getAdminSession } from '../../actions/authActions';
import { AdminLayoutClient } from '../../components/admin/AdminLayoutClient';

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  return (
    <AdminLayoutClient
      session={{
        userId: session?.userId || '',
        email: session?.email || '',
        name: session?.name || 'Guest',
        role: session?.role || 'GUEST',
      }}
    >
      {children}
    </AdminLayoutClient>
  );
}
