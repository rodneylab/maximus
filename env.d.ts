declare namespace NodeJS {
  export interface ProcessEnv {
    CORS_ORIGIN: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_URL: string;
  }
}
