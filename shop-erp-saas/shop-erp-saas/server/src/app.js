import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();

// Behind Nginx/reverse proxy on the VPS: trust the first proxy so rate-limiting
// and req.ip see the real client IP from X-Forwarded-For.
if (config.nodeEnv === 'production') app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (config.nodeEnv === 'development') app.use(morgan('dev'));

// basic rate limiting (tune for 500+ users)
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
