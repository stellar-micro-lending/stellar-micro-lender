import { KycStatus } from '../entities/user.entity';
export declare class CreateUserDto {
    stellarAddress: string;
    phoneNumber?: string;
    country?: string;
}
export declare class UpdateKycDto {
    kycStatus: KycStatus;
}
