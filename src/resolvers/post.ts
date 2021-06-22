import { Arg, Field, InputType, Int, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { getConnection } from 'typeorm';
import Post from '../entity/Post';

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
  @Query(() => PaginatedPosts)
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
  async createPost(@Arg('input') input: PostInput): Promise<Post> {
    return Post.create({ ...input }).save();
  }
}

export { PostResolver as default };
