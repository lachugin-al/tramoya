import 'winston';

declare module 'winston' {
  interface Logger {
    trace(message: string, ...meta: any[]): Logger;
  }
}