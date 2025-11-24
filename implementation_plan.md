# Remove 4K Resolution Setting

## Problem
The user has requested to remove the "4K" resolution setting from the image creation process, as it is deemed unnecessary.

## Proposed Changes

### `services/geminiService.ts`

#### [MODIFY] [geminiService.ts](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/services/geminiService.ts)
- In `generateContent` function:
    - Remove `imageSize: '4K'` from the `imageConfig` object for Gemini 3 Pro.

## Verification Plan

### Manual Verification
1.  Open the application.
2.  Select a preset that uses Gemini 3 Pro (e.g., Custom with Gemini 3 Pro, or Storyboard).
3.  Generate an image.
4.  Verify that the request is sent without the `imageSize: '4K'` parameter and the image is generated successfully.
