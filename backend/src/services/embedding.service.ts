import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Genera el embedding para un texto ajustado a 1536 dimensiones.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
      config: {
        outputDimensionality: 1536, // <-- Ajustamos la dimensión esperada por la DB
      },
    });

    if (!response.embeddings || response.embeddings.length === 0) {
      throw new Error('No se recibió un vector válido de Gemini.');
    }

    const values = response.embeddings[0].values;

    if (!values) {
      throw new Error('El vector de embedding está vacío.');
    }

    return values;
  } catch (error) {
    console.error('Error generando embedding con Gemini:', error);
    throw error;
  }
}