import Link from "next/link";

import { AuthNotice } from "@/components/shared/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRedirectPath } from "@/lib/security/redirects";
import { signInAction } from "@/modules/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <>
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Bienvenue
      </p>
      <h1 className="text-navy mt-3 font-serif text-4xl">Se connecter</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Accédez à votre prochaine sélection d’opportunités.
      </p>

      <div className="mt-8">
        <AuthNotice error={params.error} message={params.message} />
      </div>

      <form action={signInAction} className="mt-6 space-y-5">
        <input type="hidden" name="next" value={safeRedirectPath(nextParam)} />
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link
              href="/forgot-password"
              className="text-gold-dark text-sm font-medium hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button className="w-full" type="submit">
          Se connecter
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Nouveau sur Affluo ?{" "}
        <Link
          href="/signup"
          className="text-navy font-semibold hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </>
  );
}
