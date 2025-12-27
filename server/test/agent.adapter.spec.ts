import { Test, TestingModule } from '@nestjs/testing';
import { AgentAdapter } from '../src/adapters/agent.adapter';
import { BrowserAdapter } from '../src/adapters/browser.adapter';
import { ConfigService } from '@nestjs/config';

describe('AgentAdapter', () => {
  let adapter: AgentAdapter;
  let browserAdapter: BrowserAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentAdapter,
        BrowserAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'LLM_PROVIDER': 'openai',
                'OPENAI_API_KEY': 'test-key',
                'LLM_MODEL': 'gpt-4',
                'LLM_TEMPERATURE': '0.7',
                'ALLOWED_DIRECTORIES': '/tmp',
                'ALLOWED_COMMANDS': 'ls,cat',
                'BROWSER_MODE': 'launch',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<AgentAdapter>(AgentAdapter);
    browserAdapter = module.get<BrowserAdapter>(BrowserAdapter);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should get available agents', async () => {
    await adapter.onModuleInit();
    const agents = adapter.getAvailableAgents();
    expect(agents.length).toBeGreaterThan(0);
  });
});

