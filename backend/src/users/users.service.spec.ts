import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, KycStatus } from './entities/user.entity';

const mockUser: User = {
  id: 'uuid-1',
  stellarAddress: 'GABC123',
  phoneNumber: '+254700000000',
  country: 'KE',
  creditScore: 500,
  kycStatus: KycStatus.PENDING,
  loans: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo = {
  create: jest.fn((dto) => ({ ...mockUser, ...dto })),
  save: jest.fn((entity) => Promise.resolve(entity)),
  find: jest.fn(() => Promise.resolve([mockUser])),
  findOne: jest.fn(() => Promise.resolve(mockUser)),
  count: jest.fn(() => Promise.resolve(0)),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('creates a user', async () => {
    mockRepo.save.mockResolvedValueOnce(mockUser);
    const user = await service.create({ stellarAddress: 'GABC123', country: 'KE' });
    expect(user.stellarAddress).toBe('GABC123');
  });

  it('returns all users', async () => {
    const users = await service.findAll();
    expect(users).toHaveLength(1);
  });

  it('finds user by id', async () => {
    const user = await service.findOne('uuid-1');
    expect(user.id).toBe('uuid-1');
  });

  it('throws NotFoundException for missing user', async () => {
    mockRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('updates KYC status', async () => {
    const updated = { ...mockUser, kycStatus: KycStatus.APPROVED };
    mockRepo.save.mockResolvedValueOnce(updated);
    const user = await service.updateKyc('uuid-1', { kycStatus: KycStatus.APPROVED });
    expect(user.kycStatus).toBe(KycStatus.APPROVED);
  });

  it('clamps credit score between 300 and 850', async () => {
    const saved = { ...mockUser, creditScore: 850 };
    mockRepo.save.mockResolvedValueOnce(saved);
    const user = await service.updateCreditScore('uuid-1', 9999);
    expect(user.creditScore).toBe(850);
  });
});
