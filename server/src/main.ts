import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // 启用 CORS（开发环境）
  app.enableCors();
  
  // Serve 静态文件（Web 前端）
  const webDistPath = join(__dirname, '..', '..', 'web', 'dist');
  app.useStaticAssets(webDistPath);
  
  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  
  logger.log(`🚀 Server is running on: http://localhost:${port}`);
  logger.log(`📡 WebSocket endpoint: ws://localhost:${port}`);
  logger.log(`🤖 Agent system initialized`);
}

bootstrap();
