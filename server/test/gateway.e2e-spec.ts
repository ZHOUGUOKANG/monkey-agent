import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { io, Socket } from 'socket.io-client';

describe('Agent Gateway (e2e)', () => {
  let app: INestApplication;
  let client: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3001); // 使用不同端口避免冲突

    // 创建 Socket.IO 客户端
    client = io('http://localhost:3001', {
      transports: ['websocket'],
    });

    await new Promise(resolve => {
      client.on('connect', resolve);
    });
  });

  afterAll(async () => {
    client.close();
    await app.close();
  });

  it('should connect to WebSocket', (done) => {
    client.on('connected', (data) => {
      expect(data.clientId).toBeDefined();
      done();
    });
  });

  it('should handle get-agents message', (done) => {
    const messageId = `test-${Date.now()}`;
    
    client.emit('get-agents', { id: messageId });
    
    client.once('response', (data) => {
      if (data.id === messageId) {
        expect(data.payload.agents).toBeDefined();
        expect(Array.isArray(data.payload.agents)).toBe(true);
        done();
      }
    });
  });

  // 注意：chat 测试需要有效的 LLM API Key
  // it('should handle chat message', (done) => { ... });
});

