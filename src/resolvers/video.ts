import { Arg, Field, InputType, Int, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import Video from '../entity/Video';
import { authoriseAccount } from '../utilities/storage';

@InputType()
class VideoIdentifiers {
  @Field()
  slug: string;
  @Field()
  key: string;
}

@ObjectType()
export class Videos {
  @Field(() => [Video], { nullable: true })
  videos: Video[];
}

@Resolver()
class VideoResolver {
  @Query(() => Videos)
  async videos(@Arg('slug') slug: String): Promise<Video[]> {
    return Video.find({ where: { slug } });
  }

  @Mutation(() => Video)
  async createVideo(@Arg('identifiers') identifiers: VideoIdentifiers): Promise<Video> {
    await authoriseAccount();
    return Video.create({
      ...identifiers,
      duration: 10,
      playbackId: 'aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwW',
    }).save();
  }

  @Mutation(() => Boolean)
  async deleteVideo(@Arg('id', () => Int) id: number): Promise<boolean> {
    const video = await Video.findOne({ id });
    if (!video) {
      return false;
    }
    await Video.delete({ id });
    return true;
  }
}
export { VideoResolver as default };
