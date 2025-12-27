import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './permission.guard';

/**
 * Security Module
 * 
 * 提供权限控制和安全相关功能
 */
@Module({
  imports: [ConfigModule],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class SecurityModule {}

