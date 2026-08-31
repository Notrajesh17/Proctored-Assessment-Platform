import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

@Catch(MongoServerError, MongooseError.CastError)
export class MongoExceptionFilter implements ExceptionFilter {
  catch(
    exception: MongoServerError | MongooseError.CastError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof MongooseError.CastError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid identifier',
        error: 'Bad Request',
      });
      return;
    }
    if (exception.code === 11000) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with these details already exists',
        error: 'Conflict',
      });
      return;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database operation failed',
      error: 'Internal Server Error',
    });
  }
}
