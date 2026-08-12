interface ChunkOptions {
  chunkSize?: number;    // Cantidad máxima de caracteres por bloque
  chunkOverlap?: number; // Caracteres superpuestos entre bloques contiguos
}

export function splitTextIntoChunks(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const chunkSize = options.chunkSize || 1000;
  const chunkOverlap = options.chunkOverlap || 200;

  // Normalizamos espacios y saltos de línea múltiples
  const cleanedText = text.replace(/\s+/g, ' ').trim();

  if (cleanedText.length <= chunkSize) {
    return [cleanedText];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= cleanedText.length) {
      chunks.push(cleanedText.slice(startIndex));
      break;
    }

    // Buscamos cortar en el último espacio disponible para no partir palabras por la mitad
    const lastSpace = cleanedText.lastIndexOf(' ', endIndex);
    if (lastSpace > startIndex) {
      endIndex = lastSpace;
    }

    chunks.push(cleanedText.slice(startIndex, endIndex).trim());
    startIndex = endIndex - chunkOverlap;
  }

  return chunks;
}