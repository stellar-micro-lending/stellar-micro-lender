import { Repository } from 'typeorm';
import { Loan } from './entities/loan.entity';
import { CreateLoanDto, RepayLoanDto } from './dto/loan.dto';
import { UsersService } from '../users/users.service';
export declare class LoansService {
    private repo;
    private usersService;
    constructor(repo: Repository<Loan>, usersService: UsersService);
    create(dto: CreateLoanDto): Promise<Loan>;
    repay(loanId: string, dto: RepayLoanDto): Promise<Loan>;
    markDefaulted(loanId: string): Promise<Loan>;
    findAll(): Promise<Loan[]>;
    findOne(id: string): Promise<Loan>;
    findByBorrower(borrowerId: string): Promise<Loan[]>;
    private getTotalRepaid;
    private maxLoanAmount;
}
