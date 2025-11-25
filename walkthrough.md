# Walkthrough - Gemini Image Generation Fixes

## 1. Gemini 2.5 Flash 500 Error

**Issue**: 500 Internal Error when generating images in Economy Mode.
**Root Cause**: Incorrect model name in `types.ts`.
**Fix**:
- Changed `ModelType.GEMINI_2_5_FLASH` from `gemini-2.0-flash-exp` to `gemini-2.5-flash-image`.
- Verified that `contents` structure (single object vs array) was not the primary cause, though array is the official REST API format.

## 2. Gemini 3 Pro Refinement Error

**Issue**: 400 Bad Request (`Text part is missing a thought_signature`) when refining images.
**Root Cause**: Gemini 3 Pro requires a `thought_signature` from the previous turn to maintain conversational context. This signature was lost because we were only saving the image URL and text, not the raw API response parts.

**Fix**:
### Data Structure Updates
- Added `parts?: any[]` to `GeneratedImage` and `ChatMessage` interfaces in `types.ts`.

### Persistence Logic
- **Creation**: `geminiService.ts` now returns raw `parts` from the API. `CreationPanel.tsx` saves these parts into the `GeneratedImage` object.
- **Refinement**: `RefinePanel.tsx` uses the saved `parts` when initializing the chat history.

### Legacy Support (Fallback)
- In `geminiService.ts`, added logic to handle history items that lack `parts` (legacy images).
- **Strategy**: If `parts` are missing, the item is NOT sent as a `model` history turn. Instead, its images are extracted and sent as `user` input attachments for the current turn. This avoids the "missing signature" error while allowing re-editing of old images.
