import { Query, Resolver, UseMiddleware } from 'type-graphql';
import Image from '../entity/Image';
import { isAuth } from '../middleware/isAuth';

@Resolver()
export class ImageResolver {
  @Query(() => String)
  @UseMiddleware(isAuth)
  image() {
    return "I'll give you an image";
  }

  @Query(() => [Image])
  @UseMiddleware(isAuth)
  images() {
    return Image.find();
  }
}

export { ImageResolver as default };
