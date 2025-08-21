import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DISPATCHER = 'dispatcher',
  OPERATOR = 'operator',
  GATE_OPERATOR = 'gate_operator',
  VIEWER = 'viewer',
  CLIENT = 'client',
  MAINTENANCE = 'maintenance',
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userRoles = user.roles || [];
    
    const hasRole = requiredRoles.some((role) => 
      userRoles.includes(role) || userRoles.includes(UserRole.ADMIN)
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}