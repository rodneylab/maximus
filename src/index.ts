import { ApolloServer } from 'apollo-server-express';
import compression from 'compression';
import connectRedis from 'connect-redis';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import Redis from 'ioredis';
import path from 'path';
import 'reflect-metadata';
import { buildSchema } from 'type-graphql';
import { createConnection } from 'typeorm';
import { COOKIE_NAME } from './constants';
import Image from './entity/Image';
import Post from './entity/Post';
import Video from './entity/Video';
import HelloResolver from './resolvers/hello';
import ImageResolver from './resolvers/image';
import PostResolver from './resolvers/post';
import VideoResolver from './resolvers/video';
import { isProduction } from './utilities/utilities';

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
  app.set('trust proxy', 1);
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

  const port = parseInt(process.env.PORT as string, 10);
  app.listen(port, () => {
    console.log(`GraphQL playground server started on:\n\n\thttp://localhost:${port}/graphql\n`);
  });
};

startServer().catch((err) => {
  console.error(err);
});
