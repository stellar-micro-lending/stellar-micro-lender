import { UsersService } from './users.service';
import { CreateUserDto, UpdateKycDto } from './dto/user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(dto: CreateUserDto): Promise<import("./entities/user.entity").User>;
    findAll(): Promise<import("./entities/user.entity").User[]>;
    findOne(id: string): Promise<import("./entities/user.entity").User>;
    updateKyc(id: string, dto: UpdateKycDto): Promise<import("./entities/user.entity").User>;
}
