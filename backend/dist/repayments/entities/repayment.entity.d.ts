import { Loan } from '../../loans/entities/loan.entity';
export declare class Repayment {
    id: string;
    loan: Loan;
    amount: number;
    txHash: string;
    createdAt: Date;
}
