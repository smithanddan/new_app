import type { NormalizedLabResult } from '@labmind/shared';

export type AiReportInput = {
  patientProfile: { sex?: string | null; birthdate?: string | null };
  latestResults: NormalizedLabResult[];
  historicalResults?: NormalizedLabResult[];
};

export type AiReportOutput = {
  summary: string;
  keyFindings: string[];
  nextSteps: string[];
  disclaimer: string;
};

export const LAB_REPORT_SYSTEM_PROMPT = `Ты медицинский ассистент по лабораторной диагностике. Не ставь диагнозы. Не назначай лечение. Анализируй только предоставленные показатели, значения, единицы и референсы. Всегда добавляй дисклеймер: Это не медицинский диагноз. Проконсультируйтесь с врачом.`;

export async function generateAiReport(input: AiReportInput): Promise<AiReportOutput> {
  // TODO: Call LLM with JSON schema and guardrails.
  return {
    summary: `Найдено ${input.latestResults.length} показателей. AI-отчёт пока в mock-режиме.`,
    keyFindings: [],
    nextSteps: ['Проверьте распознанные данные перед медицинской интерпретацией.'],
    disclaimer: 'Это не медицинский диагноз. Проконсультируйтесь с врачом.',
  };
}
