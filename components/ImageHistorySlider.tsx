import React, { useEffect, useState } from 'react';
import { GeneratedImage } from '../types';
import { getHistory } from '../services/storageService';
import { History, Clock } from 'lucide-react';

interface Props {
    onSelect: (image: GeneratedImage) => void;
    refreshTrigger: number; // Prop to trigger refresh when new image is generated
    customFetcher?: () => Promise<GeneratedImage[]>; // Optional custom fetcher
}

export const ImageHistorySlider: React.FC<Props> = ({ onSelect, refreshTrigger, customFetcher }) => {
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, [refreshTrigger]);

    const loadHistory = async () => {
        try {
            const fetcher = customFetcher || getHistory;
            const history = await fetcher();
            setImages(history);
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return null;
    if (images.length === 0) return null;

    return (
        <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="flex items-center gap-2 mb-3 px-2">
                <History size={16} className="text-gray-400" />
                <h3 className="text-sm font-medium text-gray-300">最近の作成履歴 (直近10枚)</h3>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-4 px-2 scrollbar-hide snap-x">
                {images.map((img) => (
                    <button
                        key={img.id}
                        onClick={() => onSelect(img)}
                        className="relative flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-gray-800 hover:border-blue-500 transition-all group snap-start focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <img
                            src={img.url}
                            alt={img.prompt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />

                        {/* Model Badge */}
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-medium text-white border border-white/10">
                            {img.model.replace('Gemini ', '').replace('Imagen ', '')}
                        </div>

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-end justify-center pb-2">
                            <span className="text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
                                編集する
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
