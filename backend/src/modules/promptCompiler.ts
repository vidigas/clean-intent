import type { Intent } from '../types/intentSchema.js';

export function compilePrompt(intent: Intent): string {
  const sections: string[] = [];

  sections.push(intent.primaryGoal);

  const contextParts: string[] = [];

  if (intent.audience) {
    contextParts.push(`Target audience: ${intent.audience}`);
  }

  if (intent.domain) {
    contextParts.push(`Domain: ${intent.domain}`);
  }

  if (contextParts.length > 0) {
    sections.push('');
    sections.push(contextParts.join('. ') + '.');
  }

  const allConstraints = [
    ...intent.constraints.hard.map((c) => c.text),
    ...intent.constraints.soft.map((c) => c.text),
  ];

  if (allConstraints.length > 0) {
    sections.push('');
    sections.push('Requirements:');
    for (const constraint of allConstraints) {
      sections.push(`- ${constraint}`);
    }
  }

  if (intent.outputExpectations) {
    const outputParts: string[] = [];

    if (intent.outputExpectations.length && intent.outputExpectations.length !== 'any') {
      const lengthMap: Record<string, string> = {
        short: 'Keep the response concise',
        medium: 'Provide a balanced, moderate-length response',
        long: 'Provide a comprehensive, detailed response',
      };
      outputParts.push(lengthMap[intent.outputExpectations.length] || '');
    }

    if (intent.outputExpectations.format) {
      outputParts.push(`Format the output as ${intent.outputExpectations.format}`);
    }

    if (intent.outputExpectations.structure && intent.outputExpectations.structure.length > 0) {
      outputParts.push(`Include: ${intent.outputExpectations.structure.join(', ')}`);
    }

    if (outputParts.length > 0) {
      sections.push('');
      sections.push(outputParts.join('. ') + '.');
    }
  }

  return sections.join('\n').trim();
}
