import { z } from "zod";

const email = z
  .string()
  .trim()
  .email("Saisissez une adresse email valide.")
  .max(254);

const password = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(128);

export const credentialsSchema = z.object({
  email,
  password,
});

export const emailSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["passwordConfirmation"],
  });
