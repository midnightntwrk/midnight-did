import type { ActionHint } from '../cli-api';

export const renderHints = (hints: ActionHint[]): string => {
  if (hints.length === 0) return '';
  const lines = ['Next action hints:'];
  for (const hint of hints.slice(0, 5)) {
    lines.push(`  - ${hint.action}: ${hint.reason}`);
  }
  return lines.join('\n');
};
