import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentAdapter } from './agent.adapter';
import { BrowserAdapter } from './browser.adapter';

/**
 * Adapters Module
 * 
 * 集中管理所有核心包的适配器
 */
@Module({
  imports: [ConfigModule],
  providers: [
    BrowserAdapter,
    AgentAdapter,
  ],
  exports: [
    AgentAdapter,
    BrowserAdapter,
  ],
})
export class AdaptersModule {}

