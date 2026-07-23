import { AdminNav } from "@/components/shared/admin-nav";
import { requireAdmin } from "@/lib/permissions/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <AdminNav email={admin.email} />
      <main className="px-5 py-8 sm:px-8 lg:ml-72 lg:px-12 lg:py-12">
        {children}
      </main>
    </div>
  );
}
