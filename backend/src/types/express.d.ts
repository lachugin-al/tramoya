import 'express';

declare global {
  namespace Express {
    interface Response {
      flush?: () => void;
    }
  }
}