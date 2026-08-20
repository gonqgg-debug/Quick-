declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    WHATSAPP_ACCESS_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    WHATSAPP_VERIFY_TOKEN?: string;
    WHATSAPP_API_VERSION?: string;
    STAFF_PHONE_NUMBER?: string;
    STAFF_PASSWORD?: string;
    NEXT_PUBLIC_APP_URL?: string;
    NEXT_PUBLIC_WHATSAPP_NUMBER?: string;
    APP_URL?: string;
    VERCEL_URL?: string;
    SERPER_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
  }
}
