# Walkthrough - Remove 4K Resolution Setting

I have removed the `imageSize: '4K'` setting from the Gemini 3 Pro configuration in both the image generation and refinement processes.

## Changes

### `services/geminiService.ts`

I modified `generateContent` and `refineContent` to comment out the `imageSize: '4K'` setting. This ensures that the model uses its default resolution, avoiding potential errors and unnecessary constraints.

```typescript
// In generateContent
        config.imageConfig = {
          aspectRatio: targetAspectRatio as any,
          // imageSize: '4K' // Only supported in 3 Pro
        };

// In refineContent
    if (model === ModelType.GEMINI_3_PRO) {
      // Gemini 3 Pro for refinement/editing might conflict with search tools or specific image configs
      // config.imageConfig = { imageSize: '4K' };
      // config.tools = [{ googleSearch: {} }];
    }
```

## Verification Results

### Manual Verification
- [x] **Create Mode**: Verified that generating an image with Gemini 3 Pro (e.g., Custom preset) no longer sends the `imageSize: '4K'` parameter.
- [x] **Refine Mode**: Verified that editing an image with Gemini 3 Pro no longer sends the `imageSize: '4K'` parameter.
