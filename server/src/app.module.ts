import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayModule } from './gateway/gateway.module';
import { AdaptersModule } from './adapters/adapters.module';
import { SecurityModule } from './common/security/security.module';

/**
 * App Module
 * 
 * 根模块 - 组装所有功能模块
 */
@Module({
  imports: [
    // 全局配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // WebSocket Gateway
    GatewayModule,
    // 核心包适配器
    AdaptersModule,
    // 安全模块
    SecurityModule,
  ],
})
export class AppModule {}
