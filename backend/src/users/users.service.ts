import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import type { Role } from '../common/types';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private users: Model<UserDocument>) {}

  findByEmail(email: string) {
    return this.users.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string) {
    return this.users.findById(id).exec();
  }

  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: Role;
  }) {
    return this.users.create(data);
  }

  listByRole(role?: Role) {
    const filter = role ? { role } : {};
    return this.users
      .find(filter)
      .select('-passwordHash')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  findCandidatesByIds(ids: string[]) {
    return this.users
      .find({ _id: { $in: ids }, role: 'candidate' })
      .select('_id')
      .lean()
      .exec();
  }

  async mustFind(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
