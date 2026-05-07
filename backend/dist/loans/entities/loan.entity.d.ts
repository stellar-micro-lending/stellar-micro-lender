import { User } from '../../users/entities/user.entity';
import { Repayment } from '../../repayments/entities/repayment.entity';
export declare enum LoanStatus {
    PENDING = "pending",
    ACTIVE = "active",
    REPAID = "repaid",
    DEFAULTED = "defaulted"
}
export declare class Loan {
    id: string;
    borrower: User;
    amount: number;
    interestRate: number;
    dueDate: Date;
    status: LoanStatus;
    contractLoanId: string;
    txHash: string;
    repayments: Repayment[];
    createdAt: Date;
    updatedAt: Date;
}
