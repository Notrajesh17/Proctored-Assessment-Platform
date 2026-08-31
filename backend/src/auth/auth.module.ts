import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configuredSecret = config.get<string>('JWT_SECRET');
        if (
          !configuredSecret &&
          config.get<string>('NODE_ENV') === 'production'
        ) {
          throw new Error('JWT_SECRET is required in production');
        }
        return {
          secret: configuredSecret || 'dev-secret',
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
              '8h') as `${number}h`,
          },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
