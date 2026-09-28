"use client";

import React, { createContext, useContext } from 'react';

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
}

const AdminSessionContext = createContext<AdminSession | null>(null);

export function AdminSessionProvider({ children, session }: { children: React.ReactNode; session: AdminSession }) {
  return <AdminSessionContext.Provider value={session}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error('useAdminSession must be used within an AdminSessionProvider');
  }
  return context;
}