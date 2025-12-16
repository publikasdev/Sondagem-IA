export enum AssessmentType {
  DRAWING = 'DESENHO',
  WRITING = 'ESCRITA',
  PHONOLOGICAL = 'FONOLOGICA',
  MEMORY = 'MEMORIA',
  MATH = 'MATEMATICA',
  READING = 'LEITURA'
}

export enum DrawingPhase {
  GARATUJA_DESORDENADA = 'Garatuja Desordenada',
  GARATUJA_ORDENADA = 'Garatuja Ordenada',
  PRE_ESQUEMATISMO = 'Pré-Esquematismo',
  ESQUEMATISMO = 'Esquematismo',
  REALISMO = 'Realismo',
  PSEUDO_NATURALISMO = 'Pseudo-Naturalismo'
}

export enum WritingPhase {
  PRE_ALFABETICA = 'Pré-Alfabética',
  ALFABETICA_PARCIAL = 'Alfabética Parcial',
  ALFABETICA_COMPLETA = 'Alfabética Completa',
  ALFABETICA_CONSOLIDADA = 'Alfabética Consolidada'
}

export interface AssessmentResult {
  id: string;
  studentId: string;
  date: string; // ISO date
  type: AssessmentType;
  phase?: string; // For Drawing/Writing
  score?: number; // For Math/Memory/Phonological/Reading
  maxScore?: number;
  notes?: string;
  imageUrl?: string; // For uploaded evidence
  aiAnalysis?: string; // Raw AI feedback
}

export interface Student {
  id: string;
  name: string;
  age: number;
  grade: string;
}

// Math specific detailed breakdown
export interface MathAssessmentDetails {
  counting: boolean;
  numberRecognition: boolean;
  sizeComparison: boolean;
  shapes: boolean;
  patterns: boolean;
  correspondence: boolean;
  quantity: boolean;
  classification: boolean;
  spatial: boolean;
  simpleMath: boolean;
}