import { Arg, Field, InputType, Int, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import Video from '../entity/Video';

@InputType()
class VideoIdentifiers {
  @Field()
  slug: string;

  @Field()
  key: string;
}

@InputType()
class CreateVideoParameters {
  @Field()
  slug: string;

  @Field()
  key: string;

  @Field()
  captionsUrl: string;

  @Field()
  videoUrl: string;
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
  async createVideo(@Arg('parameters') parameters: CreateVideoParameters): Promise<Video> {
    return Video.create({
      ...parameters,
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
