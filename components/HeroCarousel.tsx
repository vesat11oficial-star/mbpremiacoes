import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { raffleService } from '../services/raffleService';

export const HeroCarousel: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBanners = async () => {
        try {
            const fetched = await raffleService.getBanners();
            setImages(fetched);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    loadBanners();
  }, []);

  useEffect(() => {
    // Only auto-play if there is more than one image
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images]);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  // If loading, show placeholder (subtle)
  if (loading) return <div className="w-full aspect-[2400/910] animate-pulse" />;
  
  // If loaded and no images, return nothing (remove from DOM)
  if (images.length === 0) return null;

  return (
    <div className="relative w-full aspect-[2400/910] overflow-hidden group">
      
      {/* Images */}
      {images.map((img, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img 
            src={img} 
            alt="Banner Promocional" 
            className="w-full h-full object-cover" 
          />
        </div>
      ))}

      {/* Controls - Only show if more than 1 image */}
      {images.length > 1 && (
        <>
            <button 
                onClick={prevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-30 p-1.5 hover:bg-zinc-800/50 rounded-full text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 duration-300"
            >
                <ChevronLeft size={24} />
            </button>
            <button 
                onClick={nextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-30 p-1.5 hover:bg-zinc-800/50 rounded-full text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 duration-300"
            >
                <ChevronRight size={24} />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
                {images.map((_, idx) => (
                <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all shadow-sm ${
                    idx === currentIndex ? 'bg-yellow-500 w-6' : 'bg-white/20 hover:bg-white/50 w-1.5'
                    }`}
                />
                ))}
            </div>
        </>
      )}
    </div>
  );
};