import { Arg, Field, ObjectType, Query, Resolver } from 'type-graphql';
import Video from '../entity/Video';

@ObjectType()
class Videos {
  @Field(() => [Video])
  images: Video[];
}

@Resolver()
class VideoResolver {
  @Query(() => Videos)
  async videos(@Arg('slug') slug: String): Promise<Video[]> {
    return Video.find({ where: { slug } });
  }
}

export { VideoResolver as default };
