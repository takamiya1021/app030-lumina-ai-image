# Custom Mode UI Refinement Walkthrough

This document outlines the UI changes made to the Custom Mode model selection.

## Changes

### 1. Model Selection UI
- **Old**: Dropdown list in the form.
- **New**: **Segmented Control** (Toggle Buttons) at the top of the Custom panel.
- **Options**:
    - **Gemini (Creative)**: Uses Gemini 3.0 Pro or 2.5 Flash (based on Economy toggle).
    - **Imagen 4 (Realistic)**: Uses Imagen 4 model.

### 2. Economy Toggle Logic
- The "Economy Mode" toggle is now **hidden** when **Imagen 4** is selected, as it only applies to Gemini models.
- When **Gemini** is selected, the toggle appears and functions as before (switching between Pro and Flash).

## Verification Steps

1. Select **Custom** preset.
2. Verify the "Model" dropdown is gone from the form fields.
3. Verify the new toggle buttons appear at the top: "Gemini (Creative)" and "Imagen 4 (Realistic)".
4. Click **Imagen 4**:
    - Verify "Economy Mode" toggle disappears.
    - Generate an image -> Should use Imagen 4.
5. Click **Gemini**:
    - Verify "Economy Mode" toggle appears.
    - Toggle Economy ON -> Generate -> Should use Gemini 2.5 Flash.
    - Toggle Economy OFF -> Generate -> Should use Gemini 3.0 Pro.
