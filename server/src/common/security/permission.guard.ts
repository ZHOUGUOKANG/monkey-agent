import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PermissionService } from './permission.service';

/**
 * Permission Guard
 * 
 * 用于 WebSocket 的权限验证
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private permissionService: PermissionService) {}

  canActivate(context: ExecutionContext): boolean {
    const data = context.switchToWs().getData();
    const operation = data.type;
    const payload = data.payload;

    // 根据操作类型进行权限检查
    switch (operation) {
      case 'execute-workflow':
        return this.validateWorkflow(payload);
      default:
        return true; // 默认允许
    }
  }

  private validateWorkflow(payload: any): boolean {
    // 可以在这里添加更细粒度的工作流验证
    // 例如检查工作流中的文件路径、命令等
    return true;
  }
}

