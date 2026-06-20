import { describe, expect, it } from 'vitest';
import {
  FAST_MODEL_BY_PROTOCOL,
  SUGGESTED_MODELS_BY_PROTOCOL,
} from '../../src/state/apiProtocols';

describe('apiProtocols table consistency', () => {
  it('FAST_MODEL_BY_PROTOCOL.glm is one of the live suggested models', () => {
    expect(SUGGESTED_MODELS_BY_PROTOCOL.glm).toContain(FAST_MODEL_BY_PROTOCOL.glm);
  });
});
