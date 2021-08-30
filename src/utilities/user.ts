// https://supabase.io/docs/reference/javascript/auth-signin#sign-in-using-third-party-providers
import { SupabaseClient } from '@supabase/supabase-js';
import User from '../entity/User';

const emailRegex =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

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
  const { user, session, error } = await supabase.auth.signUp(
    {
      email,
      password,
    },
    { redirectTo: process.env.REGISTER_REDIRECT },
  );
  return { user, session, error };
}

export async function validEmail(email: string) {
  if (!emailRegex.test(email)) {
    return {
      errors: [
        {
          field: 'email',
          message: 'Please check your email address',
        },
      ],
    };
  }
  if (await User.findOne({ where: { email } })) {
    return {
      errors: [
        {
          field: 'email',
          message: 'User already exists. Please sign in.',
        },
      ],
    };
  }
  return {};
}

export async function validUsername(username: string) {
  if (!/^[A-Z,a-z,0-9,-,_]+$/.test(username)) {
    return {
      errors: [
        {
          field: 'username',
          message: 'Please choose a username with only letter, numbers, underscores and hyphens.',
        },
      ],
    };
  }
  if (await User.findOne({ where: { username } })) {
    return {
      errors: [
        {
          field: 'username',
          message: 'Username is not currently available, please choose another.',
        },
      ],
    };
  }
  return {};
}

export async function validLoginUsername(username: string) {
  if (!/^[A-Z,a-z,0-9,-,_]+$/.test(username)) {
    return {
      errors: [
        {
          field: 'username',
          message: 'Please check your username.',
        },
      ],
    };
  }
  return {};
}
