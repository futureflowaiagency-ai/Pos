import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export const generateToken = (payload) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpire });
