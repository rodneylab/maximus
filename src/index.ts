import 'dotenv/config';
import express from 'express';
import path from 'path';
import 'reflect-metadata';
import { createConnection } from 'typeorm';
import { isProduction } from './utilities/utilities';
// import { createClient } from '@supabase/supabase-js';

console.log('hello!');

// const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
// const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON;

// const supabase = createClient(supabaseUrl, supabaseAnonKey);

const main = async () => {
  await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    logging: !isProduction,
    migrations: [path.join(__dirname, './migrations/*')],
    synchronize: true,
  });

  const app = express();
  app.get('/', (_req, res) => {
    res.send('hello');
  });
  app.listen(4000, () => {
    console.log('server started on localhost:4000');
  });
};

main().catch((err) => {
  console.log(err);
});
