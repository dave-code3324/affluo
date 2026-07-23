import Link from "next/link";

import { AuthNotice } from "@/components/shared/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/modules/auth/actions";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  return (
    <>
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Moins de 3 minutes
      </p>
      <h1 className="text-navy mt-3 font-serif text-4xl">Créer votre espace</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Configurez votre cabinet et préparez votre première sélection.
      </p>

      <div className="mt-8">
        <AuthNotice error={params.error} message={params.message} />
      </div>

      <form action={signUpAction} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email professionnel</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@cabinet.fr"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="text-xs text-slate-500">8 caractères minimum.</p>
        </div>
        <Button className="w-full" type="submit">
          Créer mon compte
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Déjà inscrit ?{" "}
        <Link href="/login" className="text-navy font-semibold hover:underline">
          Se connecter
        </Link>
      </p>
    </>
  );
}
