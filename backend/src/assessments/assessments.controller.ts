import {
  Body,
  Controller,
  Delete,
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

import { AssessmentsService } from './assessments.service';
import {
  AssignDto,
  CreateAssessmentDto,
  CreateQuestionDto,
  UpdateAssessmentDto,
  UpdateQuestionDto,
} from './dto';

@ApiTags('assessments')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AssessmentsController {
  constructor(private assessments: AssessmentsService) {}

  @Get('assessments')
  @Roles('admin')
  list(): Promise<any> {
    return this.assessments.listForAdmin();
  }

  @Post('assessments')
  @Roles('admin')
  create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<any> {
    return this.assessments.create(dto, user);
  }

  @Get('assessments/:id')
  @Roles('admin')
  get(@Param('id', ParseObjectIdPipe) id: string): Promise<any> {
    return this.assessments.get(id);
  }

  @Patch('assessments/:id')
  @Roles('admin')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
  ): Promise<any> {
    return this.assessments.update(id, dto);
  }

  @Delete('assessments/:id')
  @Roles('admin')
  remove(@Param('id', ParseObjectIdPipe) id: string): Promise<any> {
    return this.assessments.remove(id);
  }

  @Post('assessments/:id/questions')
  @Roles('admin')
  addQuestion(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: CreateQuestionDto,
  ): Promise<any> {
    return this.assessments.addQuestion(id, dto);
  }

  @Patch('questions/:id')
  @Roles('admin')
  updateQuestion(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<any> {
    return this.assessments.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  @Roles('admin')
  removeQuestion(@Param('id', ParseObjectIdPipe) id: string): Promise<any> {
    return this.assessments.removeQuestion(id);
  }

  @Post('assessments/:id/assign')
  @Roles('admin')
  assign(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AssignDto,
    @CurrentUser() user: AuthUser,
  ): Promise<any> {
    return this.assessments.assign(id, dto, user);
  }

  @Get('assessments/:id/submissions')
  @Roles('admin')
  submissions(@Param('id', ParseObjectIdPipe) id: string): Promise<any> {
    return this.assessments.submissions(id);
  }

  @Get('me/assignments')
  @Roles('candidate')
  myAssignments(@CurrentUser() user: AuthUser): Promise<any> {
    return this.assessments.myAssignments(user.sub);
  }
}
