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

export const generateProductDetailsFromImage = async (base64Image: string): Promise<GeneratedProductData | null> => {
  try {
    // Remove the data:image/jpeg;base64, part
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const prompt = `
      أنت خبير تسويق إلكتروني (Copywriter) محترف في الجزائر. 
      قم بتحليل صورة هذا المنتج واكتب لي التفاصيل التالية لصفحة هبوط (Landing Page) احترافية:
      1. اسم منتج جذاب ومختصر.
      2. وصف تسويقي مقنع جداً يبرز المشكلة التي يحلها المنتج والراحة التي يوفرها (يمكنك استخدام لهجة جزائرية خفيفة ومفهومة أو عربية فصحى جذابة).
      3. قائمة بـ 4 إلى 6 ميزات (Features) رئيسية للمنتج، كل ميزة في جملة قصيرة.
      4. سعر مقترح بالدينار الجزائري (دج) بناءً على نوع المنتج (رقم فقط).

      يجب أن يكون الرد بصيغة JSON فقط، بهذا الشكل:
      {
        "name": "اسم المنتج",
        "description": "الوصف التسويقي...",
        "features": ["الميزة 1", "الميزة 2", "الميزة 3"],
        "suggestedPrice": 4500
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
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
    console.error("Error generating product details:", error);
    return null;
  }
};
