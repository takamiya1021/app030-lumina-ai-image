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
  parts?: any[];    // raw parts from API response (for thought_signature)
}

// Helper for timeout
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 60000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: Request took longer than ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Translate Japanese prompt to English for Imagen 4
const translateToEnglish = async (text: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await withTimeout(ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Translate the following Japanese text to English for an image generation prompt. Only return the English translation, nothing else.\n\nText: ${text}`,
    }));
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

      const response = await withTimeout(ai.models.generateImages({
        model: ModelType.IMAGEN_4,
        prompt: englishPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: targetAspectRatio as any,
          outputMimeType: 'image/png',
        },
      }));

      const images = response.generatedImages?.map(img =>
        `data:image/png;base64,${img.image.imageBytes}`
      ) || [];

      return { images };
    } catch (error: any) {
      console.error("Imagen Error:", error);
      if (error.message && error.message.includes("safety")) {
        throw new Error(`Safety Filterによりブロックされました: ${error.message}`);
      }
      if (error.message && error.message.includes("Timeout")) {
        throw new Error("生成がタイムアウトしました。もう一度お試しください。");
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

      console.log("=== DEBUG: Model Selection ===");
      console.log("selectedModel:", selectedModel);
      console.log("useEconomyMode:", useEconomyMode);

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
        config.tools = [{ googleSearch: {} }];
      } else {
        // Gemini 2.5 Flash Image supports aspectRatio but NOT imageSize or tools
        config.imageConfig = {
          aspectRatio: targetAspectRatio as any
        };
      }

      const response = await withTimeout(ai.models.generateContent({
        model: selectedModel,
        contents: {
          role: 'user',
          parts: parts
        },
        config: config
      }));

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

      return {
        images: generatedImages,
        text: generatedText,
        parts: response.candidates?.[0]?.content?.parts
      };

    } catch (error: any) {
      console.error("Gemini Error:", error);

      // エラーの種類を判別して括弧書きで原因を追加
      let errorReason = "";

      if (error.message?.includes("SAFETY") || error.message?.includes("BLOCKED") || error.toString().includes("SAFETY")) {
        errorReason = "（コンテンツポリシー違反）";
      } else if (error.status === 503 || error.message?.includes("503") || error.message?.includes("overloaded")) {
        errorReason = "（Google側の問題、時間を置いて再試行）";
      } else if (error.status === 400 || error.message?.includes("400")) {
        errorReason = "（リクエストの問題）";
      } else if (error.message?.includes("Timeout")) {
        errorReason = "（タイムアウト）";
      }

      throw new Error(`生成に失敗しました: ${error.message} ${errorReason}`);
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
  let model = useEconomyMode ? ModelType.GEMINI_2_5_FLASH : ModelType.GEMINI_3_PRO;

  const currentParts: any[] = [{ text: message }];

  // Process history to build contents
  const contents: any[] = [];

  // Track the most recent generated image to attach to the current request
  let lastGeneratedImagePart: any = null;

  history.forEach(h => {
    // For Gemini 3 Pro, we need to be careful about payload size.
    // Sending full Base64 history often causes 500/400 errors.
    // Strategy:
    // 1. Keep text parts (thought_signature) to maintain reasoning context.
    // 2. Strip inlineData (images) from HISTORY to save space.
    // 3. Find the *latest* generated image and attach it to the CURRENT request.

    if (model === ModelType.GEMINI_3_PRO) {
      if (h.role === 'model') {
        // Check for images in this turn to track the latest one
        if (h.parts && Array.isArray(h.parts)) {
          const imagePart = h.parts.find((p: any) => p.inlineData);
          if (imagePart) {
            lastGeneratedImagePart = imagePart;
          }
        } else if (h.images && h.images.length > 0) {
          // Legacy/Flash format image tracking
          const img = h.images[h.images.length - 1];
          const match = img.url.match(/^data:(.+?);base64,(.+)$/);
          if (match) {
            lastGeneratedImagePart = {
              inlineData: { mimeType: match[1], data: match[2] }
            };
          }
        }

        // VALIDATION: Is this a valid Gemini 3 Pro turn?
        // It must have a thought_signature.
        // We enforce a STRICT ALLOWLIST: Only include turns we are 100% sure are Gemini 3 Pro.
        // This excludes Gemini 2.5 Flash, Imagen 4, and any other future models that don't output signatures.

        let isValid3ProTurn = false;

        // Check: Explicit model name in images (Source of Truth)
        if (h.images && h.images.length > 0) {
          const imgModel = h.images[0].model;
          // Check if model name contains BOTH "3" and "Pro" (case insensitive just in case)
          if (imgModel && /3.*Pro/i.test(imgModel)) {
            isValid3ProTurn = true;
          }
        }

        // Note: We intentionally SKIP text-only turns (where h.images is empty) because
        // we cannot easily verify which model generated them. 
        // Sending a text-only turn from Flash (no signature) to 3 Pro would cause a 400 error.
        // Since this is an Image Refinement app, skipping text-only context is an acceptable trade-off for stability.

        if (isValid3ProTurn) {
          // It's a valid 3 Pro turn, keep it.
          contents.push({
            role: h.role,
            parts: h.parts
          });
        } else {
          // It's a Flash/Legacy turn. Unsafe for 3 Pro history.
          console.log("Skipping non-3-Pro history item to avoid thought_signature error.");

          // CRITICAL: If we skip a Model turn, we must also remove the PRECEDING User turn
          // to maintain User -> Model -> User alternation.
          // Otherwise we get User -> [Skipped] -> User, which merges into User-User (bad) or separate User-User (bad).
          if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents.pop(); // Remove the orphaned user turn
          }
        }
      } else {
        // User role
        // We add it tentatively. If the NEXT turn (Model) is invalid and skipped,
        // this User turn will be popped in the next iteration (see above).

        // Strip images from user history to save space/complexity
        const parts: any[] = [];
        if (h.parts && Array.isArray(h.parts)) {
          h.parts.forEach((p: any) => {
            if (p.text) parts.push(p);
          });
        } else if (h.text) {
          parts.push({ text: h.text });
        }

        if (parts.length === 0) parts.push({ text: "..." });

        contents.push({
          role: h.role,
          parts: parts
        });
      }
      return;
    }

    // --- Gemini 2.5 Flash Logic (Existing working logic) ---
    // Fallback reconstruction for User items or Non-Gemini-3-Pro Model items
    const parts: any[] = [];
    if (h.text) {
      parts.push({ text: h.text });
    }
    if (h.images && h.images.length > 0) {
      h.images.forEach((img: GeneratedImage) => {
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
    if (parts.length === 0) {
      parts.push({ text: "..." });
    }
    contents.push({
      role: h.role,
      parts: parts
    });
  });

  // --- Post-Processing for Gemini 3 Pro ---
  if (model === ModelType.GEMINI_3_PRO) {
    // 1. Attach the LAST generated image to the CURRENT request
    // This tells the model "Here is the image I want you to edit"
    if (lastGeneratedImagePart) {
      currentParts.push(lastGeneratedImagePart);
    }
  }

  // Add uploaded reference images to current parts
  const maxImages = 14;
  const imagesToProcess = referenceImages.slice(0, maxImages);

  for (const file of imagesToProcess) {
    const base64 = await fileToGenericBase64(file);
    const data = base64.split(',')[1];
    currentParts.push({
      inlineData: { mimeType: file.type, data: data }
    });
  }

  // Check if the last item in contents is a USER role.
  // If so, we must merge currentParts into it to avoid User-User sequence.
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    const lastUserParts = contents[contents.length - 1].parts;
    // Append current parts to the last user turn
    contents[contents.length - 1].parts = [...lastUserParts, ...currentParts];
  } else {
    // Otherwise, add as a new turn
    contents.push({ role: 'user', parts: currentParts });
  }

  try {
    const config: any = {};

    if (model === ModelType.GEMINI_3_PRO) {
      // Gemini 3 Pro for refinement/editing might conflict with search tools or specific image configs
      // config.imageConfig = { imageSize: '4K' };
      // config.tools = [{ googleSearch: {} }];

      // IMPORTANT: Aspect Ratio is required even for editing? 
      // Usually editing preserves aspect ratio, but API might expect it.
      // Let's try NOT sending it first (as it might resize), but if it fails we might need it.
      // However, the previous error was 500, likely payload.
    }
    // Gemini 2.5 Flash Image doesn't support explicit imageSize for refinement or search tools usually

    const response = await withTimeout(ai.models.generateContent({
      model: model,
      contents: contents,
      config: config
    }));

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

    return {
      images: generatedImages,
      text: generatedText,
      parts: response.candidates?.[0]?.content?.parts
    };
  } catch (error: any) {
    console.error("Refinement Error:", error);

    // エラーの種類を判別して括弧書きで原因を追加
    let errorReason = "";

    if (error.message?.includes("SAFETY") || error.message?.includes("BLOCKED") || error.toString().includes("SAFETY")) {
      errorReason = "（コンテンツポリシー違反）";
    } else if (error.status === 503 || error.message?.includes("503") || error.message?.includes("overloaded")) {
      errorReason = "（Google側の問題、時間を置いて再試行）";
    } else if (error.status === 400 || error.message?.includes("400")) {
      errorReason = "（リクエストの問題）";
    } else if (error.message?.includes("Timeout")) {
      errorReason = "（タイムアウト）";
    }

    throw new Error(`リクエストの処理中にエラーが発生しました: ${error.message} ${errorReason}`);
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