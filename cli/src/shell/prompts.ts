import { type Interface } from 'node:readline/promises';

export const ask = async (rli: Interface, question: string): Promise<string> => rli.question(question);
