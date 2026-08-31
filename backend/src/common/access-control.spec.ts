import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ParseObjectIdPipe } from './parse-object-id.pipe';
import { RolesGuard } from './roles.guard';

describe('access control helpers', () => {
  it('rejects malformed route identifiers', () => {
    expect(() => new ParseObjectIdPipe().transform('not-an-id')).toThrow(
      BadRequestException,
    );
  });

  it('allows matching roles and rejects other roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    const contextFor = (role: 'admin' | 'candidate') =>
      ({
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role } }),
        }),
      }) as unknown as ExecutionContext;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextFor('admin'))).toBe(true);
    expect(() => guard.canActivate(contextFor('candidate'))).toThrow(
      ForbiddenException,
    );
  });
});
