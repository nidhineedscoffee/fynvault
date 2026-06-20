import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  SCALEKIT_ENVIRONMENT_URL: z.string().url().optional().or(z.literal("")),
  SCALEKIT_CLIENT_ID: z.string().optional().or(z.literal("")),
  SCALEKIT_CLIENT_SECRET: z.string().optional().or(z.literal("")),
  GOOGLE_CLIENT_ID: z.string().optional().or(z.literal("")),
  GOOGLE_CLIENT_SECRET: z.string().optional().or(z.literal("")),
  ZOHO_CLIENT_ID: z.string().optional().or(z.literal("")),
  ZOHO_CLIENT_SECRET: z.string().optional().or(z.literal("")),
  ZOHO_ACCOUNTS_BASE_URL: z.string().url().default("https://accounts.zoho.com"),
  ZOHO_BOOKS_BASE_URL: z.string().url().default("https://www.zohoapis.com/books/v3"),
  OPENAI_API_KEY: z.string().optional().or(z.literal("")),
  OPENAI_MODEL: z.string().default("gpt-4o")
});

export const env = EnvSchema.parse(process.env);

export type ProviderName = "supabase" | "scalekit" | "google" | "zoho" | "openai";

export function hasSupabaseConfig() {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasGoogleConfig() {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function hasZohoConfig() {
  return Boolean(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET);
}

export function hasScalekitConfig() {
  return Boolean(env.SCALEKIT_ENVIRONMENT_URL && env.SCALEKIT_CLIENT_ID && env.SCALEKIT_CLIENT_SECRET);
}

export function hasOpenAIConfig() {
  return Boolean(env.OPENAI_API_KEY);
}

export function providerStatus() {
  return {
    supabase: hasSupabaseConfig(),
    scalekit: hasScalekitConfig(),
    google: hasGoogleConfig(),
    zoho: hasZohoConfig(),
    openai: hasOpenAIConfig()
  } satisfies Record<ProviderName, boolean>;
}

export function missingProviderVars(provider: ProviderName) {
  const required: Record<ProviderName, string[]> = {
    supabase: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    scalekit: ["SCALEKIT_ENVIRONMENT_URL", "SCALEKIT_CLIENT_ID", "SCALEKIT_CLIENT_SECRET"],
    google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    zoho: ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET"],
    openai: ["OPENAI_API_KEY"]
  };

  return required[provider].filter((key) => !process.env[key]);
}

