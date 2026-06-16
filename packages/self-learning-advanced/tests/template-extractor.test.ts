// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , Template extractor tests
import { describe, it, expect } from 'vitest';
import { TemplateExtractor } from '../src/template-extractor';
import type { ObservationEvent } from '@orqenix/self-learning-observer';

describe('TemplateExtractor', () => {
  const extractor = new TemplateExtractor();

  it('extracts template from varying command arguments', () => {
    const events = [
      { action_payload: { command: 'git commit -m fix typo' } },
      { action_payload: { command: 'git commit -m add feature' } },
      { action_payload: { command: 'git commit -m refactor module' } },
    ] as ObservationEvent[];
    const templates = extractor.extract(events);
    expect(templates.length).toBeGreaterThanOrEqual(1);
    const t = templates[0]!;
    expect(t.template).toContain('{arg');
    expect(t.parameters.length).toBeGreaterThanOrEqual(1);
    expect(t.occurrenceCount).toBe(3);
  });

  it('returns empty for single event (no variation)', () => {
    const events = [
      { action_payload: { command: 'git status' } },
    ] as ObservationEvent[];
    const templates = extractor.extract(events);
    expect(templates).toHaveLength(0);
  });

  it('ignores empty commands', () => {
    const events = [
      { action_payload: { command: '' } },
    ] as ObservationEvent[];
    const templates = extractor.extract(events);
    expect(templates).toHaveLength(0);
  });
});
