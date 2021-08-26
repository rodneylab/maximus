import { SupabaseClient } from '@supabase/supabase-js';

export async function signInWithGithub(supabase: SupabaseClient) {
  const { user, session, error } = await supabase.auth.signIn({
    provider: 'github',
  });
  return { user, session, error };
}

export async function signInWithEmail(supabase: SupabaseClient, email: string, password: string) {
  const { user, session, error } = await supabase.auth.signIn({
    email,
    password,
  });
  return { user, session, error };
}

export async function signUpWithEmail(supabase: SupabaseClient, email: string, password: string) {
  const { user, session, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { user, session, error };
}

// https://supabase.io/docs/reference/javascript/auth-signin#sign-in-using-third-party-providers

// function signInWithGithub() {
//   const { user, session, error } = await supabase.auth.signIn({
//     provider: 'github',
//   });
// }

// const { user, session, error } = await supabase.auth.signIn(
//   {
//     provider: 'github',
//   },
//   {
//     redirectTo: 'https://example.com/welcome',
//     scopes: 'repo gist notifications',
//   },
// );
// const oAuthToken = session.provider_token; // use to access provider API
// // logout

// function signout() {
//   const { error } = await supabase.auth.signOut();
// }
