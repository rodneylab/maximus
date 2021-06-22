import { Field, ID, ObjectType } from 'type-graphql';
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
  @Column()
  slug!: string;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => Image)
  @OneToMany(() => Image, (image) => image.slug)
  images: Image[];

  @Field(() => Video)
  @OneToMany(() => Video, (video) => video.slug)
  videos: Video[];
}

export { Post as default };
