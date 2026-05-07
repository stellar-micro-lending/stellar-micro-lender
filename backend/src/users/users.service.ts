import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateKycDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  create(dto: CreateUserDto): Promise<User> {
    return this.repo.save(this.repo.create(dto));
  }

  findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id }, relations: ['loans'] });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByStellarAddress(address: string): Promise<User | null> {
    return this.repo.findOne({ where: { stellarAddress: address } });
  }

  async updateKyc(id: string, dto: UpdateKycDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async updateCreditScore(id: string, score: number): Promise<User> {
    const user = await this.findOne(id);
    user.creditScore = Math.min(850, Math.max(300, score));
    return this.repo.save(user);
  }
}
