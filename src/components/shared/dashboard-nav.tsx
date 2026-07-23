import {
  Clock3,
  LogOut,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/modules/auth/actions";

type DashboardNavProps = {
  email: string;
  firmName: string;
};

const navigation: Array<{
  href: string;
  icon: LucideIcon;
  label: string;
}> = [
  { href: "/dashboard", icon: Sparkles, label: "Opportunités" },
  { href: "/dashboard/history", icon: Clock3, label: "Historique" },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres" },
];

export function DashboardNav({ email, firmName }: DashboardNavProps) {
  return (
    <aside className="bg-navy text-ivory flex w-full flex-col px-5 py-6 lg:fixed lg:inset-y-0 lg:w-72 lg:px-7 lg:py-8">
      <Link href="/dashboard" className="font-serif text-3xl">
        Affluo
      </Link>
      <p className="text-ivory/50 mt-2 truncate text-xs">{firmName}</p>

      <nav className="mt-8 flex gap-2 overflow-x-auto lg:mt-14 lg:flex-1 lg:flex-col">
        {navigation.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="text-ivory/70 hover:text-ivory flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition hover:bg-white/10"
          >
            <Icon aria-hidden="true" className="text-gold size-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 hidden border-t border-white/10 pt-6 lg:block">
        <p className="text-ivory/50 truncate text-xs">{email}</p>
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="text-ivory/70 hover:text-ivory flex items-center gap-2 text-sm font-medium transition"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Se déconnecter
          </button>
        </form>
      </div>
    </aside>
  );
}
