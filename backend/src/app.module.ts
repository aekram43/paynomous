import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { AgentsModule } from './agents/agents.module';
import { SwarmsModule } from './swarms/swarms.module';
import { DealsModule } from './deals/deals.module';
import { NftsModule } from './nfts/nfts.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    AuthModule,
    RoomsModule,
    AgentsModule,
    SwarmsModule,
    DealsModule,
    NftsModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
