import { GoogleGenAI, Type } from "@google/genai";
import { DrawingPhase, WritingPhase } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- CONFIGURAÇÃO DE TUNING E MODELO ---
// Atualizado para Gemini 3 Pro Preview para maior profundidade de análise
const MODEL_NAME = "gemini-3-pro-preview"; 

// --- SYSTEM INSTRUCTION (SOFT TUNING) ---
// Define a PERSONALIDADE e as REGRAS GERAIS do modelo.
const SYSTEM_INSTRUCTION = `
Você é uma Especialista Sênior em Psicopedagogia e Neurociência da Alfabetização.
Sua missão é analisar produções infantis (desenhos, escrita, leitura) com precisão clínica e pedagógica.

DIRETRIZES TÉCNICAS E DE FORMATAÇÃO (RIGOROSO):
1. **Formato:** Use Markdown padrão.
2. **Parágrafos:** Escreva parágrafos longos e coesos. JAMAIS use quebra de linha (\n) dentro de um parágrafo. Deixe o texto fluir na mesma linha. Use quebra de linha APENAS para separar parágrafos distintos.
3. **Listas:** Se usar listas, use bullet points (*).
4. **Tom de Voz:** Formal, técnico, empático e assertivo. Estilo "Parecer Descritivo".
5. **Assertividade:** Não use "eu acho". Use "evidências sugerem", "traços indicam", "compatível com".
`;

// --- RAG (RETRIEVAL-AUGMENTED GENERATION - CONTEXT INJECTION) ---
const THEORETICAL_CONTEXT = `
--- BIBLIOTECA TÉCNICA (FONTE DE VERDADE) ---

=== 1. FASES DO DESENHO (CRITÉRIOS VISUAIS RÍGIDOS) ===
Baseado em Lowenfeld, Piaget e Referências Visuais do Caderno de Sondagem:

1. **Garatuja Desordenada (1-2 anos):** Traços caóticos, sem controle motor, saem do papel. Intenção: Prazer motor.
2. **Garatuja Ordenada (2-4 anos):** Movimentos circulares repetitivos, linhas longitudinais controladas.
3. **Pré-Esquematismo (2-7 anos):** "Girino" ou "Cefaloide" (cabeça grande de onde saem pernas/braços). Figuras flutuando.
4. **Esquematismo (7-10 anos):** Linha de Base (chão) e Linha do Céu. Figura Humana geométrica completa.
5. **Realismo (9-12 anos):** Abandono da linha de base única. Planos, sobreposição.
6. **Pseudo-Naturalismo (11+ anos):** Perspectiva, luz e sombra, proporção exata.

=== 2. FASES DA LEITURA E ESCRITA (LINNEA EHRI) ===
1. **Pré-Alfabética:** Lê logotipos ou adivinha. Escrita: garatujas.
2. **Alfabética Parcial:** Lê usando pistas parciais. Escrita: Esqueleto consonantal.
3. **Alfabética Completa:** Decodifica tudo. Escrita: Foneticamente completa.
4. **Alfabética Consolidada:** Leitura fluente por chunks.

=== 3. PROTOCOLO DE INTERVENÇÃO (MÉTODO MACEDO) ===
- Rotina 20/20/20: 20min Consciência Fonológica + 20min Articulemas + 20min Instrução Fônica.
`;

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const blobToBase64 = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const analyzeDrawing = async (base64Image: string, referenceFilesBase64: { mimeType: string, data: string }[] = []): Promise<{ 
  phase: DrawingPhase; 
  reasoning: string;
  colorAnalysis: string;
  anatomicalDetails: string;
  contextualElements: string;
}> => {
  
  let prompt = `
    Analise este desenho infantil com profundidade técnica.
    ${THEORETICAL_CONTEXT}
    Retorne a fase mais provável e justifique com elementos visuais da imagem.
  `;

  const parts: any[] = [
    { inlineData: { mimeType: "image/jpeg", data: base64Image } }
  ];

  if (referenceFilesBase64 && referenceFilesBase64.length > 0) {
    referenceFilesBase64.forEach(file => {
      parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
    });
    prompt += `\nUse os arquivos de referência anexos para comparação.`;
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts: parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          phase: { type: Type.STRING, enum: Object.values(DrawingPhase) },
          reasoning: { type: Type.STRING },
          colorAnalysis: { type: Type.STRING },
          anatomicalDetails: { type: Type.STRING },
          contextualElements: { type: Type.STRING }
        },
        required: ["phase", "reasoning", "colorAnalysis", "anatomicalDetails", "contextualElements"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const analyzeWriting = async (base64Image: string, wordsDictated: string): Promise<{ phase: WritingPhase; reasoning: string }> => {
  const prompt = `
    Analise a escrita da criança. Palavras Ditadas: "${wordsDictated}".
    ${THEORETICAL_CONTEXT}
    Classifique a fase da escrita (Ehri).
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
        { text: prompt }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          phase: { type: Type.STRING, enum: Object.values(WritingPhase) },
          reasoning: { type: Type.STRING }
        },
        required: ["phase", "reasoning"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const analyzeReading = async (targetText: string, readingRecord: string, audioBase64?: string): Promise<{ fluencyScore: number; decodingScore: number; comprehensionScore: number; reasoning: string }> => {
  const promptText = `
    Analise a leitura. Texto: "${targetText}". Registro: "${readingRecord}".
    ${audioBase64 ? "Áudio anexado." : "Sem áudio."}
    Critérios (0-10): Fluência, Decodificação, Compreensão.
  `;

  const parts = [];
  if (audioBase64) {
    parts.push({ inlineData: { mimeType: "audio/webm", data: audioBase64 } });
  }
  parts.push({ text: promptText });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fluencyScore: { type: Type.NUMBER },
          decodingScore: { type: Type.NUMBER },
          comprehensionScore: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["fluencyScore", "decodingScore", "comprehensionScore", "reasoning"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateStudentReport = async (studentName: string, assessments: any[]): Promise<string> => {
  const prompt = `
    Escreva um RELATÓRIO DE AVALIAÇÃO DIAGNÓSTICA formal para o aluno ${studentName}.
    
    ${THEORETICAL_CONTEXT}
    DADOS: ${JSON.stringify(assessments, null, 2)}

    ESTRUTURA OBRIGATÓRIA (MARKDOWN):
    # PARECER PEDAGÓGICO DESCRITIVO

    ## 1. INTRODUÇÃO
    Análise global do perfil e engajamento.

    ## 2. DESENVOLVIMENTO DA LINGUAGEM ESCRITA E LEITURA
    Integre fases de escrita e leitura. Use termos técnicos em negrito.
    IMPORTANTE: Escreva texto corrido e justificado. Não faça listas de tópicos aqui, prefira prosa.

    ## 3. EXPRESSÃO GRÁFICA E COGNIÇÃO
    Análise do desenho.

    ## 4. PENSAMENTO LÓGICO-MATEMÁTICO
    Destaque conquistas numéricas.

    ## 5. PLANO DE INTERVENÇÃO
    Sugestões práticas (Rotina 20/20/20). Aqui você pode usar bullet points (*).
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }]
    }
  });

  return response.text || "Erro ao gerar relatório.";
};
