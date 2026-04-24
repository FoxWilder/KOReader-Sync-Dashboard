import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface BookMetadata {
  id: string;
  title: string;
  author: string;
  description: string;
}

export const aiService = {
  /**
   * Categorize a list of books into technical sectors.
   */
  async categorizeBooks(books: BookMetadata[]): Promise<Record<string, string>> {
    const prompt = `
      Analyze the following book titles and descriptions. 
      Categorize each book into one specific 'Technical Sector' or 'Knowledge Domain' (e.g., Quantum Computing, Stoic Philosophy, Artificial Intelligence, Cybersecurity, High-Fantasy Architecture, Neural Biology, etc.).
      
      Return the results as a JSON object where the key is the book ID and the value is the category name.
      
      BOOKS:
      ${books.map(b => `ID: ${b.id} | Title: ${b.title} | Desc: ${b.description}`).join('\n')}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: books.reduce((acc, b) => {
            acc[b.id] = { type: Type.STRING };
            return acc;
          }, {} as any)
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("AI Categorization failed to parse:", e);
      return {};
    }
  },

  /**
   * Perform semantic search across book metadata.
   */
  async semanticSearch(query: string, books: BookMetadata[]): Promise<string[]> {
    const prompt = `
      You are a neural librarian. I am looking for: "${query}".
      
      Identify which of the following books best match this request based on their themes, subjects, and descriptions.
      Return a list of book IDs, sorted by relevance (most relevant first).
      
      BOOKS:
      ${books.map(b => `ID: ${b.id} | Title: ${b.title} | Desc: ${b.description}`).join('\n')}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Semantic search failed to parse:", e);
      return [];
    }
  }
};
