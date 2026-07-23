import Link from "next/link";

import { AuthNotice } from "@/components/shared/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/modules/auth/actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <>
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Accès
      </p>
      <h1 className="text-navy mt-3 font-serif text-4xl">
        Mot de passe oublié
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de
        passe.
      </p>

      <div className="mt-8">
        <AuthNotice error={params.error} message={params.message} />
      </div>

      <form action={requestPasswordResetAction} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email professionnel</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <Button className="w-full" type="submit">
          Envoyer le lien
        </Button>
      </form>

      <Link
        href="/login"
        className="text-navy mt-8 block text-center text-sm font-semibold hover:underline"
      >
        Retour à la connexion
      </Link>
    </>
  );
}
