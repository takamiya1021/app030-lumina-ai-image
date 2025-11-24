# Implementation Plan - Refine Custom Model Selection

The user requested a UI change for the Custom preset model selection. The dropdown list is to be replaced, and the Gemini 2.5 toggle should remain.

## Proposed Changes

### Configuration

#### [MODIFY] [constants.ts](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/constants.ts)
- Remove the `model` field from the `CUSTOM` preset.

### Components

#### [MODIFY] [CreationPanel.tsx](file:///home/ustar-wsl-2-2/projects/100apps/app030-lumina-ai-image/components/CreationPanel.tsx)
- Add a local state or derived value for the selected engine (Gemini vs Imagen).
- In the render loop, if `preset.id === 'custom'`, render a **Segmented Control** at the top of the form.
    - Options: "Gemini (Creative)" vs "Imagen 4 (Realistic)".
- Update `formData['model']` based on this selection.
    - If Imagen 4 selected -> `formData['model'] = 'Imagen 4'`
    - If Gemini selected -> `formData['model'] = 'Gemini 3.0 Pro'` (or let the service handle the economy toggle logic).
    - *Correction*: The service logic I wrote checks `formData['model']`. If it's 'Imagen 4', it uses Route A. If it's Gemini, it uses Route B and checks `useEconomy`.
    - So I just need to ensure `formData['model']` is set to 'Imagen 4' when that mode is active, and cleared or set to 'Gemini' otherwise.
- **Visibility Logic**:
    - Show "Economy Mode" toggle ONLY if "Gemini" is selected.

## Verification Plan

### Manual Verification
1.  **Custom Mode - UI Check**:
    - Verify "Model" dropdown is gone.
    - Verify new "Engine Selector" (Gemini / Imagen 4) appears.
2.  **Interaction**:
    - Select **Imagen 4**: Verify Economy toggle disappears.
    - Select **Gemini**: Verify Economy toggle appears.
3.  **Generation**:
    - Generate with Imagen 4 -> Verify Imagen model used.
    - Generate with Gemini + Economy -> Verify Gemini 2.5 used.
    - Generate with Gemini + Pro -> Verify Gemini 3.0 used.
