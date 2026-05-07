import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateKycDto } from './dto/user.dto';
export declare class UsersService {
    private repo;
    constructor(repo: Repository<User>);
    create(dto: CreateUserDto): Promise<User>;
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User>;
    findByStellarAddress(address: string): Promise<User | null>;
    updateKyc(id: string, dto: UpdateKycDto): Promise<User>;
    updateCreditScore(id: string, score: number): Promise<User>;
}
