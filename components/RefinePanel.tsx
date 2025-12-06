import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, GeneratedImage } from '../types';
import { refineContent } from '../services/geminiService';
import { saveRefinedImageToHistory, getRefinedHistory } from '../services/storageService';
import { Send, Image as ImageIcon, Loader2, Bot, User, Zap, Sparkles, X, History } from 'lucide-react';
import { ImageHistorySlider } from './ImageHistorySlider';

interface Props {
  initialImage?: GeneratedImage;
  initialText?: string;
}

export const RefinePanel: React.FC<Props> = ({ initialImage, initialText }) => {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [useEconomy, setUseEconomy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [refinedHistory, setRefinedHistory] = useState<GeneratedImage[]>([]);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  useEffect(() => {
    if (initialImage) {
      setHistory([{
        role: 'model',
        timestamp: Date.now(),
        images: [initialImage],
        parts: initialImage.parts, // Use raw parts from initial image (contains thought_signature)
        text: "生成された画像です。どのように調整しますか？ オブジェクトの追加、色の変更、スタイルの調整などを指示できます。"
      }]);
    } else if (initialText) {
      // Handle text-only response from creation
      setHistory([{
        role: 'model',
        timestamp: Date.now(),
        text: initialText
      }]);
    }
  }, [initialImage, initialText]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

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

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const maxImages = useEconomy ? 3 : 14;
      if (files.length > maxImages) {
        alert(`一度にアップロードできる参照画像は最大${maxImages}枚です。最初の${maxImages}枚のみが選択されました。`);
        setUploadedFiles(files.slice(0, maxImages));
      } else {
        setUploadedFiles(files);
      }
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isSending) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const result = await refineContent(history, input, uploadedFiles, useEconomy);

      const newImages: GeneratedImage[] = result.images.map(url => ({
        id: Math.random().toString(36).substr(2, 9),
        url,
        prompt: input || "Refinement",
        model: useEconomy ? "Gemini 2.5 Flash" : "Gemini 3 PRO",
        parts: result.parts,
        timestamp: Date.now()
      }));

      // Auto-save to refined history
      for (const img of newImages) {
        await saveRefinedImageToHistory(img);
      }
      setHistoryRefreshTrigger(prev => prev + 1);

      setHistory(prev => [...prev, {
        role: 'model',
        text: result.text || "画像を生成・調整しました。",
        images: newImages,
        parts: result.parts,
        timestamp: Date.now()
      }]);

      setUploadedFiles([]);

    } catch (e) {
      console.error("RefinePanel Error Caught:", e);
      setHistory(prev => [...prev, {
        role: 'model',
        text: e instanceof Error ? `エラー: ${e.message}` : "エラーが発生しました（詳細不明）。もう一度お試しください。",
        timestamp: Date.now()
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/50 border border-gray-800 rounded-2xl backdrop-blur-sm overflow-hidden relative">
      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-900/80 flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2 text-white">
          <Bot size={18} className="text-purple-400" />
          編集 (Refine Mode)
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700 transition-all"
            title="編集履歴を表示"
          >
            <History size={14} />
            <span className="hidden sm:inline">履歴</span>
          </button>
          <button
            onClick={() => setUseEconomy(!useEconomy)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${useEconomy
              ? 'bg-yellow-900/20 border-yellow-700 text-yellow-300 hover:bg-yellow-900/40'
              : 'bg-purple-900/20 border-purple-700 text-purple-300 hover:bg-purple-900/40'
              }`}
            title={useEconomy ? "現在: エコノミーモード (Gemini 2.5 Flash) - 高速・低コスト" : "現在: プロモード (Gemini 3 PRO) - 高画質"}
          >
            {useEconomy ? <Zap size={14} /> : <Sparkles size={14} />}
            <span className="hidden sm:inline">{useEconomy ? 'Gemini 2.5 (Eco)' : 'Gemini 3 PRO'}</span>
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
            <Bot size={48} className="opacity-20" />
            <p>会話を開始して、画像の生成や編集を行いましょう。</p>
          </div>
        )}

        {history.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
              ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}
            `}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>

            <div className={`max-w-[85%] sm:max-w-[75%] space-y-3`}>
              {msg.text && (
                <div className={`
                  p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-none'
                    : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-none'
                  }
                `}>
                  {msg.text}
                </div>
              )}

              {msg.images && msg.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {msg.images.map((img, imgIdx) => (
                    <div
                      key={imgIdx}
                      className="relative group rounded-lg overflow-hidden border border-gray-700 cursor-zoom-in"
                      onClick={() => setPreviewImage(img.url)}
                    >
                      <img src={img.url} alt="Generated" className="w-full h-auto object-cover" />

                      {/* Model Badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-medium text-white border border-white/10 shadow-sm">
                        {img.model}
                      </div>

                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={img.url}
                            download={`lumina-${img.id}.png`}
                            className="px-3 py-1 bg-white text-black rounded-full text-xs font-bold hover:bg-gray-200 transition-colors"
                          >
                            保存 (DL)
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
              <Bot size={14} />
            </div>
            <div className="bg-gray-800 border border-gray-700 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="animate-spin" size={14} />
              思考中 & 生成中...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-800 bg-gray-900/80">
        {uploadedFiles.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs text-gray-500 font-mono">
                {uploadedFiles.length}/{useEconomy ? 3 : 14}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="relative flex-shrink-0 w-16 h-16 group">
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
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="relative flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none max-h-32 scrollbar-hide"
              placeholder="変更内容を入力するか、新しい画像をリクエスト..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="absolute right-2 bottom-2">
              <label
                className="cursor-pointer p-1.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors block"
                title={`画像を追加 (最大${useEconomy ? 3 : 14}枚)`}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <ImageIcon size={18} />
              </label>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={isSending || (!input.trim() && uploadedFiles.length === 0)}
            className={`p-3 rounded-xl transition-all text-white disabled:bg-gray-800 disabled:text-gray-500 ${useEconomy ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-purple-600 hover:bg-purple-500'}`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Refined History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <History size={18} className="text-purple-400" />
                編集履歴（最大20件）
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <ImageHistorySlider
                refreshTrigger={historyRefreshTrigger}
                onSelect={(img) => {
                  setHistory([{
                    role: 'model',
                    timestamp: Date.now(),
                    images: [img],
                    parts: img.parts,
                    text: "履歴から読み込んだ画像です。どのように調整しますか？"
                  }]);
                  setShowHistory(false);
                }}
                customFetcher={getRefinedHistory}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};