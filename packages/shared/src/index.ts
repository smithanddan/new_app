export type LabResultFlag = 'low' | 'normal' | 'high' | 'unknown';

export type ParsedLabItem = {
  nameRaw: string;
  valueRaw: string;
  unitRaw?: string | null;
  refRaw?: string | null;
};

export type NormalizedLabResult = {
  code: string;
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  flag: LabResultFlag;
  confidence: number;
};

export const sampleResults: NormalizedLabResult[] = [
  { code: 'GLU', name: 'Глюкоза', value: 5.4, unit: 'ммоль/л', refLow: 3.9, refHigh: 6.1, flag: 'normal', confidence: 0.95 },
  { code: 'CHOL', name: 'Холестерин общий', value: 6.4, unit: 'ммоль/л', refLow: 0, refHigh: 5.2, flag: 'high', confidence: 0.91 },
];
