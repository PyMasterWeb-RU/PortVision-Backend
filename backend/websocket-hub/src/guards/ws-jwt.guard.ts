import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        throw new WsException('Токен не предоставлен');
      }

      const payload = this.jwtService.verify(token);
      
      // Сохраняем данные пользователя в сокете
      client.data.user = payload;
      
      this.logger.debug(`✅ Авторизован пользователь: ${payload.sub} (${payload.email})`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Ошибка авторизации WebSocket: ${error.message}`);
      throw new WsException('Недействительный токен');
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // Пытаемся получить токен из разных источников
    
    // 1. Из auth объекта при подключении
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // 2. Из заголовка Authorization
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 3. Из query параметров
    if (client.handshake.query?.token) {
      return Array.isArray(client.handshake.query.token) 
        ? client.handshake.query.token[0] 
        : client.handshake.query.token;
    }

    // 4. Из cookies (если используются)
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = this.parseCookies(cookieHeader);
      if (cookies.access_token) {
        return cookies.access_token;
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