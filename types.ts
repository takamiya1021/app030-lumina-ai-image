
export enum ModelType {
  IMAGEN_4 = 'imagen-4.0-generate-001',
  GEMINI_3_PRO = 'gemini-3-pro-image-preview',
  GEMINI_2_5_FLASH = 'gemini-2.5-flash-image',
}

export enum PresetId {
  PRODUCT_STUDIO = 'product_studio',
  LOGO_DESIGN = 'logo_design',
  PORTRAIT_PRO = 'portrait_pro',
  STORYBOARD = 'storyboard',
  INFOGRAPHIC = 'infographic',
  CUSTOM = 'custom',
}

export interface PresetConfig {
  id: PresetId;
  name: string;
  description: string;
  iconName: string;
  model: ModelType;
  aspectRatio: string;
  fields: FormField[];
  systemInstruction?: string;
}

export interface FormField {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  parts?: any[]; // Store raw parts for Gemini 3 Pro thought_signature
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text?: string;
  images?: GeneratedImage[];
  parts?: any[]; // Store raw parts to preserve thought_signature for Gemini 3 Pro
  timestamp: number;
  isReasoning?: boolean; // For Gemini 3 Pro thinking steps
}

export type ViewMode = 'create' | 'refine';

// Global declaration for AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}