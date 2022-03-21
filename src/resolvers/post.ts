import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql';
import { getConnection, getRepository } from 'typeorm';
import Post from '../entity/Post';
import Video from '../entity/Video';
import { isAuth } from '../middleware/isAuth';
import { Videos } from './video';

@InputType()
class PostInput {
  @Field()
  slug: string;
  @Field()
  title: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @UseMiddleware(isAuth)
  @FieldResolver(() => Videos)
  async videos(@Root() post: Post) {
    return getRepository(Video).find({ where: { slug: post.slug } });
  }

  @Query(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  post(@Arg('slug', () => String) slug: string): Promise<Post | null> {
    return Post.findOne({ where: { slug } });
  }

  @Query(() => PaginatedPosts)
  @UseMiddleware(isAuth)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
  ): Promise<PaginatedPosts> {
    // add an extra post to know if there are more
    const realLimit = Math.min(10, limit);
    const queryLimit = realLimit + 1;
    const replacements: any[] = [queryLimit];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
select p.*
from post p
${cursor ? `where p."createdAt" < $2` : ''}
order by p."createdAt" DESC
limit $1
			`,
      replacements,
    );
    return { posts: posts.slice(0, realLimit), hasMore: posts.length === queryLimit };
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(@Arg('input') input: PostInput, @Ctx() { req }: MyContext): Promise<Post> {
    const creatorId = req.session.userId;
    return Post.create({ ...input, creatorId }).save();
  }
}

export { PostResolver as default };
