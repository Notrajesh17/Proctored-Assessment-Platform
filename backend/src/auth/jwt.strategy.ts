import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import type { AuthUser } from '../common/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private users: UsersService,
  ) {
    const configuredSecret = config.get<string>('JWT_SECRET');
    if (!configuredSecret && config.get<string>('NODE_ENV') === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configuredSecret || 'dev-secret',
    });
  }

  async validate(payload: AuthUser): Promise<AuthUser> {
    if (!Types.ObjectId.isValid(payload.sub)) {
      throw new UnauthorizedException('Invalid authentication token');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
