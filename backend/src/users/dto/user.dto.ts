import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { KycStatus } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  stellarAddress: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}

export class UpdateKycDto {
  @IsEnum(KycStatus)
  kycStatus: KycStatus;
}
