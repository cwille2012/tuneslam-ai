import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import publicRouter from './routes/public';
import authAdminRouter from './routes/authAdmin';
import authUserRouter from './routes/authUser';
import authSpotifyRouter from './routes/authSpotify';
import authFacebookRouter from './routes/authFacebook';
import adminRouter from './routes/admin';
import userRouter from './routes/user';
import playerRouter from './routes/player';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (env.CORS_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error(`Origin ${origin} not allowed`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/api', publicRouter);
  app.use('/api/auth/admin', authAdminRouter);
  app.use('/api/auth/user', authUserRouter);
  app.use('/api/auth/spotify', authSpotifyRouter);
  app.use('/api/auth/facebook', authFacebookRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/user', userRouter);
  app.use('/api/player', playerRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
