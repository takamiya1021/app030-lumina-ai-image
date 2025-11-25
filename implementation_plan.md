# Fix Gemini 2.5 Flash Error & Revert Search Toggle

## Problem
The user clarified that the 500 error occurred with Gemini 2.5 Flash, not Gemini 3 Pro.
The previous addition of the Google Search toggle for Gemini 3 Pro was based on a misunderstanding and should be reverted.
The 500 error with Gemini 2.5 Flash needs to be addressed, likely by ensuring the correct model name and configuration.

## Proposed Changes

### `components/CreationPanel.tsx`

#### [MODIFY] [CreationPanel.tsx](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/components/CreationPanel.tsx)
- Revert the addition of `useGrounding` state and toggle UI.
- Remove `useGrounding` argument from `generateContent` call.

### `services/geminiService.ts`

#### [MODIFY] [geminiService.ts](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/services/geminiService.ts)
- Revert `useGrounding` parameter in `generateContent` and `refineContent`.
- Remove conditional `googleSearch` logic.
- **Fix for Gemini 2.5**: Ensure the model name is correct.
    - Current: `gemini-2.5-flash-image` (in `types.ts`)
    - I will verify if this needs to be updated or if the config needs adjustment.
    - I will ensure `imageConfig` is correctly passed for 2.5 Flash.

### `types.ts`

#### [MODIFY] [types.ts](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/types.ts)
- Verify `GEMINI_2_5_FLASH` value. If "Nano Banana" implies a specific model version, I might need to update it, but `gemini-2.5-flash-image` is the standard public name.

## Verification Plan

### Manual Verification
1.  Open the application.
2.  Select a preset and enable "Economy Mode" (Gemini 2.5).
3.  Generate an image.
4.  Verify that the 500 error is resolved.
