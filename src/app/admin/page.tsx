'use client';

import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Mail, 
  Users, 
  LogOut,
  ChevronRight,
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header title="ADMIN" isLive={false} />
      
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Pannello Amministrazione</h2>

        <AdminMenuItem
          href="/admin/mercato"
          icon={Mail}
          title="Mercato"
          description="Importa operazioni da email FMS Revo"
        />

        <AdminMenuItem
          href="/admin/formazioni"
          icon={Users}
          title="Formazioni"
          description="Scarica formazioni da FMS Revo"
        />

        <div className="pt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-white hover:bg-red-50 hover:border-red-200 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <LogOut size={20} className="text-red-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900 group-hover:text-red-700">Logout</div>
              <div className="text-sm text-gray-500">Esci dal pannello admin</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminMenuItem({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
        <Icon size={20} className="text-emerald-600" />
      </div>
      <div className="flex-1">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-500">{description}</div>
      </div>
      <ChevronRight size={20} className="text-gray-400 group-hover:text-emerald-600" />
    </a>
  );
}
