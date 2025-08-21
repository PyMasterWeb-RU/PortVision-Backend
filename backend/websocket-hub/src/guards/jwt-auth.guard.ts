import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn(`❌ Попытка доступа без токена: ${request.path}`);
      throw new UnauthorizedException('Токен не предоставлен');
    }

    try {
      const payload = this.jwtService.verify(token);
      
      // Сохраняем данные пользователя в request для использования в контроллерах
      (request as any).user = payload;
      
      this.logger.debug(`✅ Авторизован пользователь: ${payload.sub} (${payload.email}) для ${request.path}`);
      return true;

    } catch (error) {
      this.logger.warn(`❌ Недействительный токен для ${request.path}: ${error.message}`);
      
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Токен истек');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Недействительный токен');
      }
      
      throw new UnauthorizedException('Ошибка верификации токена');
    }
  }

  private extractTokenFromHeader(request: Request): string | null {
    // Проверяем заголовок Authorization
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Проверяем query параметр token
    if (request.query.token && typeof request.query.token === 'string') {
      return request.query.token;
    }

    // Проверяем cookies
    const cookies = request.headers.cookie;
    if (cookies) {
      const parsedCookies = this.parseCookies(cookies);
      if (parsedCookies.access_token) {
        return parsedCookies.access_token;
      }
    }

    return null;
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }
}