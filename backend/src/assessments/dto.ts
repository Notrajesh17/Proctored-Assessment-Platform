import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class NegativeMarkingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  penalty?: number;
}

export class ProctoringDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxViolations?: number;

  @IsOptional()
  @IsBoolean()
  requireFullscreen?: boolean;
}

export class CreateAssessmentDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  durationMinutes: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => NegativeMarkingDto)
  negativeMarking?: NegativeMarkingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProctoringDto)
  proctoring?: ProctoringDto;
}

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  @IsOptional()
  @ValidateNested()
  @Type(() => NegativeMarkingDto)
  negativeMarking?: NegativeMarkingDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProctoringDto)
  proctoring?: ProctoringDto;
}

export class OptionDto {
  @IsString()
  id: string;

  @IsString()
  @MinLength(1, { message: 'Each option needs some text' })
  text: string;
}

export class CreateQuestionDto {
  @IsIn(['single_choice', 'multiple_choice', 'short_answer'])
  type: 'single_choice' | 'multiple_choice' | 'short_answer';

  @IsString()
  @MinLength(3)
  prompt: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  correctOptionIds?: string[];

  @IsNumber()
  @Min(0)
  points: number;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class AssignDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  candidateIds: string[];
}

export class SaveAnswerDto {
  @IsMongoId()
  questionId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @IsOptional()
  @IsString()
  textAnswer?: string;
}

export class SaveAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveAnswerDto)
  answers: SaveAnswerDto[];
}

export class ProctorEventDto {
  @IsIn([
    'tab_switch',
    'window_blur',
    'fullscreen_exit',
    'copy',
    'paste',
    'right_click',
  ])
  type:
    | 'tab_switch'
    | 'window_blur'
    | 'fullscreen_exit'
    | 'copy'
    | 'paste'
    | 'right_click';

  @IsOptional()
  meta?: Record<string, unknown>;
}
