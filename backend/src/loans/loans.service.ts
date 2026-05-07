import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan, LoanStatus } from './entities/loan.entity';
import { CreateLoanDto, RepayLoanDto } from './dto/loan.dto';
import { UsersService } from '../users/users.service';
import { KycStatus } from '../users/entities/user.entity';

const INTEREST_RATE = 10; // 10% flat per loan
const MAX_ACTIVE_LOANS = 1;

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan) private repo: Repository<Loan>,
    private usersService: UsersService,
  ) {}

  async create(dto: CreateLoanDto): Promise<Loan> {
    const borrower = await this.usersService.findOne(dto.borrowerId);

    if (borrower.kycStatus !== KycStatus.APPROVED) {
      throw new BadRequestException('KYC not approved');
    }

    const activeLoans = await this.repo.count({
      where: { borrower: { id: dto.borrowerId }, status: LoanStatus.ACTIVE },
    });
    if (activeLoans >= MAX_ACTIVE_LOANS) {
      throw new BadRequestException('Active loan limit reached');
    }

    const maxAmount = this.maxLoanAmount(borrower.creditScore);
    if (dto.amount > maxAmount) {
      throw new BadRequestException(
        `Max loan for credit score ${borrower.creditScore} is $${maxAmount}`,
      );
    }

    const loan = this.repo.create({
      borrower,
      amount: dto.amount,
      interestRate: INTEREST_RATE,
      dueDate: new Date(dto.dueDate),
      status: LoanStatus.ACTIVE,
    });
    return this.repo.save(loan);
  }

  async repay(loanId: string, dto: RepayLoanDto): Promise<Loan> {
    const loan = await this.findOne(loanId);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Loan is not active');
    }

    const totalDue = Math.round(loan.amount * (1 + loan.interestRate / 100) * 1e7) / 1e7;
    const totalRepaid = await this.getTotalRepaid(loanId);

    if (totalRepaid + dto.amount >= totalDue) {
      loan.status = LoanStatus.REPAID;
      // Reward credit score
      await this.usersService.updateCreditScore(
        loan.borrower.id,
        loan.borrower.creditScore + 20,
      );
    }
    return this.repo.save(loan);
  }

  async markDefaulted(loanId: string): Promise<Loan> {
    const loan = await this.findOne(loanId);
    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Loan is not active');
    }
    if (new Date() <= loan.dueDate) {
      throw new BadRequestException('Loan not yet overdue');
    }
    loan.status = LoanStatus.DEFAULTED;
    await this.usersService.updateCreditScore(
      loan.borrower.id,
      loan.borrower.creditScore - 80,
    );
    return this.repo.save(loan);
  }

  findAll(): Promise<Loan[]> {
    return this.repo.find({ relations: ['borrower'] });
  }

  async findOne(id: string): Promise<Loan> {
    const loan = await this.repo.findOne({
      where: { id },
      relations: ['borrower', 'repayments'],
    });
    if (!loan) throw new NotFoundException(`Loan ${id} not found`);
    return loan;
  }

  async findByBorrower(borrowerId: string): Promise<Loan[]> {
    return this.repo.find({
      where: { borrower: { id: borrowerId } },
      relations: ['repayments'],
    });
  }

  private async getTotalRepaid(loanId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('loan')
      .leftJoin('loan.repayments', 'r')
      .select('COALESCE(SUM(r.amount), 0)', 'total')
      .where('loan.id = :loanId', { loanId })
      .getRawOne<{ total: string }>();
    return parseFloat(result?.total ?? '0');
  }

  /** Progressive lending: credit score determines max loan size */
  private maxLoanAmount(score: number): number {
    if (score >= 750) return 50;
    if (score >= 650) return 25;
    if (score >= 550) return 10;
    return 5;
  }
}
