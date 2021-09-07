import { createClient } from '@supabase/supabase-js';
import { ApolloServer } from 'apollo-server-express';
import compression from 'compression';
import connectRedis from 'connect-redis';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import formidable from 'formidable';
import Redis from 'ioredis';
import path from 'path';
import 'reflect-metadata';
import { buildSchema } from 'type-graphql';
import { ApolloServerLoaderPlugin } from 'type-graphql-dataloader';
import { createConnection, getConnection } from 'typeorm';
import { COOKIE_NAME } from './constants';
import Image from './entity/Image';
import Post from './entity/Post';
import User from './entity/User';
import Video from './entity/Video';
import ImageResolver from './resolvers/image';
import PostResolver from './resolvers/post';
import UserResolver from './resolvers/user';
import VideoResolver from './resolvers/video';
import { remove, upload } from './utilities/storage';
import { isProduction } from './utilities/utilities';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_KEY as string,
);

type UploadFile = {
  name: string;
  path: string;
  size: number;
  type: string;
};

type VideoFiles = formidable.Files & {
  captions?: UploadFile;
  video?: UploadFile;
};

const startServer = async () => {
  // const dbConnection = await createConnection({
  await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    logging: !isProduction,
    migrations: [path.join(__dirname, './migrations/*')],
    entities: [Image, Post, User, Video],
    synchronize: true,
  });
  // dbConnection.runMigrations();

  // await Video.delete({});
  // await Post.delete({});

  const app = express();
  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);
  app.set('trust proxy', true);
  // https://github.com/expressjs/cors#cors
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  app.use(compression());

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        maxAge: 31_536_000_000, // 1000 * 3600 * 24 * 365 * 1 (1 year)
        // maxAge: 10_800_000, // 1000 * 3600 (3 hours)
        httpOnly: true, // disable access via front end
        sameSite: 'lax', //csrf protection
        secure: isProduction, // https only
        domain: isProduction ? `.${process.env.DOMAIN}` : undefined,
      },
      saveUninitialized: false, // do not create an empty session by default
      secret: process.env.SESSION_SECRET as string,
      resave: false,
    }),
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [ImageResolver, PostResolver, UserResolver, VideoResolver],
      validate: false,
    }),
    plugins: [
      ApolloServerLoaderPlugin({
        typeormGetConnection: getConnection,
      }),
    ],
    context: ({ req, res }) => ({
      req,
      res,
      redis,
      supabase,
    }),
  });

  await apolloServer.start();

  apolloServer.applyMiddleware({
    app,
    path: '/graphql',
    cors: false, // using cors package instead
    // https://www.apollographql.com/docs/apollo-server/api/apollo-server/#framework-specific-middleware-function
  });

  app.post('/api/upload', (req, res, next) => {
    const form = formidable({ multiples: true });

    let captions = {};
    let video = {};
    let successful = false;

    form.parse(req, async (err, _fields, files: VideoFiles) => {
      if (err) {
        next(err);
        return;
      }

      // upload captions file
      if (files.captions && files.video) {
        const captionsContentType = files.captions.type;
        const captionsTempPath = files.captions.path;
        const captionsFileName = files.captions.name;
        const captionsFileSize = files.captions.size;
        const captionsPromise = upload({
          contentType: captionsContentType,
          key: captionsFileName,
          path: captionsTempPath,
          size: captionsFileSize,
        });

        // upload video file
        const videoContentType = files.video.type;
        const videoTempPath = files.video.path;
        const videoFileName = files.video.name;
        const videoFileSize = files.video.size;
        const videoPromise = upload({
          contentType: videoContentType,
          key: videoFileName,
          path: videoTempPath,
          size: videoFileSize,
        });

        // get captions and video read urls
        const [captionsResult, videoResult] = await Promise.all([captionsPromise, videoPromise]);
        if (!captionsResult.successful || !videoResult.successful) {
          res.json({ successful });
          return;
        }
        captions = { id: captionsResult.id, url: captionsResult.readSignedUrl };
        video = { id: videoResult.id, url: videoResult.readSignedUrl };
        successful = true;
      }

      res.json({ captions, successful, video });
    });
  });

  const jsonParser = express.json();
  app.post(`/api/${process.env.MUX_WEBHOOK_ENDPOINT}`, jsonParser, async (req, res) => {
    const { type, data } = req.body;
    const { status, id: videoId, duration } = data;

    // update duration and ready status
    if (type === 'video.asset.ready' && status === 'ready') {
      const video = await Video.findOne({ where: { videoId } });
      if (video) {
        const now = new Date();
        const recent = now.getTime() - video.createdAt.getTime() < 86_400_000; // 1000 * 3600 * 24;
        if (recent) {
          const { captionsStorageId, captionsStorageKey, id, videoStorageId, videoStorageKey } =
            video;
          await Promise.all([
            remove({ id: captionsStorageId, key: captionsStorageKey }),
            remove({ id: videoStorageId, key: videoStorageKey }),
          ]);
          Video.update({ id }, { ready: true, duration });
        }
      }
    }
    res.sendStatus(200);
  });

  const port = parseInt(process.env.PORT as string, 10);
  app.listen(port, () => {
    console.log(`GraphQL playground server started on:\n\n\thttp://localhost:${port}/graphql\n`);
  });
};

startServer().catch((err) => {
  console.error(err);
});
