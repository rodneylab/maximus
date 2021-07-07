import { Arg, Field, InputType, Int, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import Video from '../entity/Video';
import { upload } from '../utilities/video';

@InputType()
class CreateVideoParameters {
  @Field()
  slug: string;

  @Field()
  key: string;

  @Field()
  description: string;

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
    const { captionsUrl, videoUrl } = parameters;
    const { playbackId, videoId } = await upload({ captionsUrl, videoUrl });
    return Video.create({
      ...parameters,
      playbackId,
      videoId,
      ready: false,
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
