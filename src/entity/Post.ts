import { Field, ID, ObjectType } from 'type-graphql';
import { TypeormLoader } from 'type-graphql-dataloader';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Image from './Image';
import Video from './Video';

@Entity()
@ObjectType()
class Post extends BaseEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => String)
  @Column({ length: 128 })
  title!: string;

  @Field(() => String)
  @Column({ unique: true })
  slug!: string;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => [Image], { nullable: true })
  @OneToMany(() => Image, (image) => image.slug)
  images: Image[];

  @Field(() => [Video], { nullable: true })
  // @OneToMany(() => Video, (video) => video.slug, { cascade: true })
  @OneToMany(() => Video, (video) => video.slug)
  @TypeormLoader()
  videos: Video[];

  @Field(() => [Post], { nullable: true })
  @OneToMany(() => Post, (post) => post.slug)
  @TypeormLoader()
  relatedPosts: Post[];
}

export { Post as default };
