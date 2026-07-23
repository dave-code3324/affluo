import { DashboardNav } from "@/components/shared/dashboard-nav";
import { requireFirmContext } from "@/lib/permissions/firm-context";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await requireFirmContext();

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <DashboardNav email={context.email} firmName={context.firm.name} />
      <main className="px-5 py-8 sm:px-8 lg:ml-72 lg:px-12 lg:py-12">
        {children}
      </main>
    </div>
  );
}
