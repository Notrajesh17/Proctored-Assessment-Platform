import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/roles.guard';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe';
import type { AuthUser } from '../common/types';
import { ProctorEventDto, SaveAnswersDto } from '../assessments/dto';
import { AttemptsService } from './attempts.service';

@ApiTags('attempts')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AttemptsController {
  constructor(private attempts: AttemptsService) {}

  @Post('assignments/:id/start')
  @Roles('candidate')
  start(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.start(id, user);
  }

  @Get('attempts/:id')
  get(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.get(id, user);
  }

  @Patch('attempts/:id/answers')
  @Roles('candidate')
  save(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SaveAnswersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.saveAnswers(id, dto.answers, user);
  }

  @Post('attempts/:id/submit')
  @Roles('candidate')
  submit(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.submit(id, user, false);
  }

  @Post('attempts/:id/events')
  @Roles('candidate')
  event(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ProctorEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.recordEvent(id, dto.type, user, dto.meta);
  }

  @Get('attempts/:id/events')
  timeline(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attempts.timeline(id, user);
  }
}
