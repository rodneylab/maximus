// https://supabase.io/docs/reference/javascript/auth-signin#sign-in-using-third-party-providers
import { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import User from '../entity/User';

const emailRegex =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export async function githubLogin(
  supabase: SupabaseClient,
  accessToken: string,
  refreshToken: string,
) {
  try {
    const response = await axios.request<{ login: string }>({
      url: 'https://api.github.com/user',
      method: 'GET',
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    const { login } = response.data;

    const { user, session, error } = await supabase.auth.signIn({
      refreshToken,
    });
    return { login, user, session, error };
  } catch (error) {
    let message;
    if (error.response) {
      message = `Storage server responded with non 2xx code: ${error.response.data}`;
    } else if (error.request) {
      message = `No storage response received: ${error.request}`;
    } else {
      message = `Error setting up storage response: ${error.message}`;
    }
    return { error: { message } };
  }
}

export function githubRegistrationPermitted() {
  return process.env.ALLOW_GITHUB_REGISTRATION === 'true';
}

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

// export async function signOut() {
//   const { error } = await supabase.auth.signOut();
//   return { error };
// }

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
          message: 'You might already have an account. Did you try signing in?',
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
          message: 'Please choose a username with only letters, numbers, underscores and hyphens.',
        },
      ],
    };
  }
  if (await User.findOne({ where: { username } })) {
    return {
      errors: [
        {
          field: 'username',
          message: `${username} is not currently available, please choose something else as your username.`,
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
