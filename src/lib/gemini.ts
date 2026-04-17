import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client
// Note: In a real production app, this should ideally be called from a backend
// to protect the API key, but for this AI Studio environment, we use the injected key.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedProductData {
  name: string;
  description: string;
  features: string[];
  suggestedPrice?: number;
}

export const generateProductDetailsFromImages = async (base64Images: string[]): Promise<GeneratedProductData | null> => {
  try {
    const prompt = `
      أنت خبير تسويق إلكتروني (Copywriter) محترف في الجزائر. 
      قم بتحليل صور هذا المنتج (مرفق ${base64Images.length} صور) واكتب لي التفاصيل التالية لصفحة هبوط (Landing Page) احترافية:
      1. اسم منتج جذاب ومختصر.
      2. وصف تسويقي مقنع جداً يبرز المشكلة التي يحلها المنتج والراحة التي يوفرها (يمكنك استخدام لهجة جزائرية خفيفة ومفهومة أو عربية فصحى جذابة).
      3. قائمة بـ 4 إلى 10 ميزات (Features) رئيسية للمنتج، كل ميزة في جملة قصيرة.
      4. سعر مقترح بالدينار الجزائري (دج) بناءً على نوع المنتج (رقم فقط).

      يجب أن يكون الرد بصيغة JSON فقط، بهذا الشكل:
      {
        "name": "اسم المنتج",
        "description": "الوصف التسويقي...",
        "features": ["الميزة 1", "الميزة 2", "الميزة 3"],
        "suggestedPrice": 4500
      }
    `;

    const imageParts = base64Images.map(img => {
      const base64Data = img.split(',')[1];
      const mimeType = img.split(';')[0].split(':')[1];
      return {
        inlineData: {
          mimeType,
          data: base64Data
        }
      };
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as GeneratedProductData;
    }
    return null;
  } catch (error) {
    console.error("Error generating product details from multiple images:", error);
    return null;
  }
};
