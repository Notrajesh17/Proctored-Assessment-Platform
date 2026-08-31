import {
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import type { AuthUser } from '../common/types';
import { UsersService } from './users.service';

class CreateCandidateDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(6)
  password: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles('admin')
  list(@Query('role') role?: 'admin' | 'candidate') {
    return this.users.listByRole(role);
  }

  @Post()
  @Roles('admin')
  async createCandidate(@Body() dto: CreateCandidateDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: 'candidate',
    });
    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
