import React, { useState, useEffect } from 'react';
import { PresetConfig, GeneratedImage } from '../types';
import { generateContent } from '../services/geminiService';
import { Loader2, Upload, ArrowRight, Wand2, Zap, Sparkles, History, X, Clock } from 'lucide-react';

interface Props {
  preset: PresetConfig;
  onSuccess: (images: GeneratedImage[], text?: string) => void;
  useEconomy: boolean;
  onEconomyChange: (value: boolean) => void;
  formData: Record<string, string>;
  onFormDataChange: (data: Record<string, string>) => void;
  uploadedFiles: File[];
  onUploadedFilesChange: (files: File[]) => void;
}

export const CreationPanel: React.FC<Props> = ({ preset, onSuccess, useEconomy, onEconomyChange, formData, onFormDataChange, uploadedFiles, onUploadedFilesChange }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activeHistoryField, setActiveHistoryField] = useState<string | null>(null);
  const [inputHistory, setInputHistory] = useState<Record<string, string[]>>({});

  // Load history from local storage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('lumina_input_history');
    if (savedHistory) {
      try {
        setInputHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse input history", e);
      }
    }
  }, []);

  // Reset uploaded files when preset changes (form data reset is handled by parent)
  useEffect(() => {
    // Parent handles resetting uploadedFiles on preset change now
    setPreviewUrls(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return [];
    });
  }, [preset.id]);

  // Update preview URLs when uploaded files change
  useEffect(() => {
    const newPreviewUrls = uploadedFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return newPreviewUrls;
    });
    return () => {
      newPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [uploadedFiles]);

  const handleInputChange = (key: string, value: string) => {
    onFormDataChange({ ...formData, [key]: value });
  };

  const handleClearForm = () => {
    if (confirm('入力内容をクリアしますか？')) {
      onFormDataChange({});
      onUploadedFilesChange([]);
      // Reset economy mode to default (false) if user wants a full reset? 
      // User said "same state as new input", which usually implies default settings.
      // But economy mode is a global setting. Let's keep it as is for now unless requested.
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const totalFiles = [...uploadedFiles, ...files];

      if (totalFiles.length > 14) {
        alert("一度にアップロードできる参照画像は最大14枚です。");
        // Don't add if it exceeds limit, or add up to limit?
        // Let's just take the first 14 of the new batch combined with old?
        // Simpler: just replace or append up to 14.
        const remainingSlots = 14 - uploadedFiles.length;
        if (remainingSlots > 0) {
          onUploadedFilesChange([...uploadedFiles, ...files.slice(0, remainingSlots)]);
        }
      } else {
        onUploadedFilesChange(totalFiles);
      }
    }
  };

  const removeFile = (index: number) => {
    onUploadedFilesChange(uploadedFiles.filter((_, i) => i !== index));
  };

  const saveToHistory = (key: string, value: string) => {
    if (!value || !value.trim()) return;

    setInputHistory(prev => {
      const currentList = prev[key] || [];
      // Remove duplicates and add to top
      const newList = [value, ...currentList.filter(item => item !== value)].slice(0, 10);

      const newHistory = { ...prev, [key]: newList };
      localStorage.setItem('lumina_input_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    // Save textarea inputs to history
    preset.fields.forEach(field => {
      if (field.type === 'textarea' && formData[field.key]) {
        saveToHistory(field.key, formData[field.key]);
      }
    });

    try {
      const result = await generateContent(preset, formData, uploadedFiles, useEconomy);

      const newImages: GeneratedImage[] = result.images.map(url => ({
        id: Math.random().toString(36).substr(2, 9),
        url,
        prompt: preset.name,
        model: preset.model.includes('imagen') ? 'Imagen 4' : (useEconomy ? 'Gemini 2.5 Flash' : 'Gemini 3 PRO'),
        timestamp: Date.now()
      }));

      onSuccess(newImages, result.text);
    } catch (error: any) {
      alert(`生成に失敗しました: ${error.message || "不明なエラー"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const isGemini = preset.model.includes('gemini');

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Wand2 className="text-blue-400" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">{preset.name} 設定</h3>
            <p className="text-sm text-gray-400">{preset.description}</p>
          </div>
        </div>

        {/* Clear Button */}
        {(Object.keys(formData).length > 0 || uploadedFiles.length > 0) && (
          <button
            onClick={handleClearForm}
            type="button"
            className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <Sparkles size={12} className="rotate-45" />
            入力をクリア
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {preset.fields.map((field) => (
          <div key={field.key} className="relative">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {field.label}
              </label>

              {/* History Button for Textarea */}
              {field.type === 'textarea' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveHistoryField(activeHistoryField === field.key ? null : field.key)}
                    className={`text-xs flex items-center gap-1 transition-colors ${activeHistoryField === field.key ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                    title="履歴から入力"
                  >
                    <Clock size={12} />
                    <span>履歴</span>
                  </button>

                  {/* History Dropdown */}
                  {activeHistoryField === field.key && (
                    <div className="absolute right-0 top-full mt-2 w-64 max-h-60 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20">
                      <div className="p-2 sticky top-0 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-400">最近の入力 (最大10件)</span>
                        <button onClick={() => setActiveHistoryField(null)} className="text-gray-500 hover:text-white">
                          <X size={12} />
                        </button>
                      </div>
                      {inputHistory[field.key]?.length > 0 ? (
                        <ul className="py-1">
                          {inputHistory[field.key].map((item, idx) => (
                            <li key={idx}>
                              <button
                                type="button"
                                onClick={() => {
                                  handleInputChange(field.key, item);
                                  setActiveHistoryField(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white truncate border-b border-gray-800/50 last:border-0"
                                title={item}
                              >
                                {item}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="p-4 text-center text-xs text-gray-600">履歴はありません</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {field.type === 'select' ? (
              <select
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                value={formData[field.key] || ''}
                onChange={(e) => handleInputChange(field.key, e.target.value)}
              >
                <option value="">選択してください</option>
                {field.options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[6rem] resize-y"
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
                onChange={(e) => handleInputChange(field.key, e.target.value)}
                required
              />
            ) : (
              <input
                type="text"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder={field.placeholder}
                value={formData[field.key] || ''}
                onChange={(e) => handleInputChange(field.key, e.target.value)}
                required
              />
            )}
          </div>
        ))}

        {/* Reference Image Uploader */}
        {isGemini && (
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                参照画像 (任意 - 最大14枚)
              </label>
              {uploadedFiles.length > 0 && (
                <span className="text-xs text-blue-400 font-mono">{uploadedFiles.length}/14</span>
              )}
            </div>

            {/* Image Grid Preview */}
            {uploadedFiles.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-3">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="relative aspect-square group">
                    <img
                      src={previewUrls[i]}
                      alt={`Ref ${i}`}
                      className="w-full h-full object-cover rounded-lg border border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white truncate px-1 py-0.5 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      {f.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-gray-800 file:text-blue-400
                  hover:file:bg-gray-700
                  cursor-pointer
                "
              />
              <Upload className="absolute right-3 top-2 text-gray-600 pointer-events-none" size={18} />
            </div>
          </div>
        )}

        {/* Economy Mode Toggle - Only for Gemini presets */}
        {isGemini && (
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div className="flex items-center gap-2">
              {useEconomy ? <Zap className="text-yellow-400" size={18} /> : <Sparkles className="text-purple-400" size={18} />}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">
                  {useEconomy ? 'エコノミー (Gemini 2.5)' : 'プロフェッショナル (Gemini 3 PRO)'}
                </span>
                <span className="text-xs text-gray-400">
                  {useEconomy ? '高速・低コスト・標準画質' : '高画質(4K)・高推論・検索機能'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEconomyChange(!useEconomy)}
              className={`
                relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                ${useEconomy ? 'bg-yellow-600/50' : 'bg-purple-600'}
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                  ${useEconomy ? 'translate-x-0' : 'translate-x-5'}
                `}
              />
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isGenerating}
          className={`
            w-full py-4 rounded-lg font-semibold text-white shadow-lg flex items-center justify-center gap-2
            transition-all duration-300 transform hover:-translate-y-0.5
            ${isGenerating
              ? 'bg-gray-800 cursor-not-allowed opacity-70'
              : useEconomy
                ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 shadow-yellow-900/20'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/20'
            }
          `}
        >
          {isGenerating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <span>生成する</span>
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </form>
    </div >
  );
};