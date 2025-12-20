/**
 * 意图识别 Zod Schema
 */

import { z } from 'zod';
import { IntentType } from './types';

/**
 * 意图识别结果的 Zod Schema
 */
export const intentSchema = z.object({
  intent: z.nativeEnum(IntentType),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  entities: z.record(z.any()).optional(),
  needsMultiAgent: z.boolean(),
});

