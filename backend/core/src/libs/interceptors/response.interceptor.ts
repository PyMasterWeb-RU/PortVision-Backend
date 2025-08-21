import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  traceId: string;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const traceId = uuidv4();
    const timestamp = new Date().toISOString();

    return next.handle().pipe(
      map((data) => {
        // If response already has our format, don't wrap it again
        if (data && typeof data === 'object' && 'success' in data) {
          return {
            ...data,
            traceId: data.traceId || traceId,
            timestamp: data.timestamp || timestamp,
          };
        }

        // Wrap response in standard format
        return {
          success: true,
          data,
          traceId,
          timestamp,
        };
      }),
    );
  }
}