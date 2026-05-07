import { LoansService } from './loans.service';
import { CreateLoanDto, RepayLoanDto } from './dto/loan.dto';
export declare class LoansController {
    private readonly loansService;
    constructor(loansService: LoansService);
    create(dto: CreateLoanDto): Promise<import("./entities/loan.entity").Loan>;
    findAll(): Promise<import("./entities/loan.entity").Loan[]>;
    findOne(id: string): Promise<import("./entities/loan.entity").Loan>;
    repay(id: string, dto: RepayLoanDto): Promise<import("./entities/loan.entity").Loan>;
    markDefaulted(id: string): Promise<import("./entities/loan.entity").Loan>;
}
