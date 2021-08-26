import { Session } from '@supabase/supabase-js';
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import User from '../entity/User';
import { MyContext } from '../types';
import { signInWithEmail, signUpWithEmail } from '../utilities/user';
import EmailPasswordInput from './EmailPasswordInput';

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
  async login(
    @Arg('email') email: string,
    @Arg('password') password: string,
    @Ctx() { req, supabase }: MyContext,
  ): Promise<UserResponse> {
    const dbUser = await User.findOne({ where: { email } });
    if (!dbUser) {
      return {
        errors: [
          {
            field: 'email',
            message: 'User does not exist',
          },
        ],
      };
    }
    const { user, session, error } = await signInWithEmail(supabase, email, password);
    if (error || !user || !session) {
      return {
        errors: [{ field: 'password', message: error?.message ?? '' }],
      };
    }
    req.session.userId = user?.id;
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
    @Arg('options') options: EmailPasswordInput,
    @Ctx() { req, supabase }: MyContext,
  ): Promise<UserResponse> {
    const { email, password } = options;
    const dbUser = await User.findOne({ where: { email } });
    if (dbUser) {
      return {
        errors: [
          {
            field: 'email',
            message: 'User already exists. Please sign in.',
          },
        ],
      };
    }
    const { user, session, error } = await signUpWithEmail(supabase, email, password);
    if (error || !user || !session) {
      return {
        errors: [{ field: 'password', message: error?.message ?? '' }],
      };
    }
    req.session.userId = user?.id;
    return { user: dbUser, session };
  }
}

export default UserResolver;
