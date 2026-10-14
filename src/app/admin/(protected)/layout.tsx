/**
 * Protected Admin Layout
 * 
 * Server component that checks admin authentication.
 * Redirects to login if not authenticated.
 */

import { redirect } from 'next/navigation';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/auth/admin';

export const instant = false;

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isAdminConfigured();
  const authenticated = await isAdminAuthenticated();

  // If admin is not configured, allow access (dev mode)
  if (!configured) {
    return <>{children}</>;
  }

  // If admin is configured but not authenticated, redirect to login
  if (!authenticated) {
    redirect('/admin/login');
  }

  return <>{children}</>;
}
