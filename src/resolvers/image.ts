import { Query, Resolver } from 'type-graphql';
import Image from '../entity/Image';

@Resolver()
export class ImageResolver {
  @Query(() => String)
  image() {
    return "I'll give you images";
  }

  @Query(() => [Image])
  images() {
    return Image.find();
  }
}

export { ImageResolver as default };