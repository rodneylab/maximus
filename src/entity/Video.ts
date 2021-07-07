import { Field, ID, Int, ObjectType } from 'type-graphql';
import { TypeormLoader } from 'type-graphql-dataloader';
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

  @Field(() => String)
  @Column()
  description: string;

  @Field(() => Int, { nullable: true })
  @Column()
  duration: number;

  @Field(() => Boolean)
  @Column()
  ready: boolean;

  @Field(() => String)
  @Column({ unique: true })
  playbackId: string;

  @Field(() => String)
  @Column({ unique: true })
  videoId: string;

  @Field(() => Date)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => Date)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => Post)
  @ManyToOne(() => Post, (post) => post.videos)
  @TypeormLoader()
  post: Post;
}

export { Video as default };
