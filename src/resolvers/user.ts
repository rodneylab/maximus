import { Session } from '@supabase/supabase-js';
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { COOKIE_NAME } from '../constants';
import User, { UserLogin } from '../entity/User';
import { MyContext } from '../types';
import {
  githubLogin,
  githubRegistrationPermitted,
  signInWithEmail,
  signUpWithEmail,
  validEmail,
  validLoginUsername,
  validUsername,
} from '../utilities/user';
import UsernameEmailPasswordInput from './UsernameEmailPasswordInput';

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => User, { nullable: true })
  session?: Session;
}

// used for register and login - email signup needs to enabled in supabase for this to succeed
@Resolver(User)
export class UserResolver {
  @Mutation(() => UserResponse)
  async githubLogin(
    @Arg('accessToken') accessToken: string, // this is the GitHub access token (not supabase)
    @Arg('refreshToken') refreshToken: string,
    @Ctx() { req, supabase }: MyContext,
  ): Promise<UserResponse> {
    const { user, session, error } = await githubLogin(supabase, accessToken, refreshToken);
    if (!user || !session) {
      return {
        errors: [
          {
            field: 'githubAccount',
            message: 'Invalid user',
          },
        ],
      };
    }
    const { user_metadata } = user;
    let dbUser = await User.findOne({
      where: { username: user_metadata.user_name, loginType: UserLogin.GITHUB },
    });
    if (!dbUser) {
      if (!githubRegistrationPermitted) {
        return {
          errors: [
            {
              field: 'githubAccount',
              message: 'Not currently registered',
            },
          ],
        };
      }

      const { email, id } = user;
      dbUser = await User.create({
        userId: id,
        email,
        loginType: UserLogin.GITHUB,
        username: user_metadata.user_name,
      }).save();
      return { user: dbUser, session };
    }
    if (error || !user || !session) {
      return {
        errors: [{ field: 'githubAccount', message: error?.message ?? '' }],
      };
    }
    const { id } = dbUser;
    req.session.userId = id;
    return { user: dbUser, session };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('username') username: string,
    @Arg('password') password: string,
    @Ctx() { req, supabase }: MyContext,
  ): Promise<UserResponse> {
    const { errors: usernameErrors } = await validLoginUsername(username);
    if (usernameErrors) {
      return { errors: usernameErrors };
    }
    const dbUser = await User.findOne({ where: { username, loginType: UserLogin.EMAIL } });
    const loginErrors = [
      {
        field: 'username',
        message: 'Please check username/email.',
      },
      {
        field: 'password',
        message: 'Please check username/password.',
      },
    ];
    if (!dbUser) {
      return {
        errors: loginErrors,
      };
    }
    const { email, id } = dbUser;
    const { user, session, error } = await signInWithEmail(supabase, email, password);
    if (error || !user || !session) {
      console.log('supabase login error: ', error?.message);
      return {
        errors: loginErrors,
      };
    }
    req.session.userId = id;
    return { user: dbUser, session };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((error) => {
        res.clearCookie(COOKIE_NAME);
        if (error) {
          console.error(error);
          resolve(false);
          return;
        }
        resolve(true);
      }),
    );
  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    if (!req.session.userId) {
      return null;
    }
    return User.findOne(req.session.userId);
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UsernameEmailPasswordInput,
    @Ctx() { supabase }: MyContext,
  ): Promise<UserResponse> {
    const { email, password, username } = options;

    const { errors: emailErrors } = await validEmail(email);
    if (emailErrors) {
      return { errors: emailErrors };
    }

    const { errors: usernameErrors } = await validUsername(username);
    if (usernameErrors) {
      return { errors: usernameErrors };
    }

    const { user, error } = await signUpWithEmail(supabase, email, password);
    if (error || !user) {
      return {
        errors: [{ field: 'password', message: error?.message ?? '' }],
      };
    }
    const { id: userId } = user;
    const dbUser = await User.create({
      userId,
      email,
      username,
      loginType: UserLogin.EMAIL,
    }).save();
    return { user: dbUser };
  }
}

export default UserResolver;
