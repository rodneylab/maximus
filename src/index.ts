import { ApolloServer } from 'apollo-server-express';
import bodyParser from 'body-parser';
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
import Video from './entity/Video';
import HelloResolver from './resolvers/hello';
import ImageResolver from './resolvers/image';
import PostResolver from './resolvers/post';
import VideoResolver from './resolvers/video';
import { upload } from './utilities/storage';
import { isProduction } from './utilities/utilities';

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
    url: process.env.SUPABASE_URL,
    logging: !isProduction,
    migrations: [path.join(__dirname, './migrations/*')],
    entities: [Image, Post, Video],
    synchronize: true,
  });
  // dbConnection.runMigrations();

  const app = express();
  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);
  app.set('trust proxy', true);
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  app.use(compression());

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        maxAge: 31_536_000_000, // 1000 * 3600 * 24 * 365 * 1 (1 year)
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
      resolvers: [HelloResolver, ImageResolver, PostResolver, VideoResolver],
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
    }),
  });

  apolloServer.applyMiddleware({
    app,
    path: '/graphql',
    cors: false, // using cors package instead
  });

  app.post('/api/upload', (req, res, next) => {
    const form = formidable({ multiples: true });

    let captions = {};
    let video = {};

    form.parse(req, async (err, fields, files: VideoFiles) => {
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
        captions = { url: captionsResult.readSignedUrl };
        video = { url: videoResult.readSignedUrl };
      }

      res.json({ fields, files, captions, video });
    });
  });

  const jsonParser = bodyParser.json();
  app.post(`/api/${process.env.MUX_WEBHOOK_ENDPOINT}`, jsonParser, async (req, res) => {
    const { type, data } = req.body;
    const { status, id: videoId, duration } = data;

    if (type === 'video.asset.ready' && status === 'ready') {
      const video = await Video.findOne({ where: { videoId } });
      if (video) {
        const { id } = video;
        await Video.update({ id }, { ready: true, duration });
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
