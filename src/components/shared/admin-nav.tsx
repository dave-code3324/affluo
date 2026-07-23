import { FileUp, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/modules/auth/actions";

const links = [
  { href: "/admin", label: "Vue d’ensemble", icon: LayoutDashboard },
  { href: "/admin/imports", label: "Imports CSV", icon: FileUp },
  { href: "/admin/review", label: "Qualification", icon: ShieldCheck },
];

export function AdminNav({ email }: { email: string }) {
  return (
    <aside className="bg-navy text-ivory flex w-full flex-col px-5 py-5 lg:fixed lg:inset-y-0 lg:w-72 lg:px-7 lg:py-8">
      <div>
        <Link href="/admin" className="font-serif text-3xl">
          Affluo
        </Link>
        <p className="text-gold mt-2 text-xs tracking-[0.18em] uppercase">
          Administration interne
        </p>
      </div>

      <nav
        aria-label="Navigation d’administration"
        className="mt-6 flex gap-2 overflow-x-auto lg:mt-12 lg:flex-1 lg:flex-col"
      >
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="text-ivory/70 hover:text-ivory focus-visible:ring-gold flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition hover:bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icon aria-hidden="true" className="text-gold size-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-5 hidden border-t border-white/10 pt-5 lg:block">
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
