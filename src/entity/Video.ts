import { Field, ID, Int, ObjectType } from 'type-graphql';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Post from './Post';

@Entity()
@ObjectType()
class Video extends BaseEntity {
  @Field(() => ID)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => String)
  @Column({ length: 128 })
  slug!: string;

  @Field(() => String)
  @Column({ length: 128 })
  key!: string;

  @Field(() => Int)
  @Column()
  duration: number;

  @Field(() => String)
  @Column()
  playbackId: string;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => Post)
  @ManyToOne(() => Post, (post) => post.videos)
  post: Post;
}

export { Video as default };
