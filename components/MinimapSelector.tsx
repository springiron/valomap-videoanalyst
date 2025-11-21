
import React, { useState, useRef, useEffect } from 'react';
import { MinimapBounds } from '../types';
import { Crop, Check, MousePointer2 } from 'lucide-react';

interface MinimapSelectorProps {
  imageSrc: string;
  onConfirm: (bounds: MinimapBounds) => void;
  onCancel: () => void;
}

const MinimapSelector: React.FC<MinimapSelectorProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<MinimapBounds | null>(null);

  // Default suggestion (Top Left) if nothing selected
  useEffect(() => {
    if (!selection) {
      // Initial rough guess: Top left 25%
      setSelection({ xmin: 0, ymin: 0, xmax: 250, ymax: 250 });
    }
  }, []);

  const getMousePos = (e: React.MouseEvent | MouseEvent) => {
    if (!imgRef.current || !containerRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    
    // Calculate position relative to image
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    // Convert to 0-1000 scale
    const scaleX = 1000 / rect.width;
    const scaleY = 1000 / rect.height;

    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY)
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getMousePos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDragging(true);
    setSelection(null); // Clear previous selection while drawing new one
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !startPos) return;
    const pos = getMousePos(e);
    setCurrentPos(pos);
  };

  const handleMouseUp = () => {
    if (isDragging && startPos && currentPos) {
      const newSelection: MinimapBounds = {
        xmin: Math.min(startPos.x, currentPos.x),
        ymin: Math.min(startPos.y, currentPos.y),
        xmax: Math.max(startPos.x, currentPos.x),
        ymax: Math.max(startPos.y, currentPos.y)
      };

      // Ensure minimum size to avoid accidental clicks
      if (newSelection.xmax - newSelection.xmin > 20 && newSelection.ymax - newSelection.ymin > 20) {
        setSelection(newSelection);
      }
      
      setIsDragging(false);
      setStartPos(null);
      setCurrentPos(null);
    }
  };

  // Handle drawing visual
  const getSelectionStyle = () => {
    // If we are dragging, show current drag box
    if (isDragging && startPos && currentPos) {
      const xmin = Math.min(startPos.x, currentPos.x);
      const ymin = Math.min(startPos.y, currentPos.y);
      const width = Math.abs(currentPos.x - startPos.x);
      const height = Math.abs(currentPos.y - startPos.y);
      return {
        left: `${xmin / 10}%`,
        top: `${ymin / 10}%`,
        width: `${width / 10}%`,
        height: `${height / 10}%`
      };
    }
    
    // If we have a finalized selection
    if (selection) {
      return {
        left: `${selection.xmin / 10}%`,
        top: `${selection.ymin / 10}%`,
        width: `${(selection.xmax - selection.xmin) / 10}%`,
        height: `${(selection.ymax - selection.ymin) / 10}%`
      };
    }
    
    return { display: 'none' };
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full max-w-5xl animate-fade-in-up">
       <div className="text-center space-y-2">
          <h2 className="text-2xl font-valo tracking-wide text-white">Select Minimap Area</h2>
          <p className="text-gray-400 text-sm">
            Click and drag to draw a box around the minimap. This helps the AI accuracy.
          </p>
       </div>

       <div 
          ref={containerRef}
          className="relative border-2 border-gray-700 rounded-lg overflow-hidden cursor-crosshair shadow-2xl bg-black"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
       >
          <img 
            ref={imgRef}
            src={imageSrc} 
            alt="Crop Target" 
            className="w-full max-h-[70vh] object-contain block select-none pointer-events-none"
            draggable={false}
          />
          
          {/* Overlay Mask (Darken non-selected areas) */}
          <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>

          {/* Selection Box */}
          <div 
            className="absolute border-2 border-[#ff4655] bg-transparent z-10 box-border pointer-events-none"
            style={getSelectionStyle()}
          >
             <div className="absolute inset-0 bg-white/10"></div>
             {/* Corner Handles Visuals */}
             <div className="absolute top-0 left-0 w-2 h-2 bg-[#ff4655] -translate-x-1/2 -translate-y-1/2"></div>
             <div className="absolute top-0 right-0 w-2 h-2 bg-[#ff4655] translate-x-1/2 -translate-y-1/2"></div>
             <div className="absolute bottom-0 left-0 w-2 h-2 bg-[#ff4655] -translate-x-1/2 translate-y-1/2"></div>
             <div className="absolute bottom-0 right-0 w-2 h-2 bg-[#ff4655] translate-x-1/2 translate-y-1/2"></div>
             
             {/* Label */}
             <div className="absolute -top-7 left-0 bg-[#ff4655] text-white text-xs font-bold px-2 py-1 rounded-t font-mono flex items-center gap-1">
                <Crop className="w-3 h-3" /> MINIMAP
             </div>
          </div>
       </div>

       <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400 rounded transition-colors font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => selection && onConfirm(selection)}
            disabled={!selection}
            className={`px-8 py-2 flex items-center gap-2 bg-[#ff4655] text-white font-bold uppercase tracking-wider rounded transition-all shadow-lg hover:shadow-[#ff4655]/50 ${!selection ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#e03e4d] transform hover:-translate-y-1'}`}
          >
            <Check className="w-4 h-4" />
            Confirm & Analyze
          </button>
       </div>
    </div>
  );
};

export default MinimapSelector;
