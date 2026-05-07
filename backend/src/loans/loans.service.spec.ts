import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { LoansService } from './loans.service';
import { Loan, LoanStatus } from './entities/loan.entity';
import { UsersService } from '../users/users.service';
import { KycStatus } from '../users/entities/user.entity';

const mockBorrower = {
  id: 'user-1',
  stellarAddress: 'GABC',
  creditScore: 600, // score 600 → max $25, enough for $7 test loan
  kycStatus: KycStatus.APPROVED,
  loans: [],
};

const mockLoan: Loan = {
  id: 'loan-1',
  borrower: mockBorrower as any,
  amount: 7,
  interestRate: 10,
  dueDate: new Date(Date.now() + 86400000 * 30),
  status: LoanStatus.ACTIVE,
  contractLoanId: null,
  txHash: null,
  repayments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo = {
  create: jest.fn((dto) => ({ ...mockLoan, ...dto })),
  save: jest.fn((e) => Promise.resolve(e)),
  find: jest.fn(() => Promise.resolve([mockLoan])),
  findOne: jest.fn(() => Promise.resolve({ ...mockLoan })),
  count: jest.fn(() => Promise.resolve(0)),
  createQueryBuilder: jest.fn(() => ({
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
  })),
};

const mockUsersService = {
  findOne: jest.fn(() => Promise.resolve(mockBorrower)),
  updateCreditScore: jest.fn(() => Promise.resolve(mockBorrower)),
};

describe('LoansService', () => {
  let service: LoansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useValue: mockRepo },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();
    service = module.get<LoansService>(LoansService);
    jest.clearAllMocks();
    // Restore default implementations after clearAllMocks
    mockUsersService.findOne.mockResolvedValue(mockBorrower);
    mockUsersService.updateCreditScore.mockResolvedValue(mockBorrower);
    mockRepo.save.mockImplementation((e: Loan) => Promise.resolve(e));
    mockRepo.count.mockResolvedValue(0);
    mockRepo.createQueryBuilder.mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    });
  });

  it('creates a loan for approved user', async () => {
    mockRepo.create.mockReturnValueOnce(mockLoan);
    const loan = await service.create({
      borrowerId: 'user-1',
      amount: 7,
      dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    });
    expect(loan.status).toBe(LoanStatus.ACTIVE);
  });

  it('rejects loan if KYC not approved', async () => {
    mockUsersService.findOne.mockResolvedValueOnce({
      ...mockBorrower,
      kycStatus: KycStatus.PENDING,
    });
    await expect(
      service.create({ borrowerId: 'user-1', amount: 5, dueDate: '2026-12-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects loan exceeding credit limit', async () => {
    mockUsersService.findOne.mockResolvedValueOnce({
      ...mockBorrower,
      creditScore: 400, // max $5
    });
    await expect(
      service.create({ borrowerId: 'user-1', amount: 10, dueDate: '2026-12-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks loan repaid when full amount paid', async () => {
    mockRepo.findOne.mockResolvedValueOnce({ ...mockLoan, status: LoanStatus.ACTIVE });
    const loan = await service.repay('loan-1', { amount: 7.7, payerId: 'user-1' });
    expect(loan.status).toBe(LoanStatus.REPAID);
  });

  it('marks loan defaulted when overdue', async () => {
    mockRepo.findOne.mockResolvedValueOnce({
      ...mockLoan,
      dueDate: new Date(Date.now() - 86400000),
    });
    const loan = await service.markDefaulted('loan-1');
    expect(loan.status).toBe(LoanStatus.DEFAULTED);
  });
});
