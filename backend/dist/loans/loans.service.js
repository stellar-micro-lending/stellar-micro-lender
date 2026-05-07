"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoansService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const loan_entity_1 = require("./entities/loan.entity");
const users_service_1 = require("../users/users.service");
const user_entity_1 = require("../users/entities/user.entity");
const INTEREST_RATE = 10;
const MAX_ACTIVE_LOANS = 1;
let LoansService = class LoansService {
    repo;
    usersService;
    constructor(repo, usersService) {
        this.repo = repo;
        this.usersService = usersService;
    }
    async create(dto) {
        const borrower = await this.usersService.findOne(dto.borrowerId);
        if (borrower.kycStatus !== user_entity_1.KycStatus.APPROVED) {
            throw new common_1.BadRequestException('KYC not approved');
        }
        const activeLoans = await this.repo.count({
            where: { borrower: { id: dto.borrowerId }, status: loan_entity_1.LoanStatus.ACTIVE },
        });
        if (activeLoans >= MAX_ACTIVE_LOANS) {
            throw new common_1.BadRequestException('Active loan limit reached');
        }
        const maxAmount = this.maxLoanAmount(borrower.creditScore);
        if (dto.amount > maxAmount) {
            throw new common_1.BadRequestException(`Max loan for credit score ${borrower.creditScore} is $${maxAmount}`);
        }
        const loan = this.repo.create({
            borrower,
            amount: dto.amount,
            interestRate: INTEREST_RATE,
            dueDate: new Date(dto.dueDate),
            status: loan_entity_1.LoanStatus.ACTIVE,
        });
        return this.repo.save(loan);
    }
    async repay(loanId, dto) {
        const loan = await this.findOne(loanId);
        if (loan.status !== loan_entity_1.LoanStatus.ACTIVE) {
            throw new common_1.BadRequestException('Loan is not active');
        }
        const totalDue = loan.amount * (1 + loan.interestRate / 100);
        const totalRepaid = await this.getTotalRepaid(loanId);
        if (totalRepaid + dto.amount >= totalDue) {
            loan.status = loan_entity_1.LoanStatus.REPAID;
            await this.usersService.updateCreditScore(loan.borrower.id, loan.borrower.creditScore + 20);
        }
        return this.repo.save(loan);
    }
    async markDefaulted(loanId) {
        const loan = await this.findOne(loanId);
        if (loan.status !== loan_entity_1.LoanStatus.ACTIVE) {
            throw new common_1.BadRequestException('Loan is not active');
        }
        if (new Date() <= loan.dueDate) {
            throw new common_1.BadRequestException('Loan not yet overdue');
        }
        loan.status = loan_entity_1.LoanStatus.DEFAULTED;
        await this.usersService.updateCreditScore(loan.borrower.id, loan.borrower.creditScore - 80);
        return this.repo.save(loan);
    }
    findAll() {
        return this.repo.find({ relations: ['borrower'] });
    }
    async findOne(id) {
        const loan = await this.repo.findOne({
            where: { id },
            relations: ['borrower', 'repayments'],
        });
        if (!loan)
            throw new common_1.NotFoundException(`Loan ${id} not found`);
        return loan;
    }
    async findByBorrower(borrowerId) {
        return this.repo.find({
            where: { borrower: { id: borrowerId } },
            relations: ['repayments'],
        });
    }
    async getTotalRepaid(loanId) {
        const result = await this.repo
            .createQueryBuilder('loan')
            .leftJoin('loan.repayments', 'r')
            .select('COALESCE(SUM(r.amount), 0)', 'total')
            .where('loan.id = :loanId', { loanId })
            .getRawOne();
        return parseFloat(result?.total ?? '0');
    }
    maxLoanAmount(score) {
        if (score >= 750)
            return 50;
        if (score >= 650)
            return 25;
        if (score >= 550)
            return 10;
        return 5;
    }
};
exports.LoansService = LoansService;
exports.LoansService = LoansService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(loan_entity_1.Loan)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        users_service_1.UsersService])
], LoansService);
//# sourceMappingURL=loans.service.js.map