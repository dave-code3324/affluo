import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="bg-navy text-ivory relative flex min-h-screen items-center overflow-hidden px-6 py-16">
      <div
        aria-hidden="true"
        className="border-gold/20 absolute -top-32 -right-32 size-96 rounded-full border"
      />
      <div
        aria-hidden="true"
        className="bg-gold/5 absolute -bottom-48 -left-48 size-[32rem] rounded-full blur-3xl"
      />

      <section className="relative mx-auto w-full max-w-5xl">
        <div className="bg-gold mb-10 h-px w-20" />
        <p className="text-gold mb-5 text-xs font-semibold tracking-[0.32em] uppercase">
          Prospection patrimoniale
        </p>
        <h1 className="font-serif text-6xl tracking-tight sm:text-8xl">
          Affluo
        </h1>
        <p className="text-ivory/80 mt-7 max-w-3xl text-xl leading-relaxed sm:text-3xl sm:leading-snug">
          Les meilleures opportunités patrimoniales, avant tout le monde.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonVariants()}>
            Créer mon espace
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-ivory border border-white/15 hover:bg-white/10",
            )}
          >
            Se connecter
          </Link>
        </div>
      </section>
    </main>
  );
}
