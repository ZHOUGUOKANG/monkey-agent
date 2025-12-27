import { Module } from '@nestjs/common';
import { AgentGateway } from './agent.gateway';
import { AdaptersModule } from '../adapters/adapters.module';

/**
 * Gateway Module
 * 
 * 提供 WebSocket 接口
 */
@Module({
  imports: [AdaptersModule],
  providers: [AgentGateway],
  exports: [AgentGateway],
})
export class GatewayModule {}

