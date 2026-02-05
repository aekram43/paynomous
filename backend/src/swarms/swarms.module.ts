import { Module } from '@nestjs/common';
import { SwarmsController } from './swarms.controller';
import { SwarmsService } from './swarms.service';

@Module({
  controllers: [SwarmsController],
  providers: [SwarmsService],
  exports: [SwarmsService],
})
export class SwarmsModule {}
