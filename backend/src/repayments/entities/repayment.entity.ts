import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Loan } from '../../loans/entities/loan.entity';

@Entity('repayments')
export class Repayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Loan, (loan) => loan.repayments)
  loan: Loan;

  @Column({ type: 'decimal', precision: 18, scale: 7 })
  amount: number;

  @Column({ nullable: true })
  txHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
