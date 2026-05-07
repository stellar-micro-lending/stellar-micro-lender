import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto, RepayLoanDto } from './dto/loan.dto';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  create(@Body() dto: CreateLoanDto) {
    return this.loansService.create(dto);
  }

  @Get()
  findAll() {
    return this.loansService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Post(':id/repay')
  repay(@Param('id') id: string, @Body() dto: RepayLoanDto) {
    return this.loansService.repay(id, dto);
  }

  @Patch(':id/default')
  markDefaulted(@Param('id') id: string) {
    return this.loansService.markDefaulted(id);
  }
}
