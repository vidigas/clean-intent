import type { Intent } from '../types/intentSchema.js';

export function generateIRL(intent: Intent): string {
  const lines: string[] = [];

  lines.push(`@goal ${intent.primaryGoal}`);

  if (intent.taskType) {
    lines.push(`@task ${intent.taskType}`);
  }

  if (intent.audience) {
    lines.push(`@audience ${intent.audience}`);
  }

  if (intent.domain) {
    lines.push(`@domain ${intent.domain}`);
  }

  if (intent.constraints.hard.length > 0) {
    lines.push('');
    lines.push('@constraints hard');
    for (const constraint of intent.constraints.hard) {
      lines.push(`- ${constraint.text}`);
    }
  }

  if (intent.constraints.soft.length > 0) {
    lines.push('');
    lines.push('@preferences');
    for (const constraint of intent.constraints.soft) {
      lines.push(`- ${constraint.text}`);
    }
  }

  if (intent.outputExpectations) {
    lines.push('');
    lines.push('@output');
    if (intent.outputExpectations.length) {
      lines.push(`- Length: ${intent.outputExpectations.length}`);
    }
    if (intent.outputExpectations.format) {
      lines.push(`- Format: ${intent.outputExpectations.format}`);
    }
    if (intent.outputExpectations.structure && intent.outputExpectations.structure.length > 0) {
      lines.push(`- Structure: ${intent.outputExpectations.structure.join(', ')}`);
    }
  }

  if (intent.conflicts.length > 0) {
    lines.push('');
    lines.push('@conflicts');
    for (const conflict of intent.conflicts) {
      const severity = conflict.severity === 'blocking' ? '[BLOCKING]' : '[WARNING]';
      lines.push(`- ${severity} ${conflict.description}`);
    }
  }

  if (intent.assumptions.length > 0) {
    lines.push('');
    lines.push('@assumptions');
    for (const assumption of intent.assumptions) {
      lines.push(`- ${assumption}`);
    }
  }

  return lines.join('\n');
}
