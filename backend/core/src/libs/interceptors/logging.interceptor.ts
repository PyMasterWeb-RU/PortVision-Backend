import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';

    return next.handle().pipe(
      tap({
        next: (data) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const { statusCode } = response;

          // Log successful requests
          this.logger.log(
            `${method} ${url} ${statusCode} - ${duration}ms`,
            JSON.stringify({
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              ip,
              userAgent,
              timestamp: new Date().toISOString(),
            }),
          );
        },
        error: (error) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const statusCode = error.status || 500;

          // Log error requests
          this.logger.error(
            `${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`,
            JSON.stringify({
              method,
              url,
              statusCode,
              duration: `${duration}ms`,
              ip,
              userAgent,
              error: error.message,
              timestamp: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }
}