import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import type { AuthUser } from '../common/types';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    const payload: AuthUser = {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: payload,
    };
  }

  async register(email: string, password: string, name: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.create({
      email,
      passwordHash,
      name,
      role: 'candidate',
    });
    return this.login(user.email, password);
  }
}
