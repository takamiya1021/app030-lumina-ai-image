import { GoogleGenAI } from "@google/genai";
import { ModelType, PresetConfig, GeneratedImage } from '../types';

// Helper to get the client with the latest key
const getClient = () => {
  // Priority: Environment/Injected Key -> LocalStorage Key
  const apiKey = process.env.API_KEY || localStorage.getItem('lumina_api_key');

  if (!apiKey) {
    throw new Error("API Key is missing. Please select or enter a valid API Key.");
  }

  return new GoogleGenAI({ apiKey });
};

interface GenerationResult {
  images: string[]; // base64 data URLs
  text?: string;    // accompanying text (Gemini)
}

// Translate Japanese prompt to English for Imagen 4
const translateToEnglish = async (text: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following Japanese text to English for an image generation prompt. Only return the English translation, nothing else.\n\nText: ${text}`,
    });
    return response.text || text;
  } catch (e) {
    console.warn("Translation failed, using original text:", e);
    return text;
  }
};

export const generateContent = async (
  preset: PresetConfig,
  formData: Record<string, string>,
  referenceImages: File[] = [],
  useEconomyMode: boolean = false
): Promise<GenerationResult> => {
  const ai = getClient();

  // 1. Construct the Prompt based on preset fields
  let rawPrompt = "";

  // Determine Aspect Ratio: Use form data if available (e.g. from Custom preset), otherwise use preset default
  const targetAspectRatio = formData['aspectRatio'] || preset.aspectRatio;

  if (preset.id === 'custom') {
    rawPrompt = formData['prompt'] || "";
  } else {
    // Simple template engine
    rawPrompt = `${preset.name} Generation. `;
    Object.entries(formData).forEach(([key, value]) => {
      if (value && value.trim() !== '' && key !== 'aspectRatio') {
        rawPrompt += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}. `;
      }
    });
  }

  console.log(`Original prompt: ${rawPrompt}, Aspect Ratio: ${targetAspectRatio}`);

  // 2. Routing Logic

  // --- ROUTE A: IMAGEN 4 (Creation Mode) ---
  // Check if preset is Imagen 4 OR if Custom preset has Imagen 4 selected
  const isImagen = preset.model === ModelType.IMAGEN_4 || (preset.id === 'custom' && formData['model'] === 'Imagen 4');

  if (isImagen) {
    try {
      // Requirement 3.2: Translate Japanese to English for Imagen
      const englishPrompt = await translateToEnglish(rawPrompt);
      console.log(`Translated prompt for Imagen: ${englishPrompt}`);

      const response = await ai.models.generateImages({
        model: preset.model,
        prompt: englishPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: targetAspectRatio as any,
          outputMimeType: 'image/png',
        },
      });

      const images = response.generatedImages?.map(img =>
        `data:image/png;base64,${img.image.imageBytes}`
      ) || [];

      return { images };
    } catch (error: any) {
      console.error("Imagen Error:", error);
      if (error.message && error.message.includes("safety")) {
        throw new Error(`Safety Filterによりブロックされました: ${error.message}`);
      }
      throw error;
    }
  }

  // --- ROUTE B: GEMINI (Generation + Reasoning) ---
  else {
    try {
      // Determine Model: Economy (2.5 Flash) vs Pro (3 Pro)
      // If Custom preset has a specific model selected, use it. Otherwise use Economy toggle or default.
      let selectedModel = useEconomyMode ? ModelType.GEMINI_2_5_FLASH : ModelType.GEMINI_3_PRO;

      if (preset.id === 'custom' && formData['model']) {
        const customModel = formData['model'];
        if (customModel.includes('2.5')) selectedModel = ModelType.GEMINI_2_5_FLASH;
        else if (customModel.includes('3.0')) selectedModel = ModelType.GEMINI_3_PRO;
        // Imagen 4 is handled in Route A, but we need to ensure we don't fall into Route B if Imagen is selected in Custom
      }

      const parts: any[] = [];

      // Add Reference Images if any (Limit to 14 as per requirements)
      const maxImages = 14;
      const imagesToProcess = referenceImages.slice(0, maxImages);

      for (const file of imagesToProcess) {
        const base64 = await fileToGenericBase64(file);
        const data = base64.split(',')[1];
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: data
          }
        });
      }

      // Add Text Prompt
      parts.push({ text: rawPrompt });

      // Build Config
      const config: any = {
        systemInstruction: preset.systemInstruction,
      };

      // Config differences between 3 Pro and 2.5 Flash
      if (selectedModel === ModelType.GEMINI_3_PRO) {
        config.imageConfig = {
          aspectRatio: targetAspectRatio as any,
          // imageSize: '4K' // Only supported in 3 Pro
        };
        config.tools = [{ googleSearch: {} }]; // Only supported in 3 Pro
      } else {
        // Gemini 2.5 Flash Image supports aspectRatio but NOT imageSize or tools
        config.imageConfig = {
          aspectRatio: targetAspectRatio as any
        };
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: {
          role: 'user',
          parts: parts
        },
        config: config
      });

      const generatedImages: string[] = [];
      let generatedText = "";

      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImages.push(`data:image/png;base64,${part.inlineData.data}`);
          } else if (part.text) {
            generatedText += part.text;
          }
        }
      }

      if (generatedImages.length === 0 && !generatedText && response.candidates && response.candidates[0].finishReason) {
        throw new Error(`生成が停止しました: ${response.candidates[0].finishReason}`);
      }

      return { images: generatedImages, text: generatedText };

    } catch (error: any) {
      console.error("Gemini Error:", error);
      if (error.toString().includes("SAFETY")) {
        throw new Error("安全ポリシーにより生成がブロックされました。");
      }
      throw error;
    }
  }
};

