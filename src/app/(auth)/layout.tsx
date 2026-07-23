import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="bg-ivory grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <section className="bg-navy text-ivory relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="border-gold/20 absolute -top-48 -right-48 size-[30rem] rounded-full border"
        />
        <Link href="/" className="relative font-serif text-3xl">
          Affluo
        </Link>
        <div className="relative max-w-lg">
          <div className="bg-gold mb-8 h-px w-16" />
          <p className="font-serif text-4xl leading-tight">
            Vos meilleures opportunités patrimoniales, sélectionnées chaque
            semaine.
          </p>
          <p className="text-ivory/60 mt-6 max-w-md text-sm leading-relaxed">
            Moins de bruit. Quelques prospects qualifiés et réellement
            contactables.
          </p>
        </div>
        <p className="text-gold relative text-xs tracking-[0.24em] uppercase">
          Prospection patrimoniale
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="text-navy mb-12 block font-serif text-3xl lg:hidden"
          >
            Affluo
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
