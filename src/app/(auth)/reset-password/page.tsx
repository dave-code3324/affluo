import { AuthNotice } from "@/components/shared/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/modules/auth/actions";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <>
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Sécurité
      </p>
      <h1 className="text-navy mt-3 font-serif text-4xl">
        Nouveau mot de passe
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Choisissez un mot de passe unique d’au moins 8 caractères.
      </p>

      <div className="mt-8">
        <AuthNotice error={params.error} message={params.message} />
      </div>

      <form action={resetPasswordAction} className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">
            Confirmer le mot de passe
          </Label>
          <Input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <Button className="w-full" type="submit">
          Enregistrer le mot de passe
        </Button>
      </form>
    </>
  );
}
