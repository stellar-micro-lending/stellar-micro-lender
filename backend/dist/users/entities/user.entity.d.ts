import { Loan } from '../../loans/entities/loan.entity';
export declare enum KycStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected"
}
export declare class User {
    id: string;
    stellarAddress: string;
    phoneNumber: string;
    country: string;
    creditScore: number;
    kycStatus: KycStatus;
    loans: Loan[];
    createdAt: Date;
    updatedAt: Date;
}
