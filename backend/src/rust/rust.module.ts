import { Global, Module } from '@nestjs/common';
import { RustService } from './rust.service';

@Global()
@Module({
  providers: [RustService],
  exports: [RustService],
})
export class RustModule {}
