"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { safeRedirectPath } from "@/lib/security/redirects";
import {
  credentialsSchema,
  emailSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function noticeUrl(
  pathname: string,
  kind: "error" | "message",
  message: string,
) {
  const searchParams = new URLSearchParams({ [kind]: message });
  return `${pathname}?${searchParams.toString()}`;
}

function authErrorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Confirmez votre adresse email avant de vous connecter.";
    case "user_already_exists":
    case "user_already_registered":
      return "Un compte existe déjà avec cette adresse email.";
    case "weak_password":
      return "Choisissez un mot de passe plus robuste.";
    default:
      return "Une erreur est survenue. Réessayez dans quelques instants.";
  }
}

export async function signUpAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(
      noticeUrl(
        "/signup",
        "error",
        parsed.error.issues[0]?.message ?? "Informations invalides.",
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    redirect(noticeUrl("/signup", "error", authErrorMessage(error.code)));
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  redirect(
    noticeUrl(
      "/signup",
      "message",
      "Compte créé. Consultez votre email pour confirmer votre adresse.",
    ),
  );
}

export async function signInAction(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(
      noticeUrl(
        "/login",
        "error",
        parsed.error.issues[0]?.message ?? "Informations invalides.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(noticeUrl("/login", "error", authErrorMessage(error.code)));
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(formData.get("next")?.toString()));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirect(
      noticeUrl(
        "/forgot-password",
        "error",
        parsed.error.issues[0]?.message ?? "Email invalide.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
    },
  );

  if (error) {
    redirect(
      noticeUrl(
        "/forgot-password",
        "error",
        "Impossible d’envoyer l’email pour le moment.",
      ),
    );
  }

  redirect(
    noticeUrl(
      "/forgot-password",
      "message",
      "Si un compte correspond à cette adresse, un lien vient d’être envoyé.",
    ),
  );
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    redirect(
      noticeUrl(
        "/reset-password",
        "error",
        parsed.error.issues[0]?.message ?? "Mot de passe invalide.",
      ),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    redirect(
      noticeUrl(
        "/reset-password",
        "error",
        "Le lien a expiré ou le mot de passe ne peut pas être modifié.",
      ),
    );
  }

  revalidatePath("/", "layout");
  redirect(
    noticeUrl("/dashboard", "message", "Votre mot de passe a été modifié."),
  );
}
