# Contents Structure Investigation

## Official Documentation Analysis

### REST API Specification
```json
{
  "contents": [{
    "parts": [
      {"text": "..."},
      {"inline_data": {...}}
    ]
  }]
}
```
- **Format**: Array of objects
- **`role` field**: NOT included (optional/inferred)
- **Source**: ai.google.dev/gemini-api/docs/image-generation

### JavaScript SDK Examples
```javascript
// Simple text
contents: "prompt text"

// Image editing
contents: [
  { text: "..." },
  { inlineData: {...} }
]
```
- **Format**: String OR Array
- **`role` field**: Not shown in official examples
- **Source**: ai.google.dev/gemini-api/docs/image-generation

### TypeScript SDK Type Definition
- `contents` accepts: `string | Content[]`
- `Content` object has: `role` and `parts` properties
- **Source**: Web search results (apidog.com, google.dev)

## Code Analysis

### Original Code (Before Fix)
```typescript
contents: {
  role: 'user',
  parts: parts
}
```
**Issue**: Single object (not array, not string)

### Modified Code (After Fix)
```typescript
contents: [{
  role: 'user',
  parts: parts
}]
```
**Change**: Wrapped in array

## Unexplained Observation

User reported that BEFORE the fix:
- ✅ "画像の漫画を右から左に読む日本式にして" → SUCCESS  
- ❌ "右から左に読む日本式の漫画にして" → 500 ERROR

**Problem**: If `contents` structure was wrong, BOTH should fail. Why did one succeed?

## Possible Explanations

1. **SDK Auto-conversion**: SDK might sometimes convert single object to array internally
2. **Timing/API instability**: Google API had temporary issues
3. **Other factors**: Different conditions (reference images, prompt length, etc.)
4. **Incorrect observation**: Success was actually with different settings

## Recommendation

**Option A**: Keep current fix (array structure) - matches official REST API spec
**Option B**: Revert and test both prompts with original code to verify behavior  
**Option C**: Test both structures side-by-side programmatically
