# Improve Error Reporting in Refine Panel

User is experiencing generic error messages ("リクエストの処理中にエラーが発生しました") when using the Refine feature. This plan aims to surface detailed error information (status codes, error messages) to help diagnose the issue.

## User Review Required
None.

## Proposed Changes

### Services
#### [MODIFY] [geminiService.ts](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/services/geminiService.ts)
- Update `generateContent` and `refineContent` to include original error details in the thrown error message.
- Format: `Error: [Original Message] (Reason)` instead of just `(Reason)`.

### Components
#### [MODIFY] [RefinePanel.tsx](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/components/RefinePanel.tsx)
- Update `handleSend` to catch the error and display `e.message` in the chat history instead of a hardcoded generic string.

## Verification Plan

### Manual Verification
1.  Open the application.
2.  Go to the Refine (Edit) panel.
3.  Attempt to refine an image (which is currently failing).
4.  Verify that the error message in the chat bubble now contains specific details (e.g., "503 Service Unavailable" or "400 Bad Request") instead of the generic message.
