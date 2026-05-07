import { IsDateString, IsNumber, IsPositive, IsUUID, Max, Min } from 'class-validator';

export class CreateLoanDto {
  @IsUUID()
  borrowerId: string;

  @IsNumber()
  @IsPositive()
  @Max(50) // max $50 micro-loan
  amount: number;

  @IsDateString()
  dueDate: string;
}

export class RepayLoanDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsUUID()
  payerId: string;
}