export const refineContent = async (
  history: any[],
  message: string,
  referenceImages: File[],
  useEconomyMode: boolean = false
): Promise<GenerationResult> => {
  const ai = getClient();
  const model = useEconomyMode ? ModelType.GEMINI_2_5_FLASH : ModelType.GEMINI_3_PRO;

  const contents = history.map(h => {
    const parts: any[] = [];
    if (h.text) {
      parts.push({ text: h.text });
    }
    if (h.images && h.images.length > 0) {
      h.images.forEach((img: GeneratedImage) => {
        // Extract base64 data from data URL
        // Format: data:image/png;base64,......
        const match = img.url.match(/^data:(.+?);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      });
    }
    // Fallback if no text/images but role exists (shouldn't happen usually)
    if (parts.length === 0) {
      parts.push({ text: "..." });
    }
    return {
      role: h.role,
      parts: parts
    };
  });

  const currentParts: any[] = [{ text: message }];

  const maxImages = 14;
  const imagesToProcess = referenceImages.slice(0, maxImages);

  for (const file of imagesToProcess) {
    const base64 = await fileToGenericBase64(file);
    const data = base64.split(',')[1];
    currentParts.push({
      inlineData: { mimeType: file.type, data: data }
    });
  }

  contents.push({ role: 'user', parts: currentParts });

  try {
    const config: any = {};

    if (model === ModelType.GEMINI_3_PRO) {
      // Gemini 3 Pro for refinement/editing might conflict with search tools or specific image configs
      // config.imageConfig = { imageSize: '4K' };
      // config.tools = [{ googleSearch: {} }];
    }
    // Gemini 2.5 Flash Image doesn't support explicit imageSize for refinement or search tools usually

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: config
    });

    const generatedImages: string[] = [];
    let generatedText = "";

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          generatedImages.push(`data:image/png;base64,${part.inlineData.data}`);
        } else if (part.text) {
          generatedText += part.text;
        }
      }
    }

    return { images: generatedImages, text: generatedText };

  } catch (error) {
    console.error("Refinement Error:", error);
    throw error;
  }
}


// Helper to convert File to Base64
const fileToGenericBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};