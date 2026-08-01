// SPDX-License-Identifier: BUSL-1.1
// @orqenix-pro/self-learning-advanced , Template extractor
//
// Parameterizes variations across observations into templates. Pro feature.

import type { ObservationEvent } from '@orqenix/self-learning-observer';
import type { ExtractedTemplate } from './types';

export class TemplateExtractor {
  /**
   * Extracts templates by finding the common structure across observed command
   * strings and replacing varying segments with {placeholders}.
   *
   * Example: ["git commit -m 'a'", "git commit -m 'b'"]
   *       → "git commit -m {arg1}"
   */
  extract(events: ObservationEvent[]): ExtractedTemplate[] {
    // Group by action kind + structural shape
    const byShape = new Map<string, string[]>();
    for (const e of events) {
      const command = (e.action_payload.command as string) ?? '';
      if (!command) continue;
      const shape = this.structuralShape(command);
      const arr = byShape.get(shape) ?? [];
      arr.push(command);
      byShape.set(shape, arr);
    }

    const templates: ExtractedTemplate[] = [];
    for (const [, commands] of byShape) {
      if (commands.length < 2) continue;
      const { template, parameters } = this.parameterize(commands);
      templates.push({
        template,
        parameters,
        occurrenceCount: commands.length,
        successRate: 1.0, // refined by caller with outcome data
      });
    }
    return templates;
  }

  /** Reduces a command to its structural shape (token count) */
  private structuralShape(command: string): string {
    return String(command.split(/\s+/).length);
  }

  /** Builds a template by replacing varying tokens with {argN} */
  private parameterize(commands: string[]): { template: string; parameters: string[] } {
    const tokenized = commands.map((c) => c.split(/\s+/));
    const maxLen = Math.max(...tokenized.map((t) => t.length));
    const templateTokens: string[] = [];
    const parameters: string[] = [];
    let argIdx = 0;

    for (let i = 0; i < maxLen; i++) {
      const values = new Set(tokenized.map((t) => t[i] ?? ''));
      if (values.size === 1) {
        templateTokens.push(tokenized[0]?.[i] ?? '');
      } else {
        const param = `arg${++argIdx}`;
        templateTokens.push(`{${param}}`);
        parameters.push(param);
      }
    }

    return { template: templateTokens.join(' '), parameters };
  }
}
