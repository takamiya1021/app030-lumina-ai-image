# Task: Fix Gemini Image Generation Errors

- [x] **Fix Gemini 2.5 Flash 500 Error**
    - [x] Investigate model name (Corrected to `gemini-2.5-flash-image`)
    - [x] Investigate API structure (Confirmed `contents` array vs object wasn't the root cause, but model name was)
    - [x] Verify fix with user (Confirmed working)

- [x] **Fix Gemini 3 Pro Refinement Error**
    - [x] Analyze `INVALID_ARGUMENT` error (`thought_signature` missing)
    - [x] Update `types.ts` to include `parts` in `GeneratedImage` and `ChatMessage`
    - [x] Update `geminiService.ts` to return and use raw `parts`
    - [x] Update `CreationPanel.tsx` and `RefinePanel.tsx` to persist `parts`
    - [x] Implement fallback for legacy images (treat as new input)
    - [x] Verify fix with user (Accepted)
