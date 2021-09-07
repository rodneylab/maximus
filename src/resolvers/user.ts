import { Session } from '@supabase/supabase-js';
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import User from '../entity/User';
import { MyContext } from '../types';
import {
  githubLogin,
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

@Resolver(User)
export class UserResolver {
  @Mutation(() => UserResponse)
  async githubLogin(
    @Arg('accessToken') accessToken: string, // this is the GitHub access token (not supabase)
    @Arg('refreshToken') refreshToken: string,
    @Ctx() { req, supabase }: MyContext,
  ): Promise<UserResponse> {
    const { login, user, session, error } = await githubLogin(supabase, accessToken, refreshToken);
    const dbUser = await User.findOne({ where: { githubLogin: login } });
    if (!dbUser) {
      return {
        errors: [
          {
            field: 'githubAccount',
            message: 'Not currently registered',
          },
        ],
      };
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
    const dbUser = await User.findOne({ where: { username } });
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
      return {
        errors: loginErrors,
      };
    }
    req.session.userId = id;
    return { user: dbUser, session };
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
    const dbUser = await User.create({ userId, email, username }).save();
    return { user: dbUser };
  }
}

export default UserResolver;
