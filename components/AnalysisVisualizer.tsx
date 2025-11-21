import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, PlayerPosition } from '../types';
import { Crosshair, User, Shield, ShieldAlert } from 'lucide-react';

interface AnalysisVisualizerProps {
  imageSrc: string;
  data: AnalysisResult;
  onReset: () => void;
}

const AnalysisVisualizer: React.FC<AnalysisVisualizerProps> = ({ imageSrc, data, onReset }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to determine dot color based on team string
  const getTeamColor = (team: string) => {
    const t = team.toLowerCase();
    if (t.includes('red') || t.includes('attack')) return 'bg-[#ff4655] ring-[#ff4655]'; // Valorant Red
    if (t.includes('blue') || t.includes('cyan') || t.includes('defend')) return 'bg-[#00e5bf] ring-[#00e5bf]'; // Valorant Cyan
    if (t.includes('green')) return 'bg-green-500 ring-green-500';
    if (t.includes('yellow')) return 'bg-yellow-400 ring-yellow-400';
    return 'bg-white ring-white';
  };

  const bounds = data.minimapBounds;
  
  // Calculate style for the minimap highlighter box
  // The API returns 0-1000 scale. We convert to percentage.
  const highlightStyle: React.CSSProperties = {
    top: `${bounds.ymin / 10}%`,
    left: `${bounds.xmin / 10}%`,
    width: `${(bounds.xmax - bounds.xmin) / 10}%`,
    height: `${(bounds.ymax - bounds.ymin) / 10}%`,
  };

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Visualization Area */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-2xl">
            {/* Header overlay */}
            <div className="absolute top-0 left-0 w-full bg-gradient-to-b from-black/70 to-transparent p-4 z-10 pointer-events-none flex justify-between items-start">
              <div className="text-white">
                <h2 className="text-2xl font-valo tracking-wider text-[#ff4655]">
                  MAP: {data.mapName.toUpperCase()}
                </h2>
                <p className="text-xs text-gray-300 font-mono">
                  DETECTED PLAYERS: {data.players.length}
                </p>
              </div>
            </div>

            {/* Image Container */}
            <div className="relative" ref={containerRef}>
              <img 
                src={imageSrc} 
                alt="Match Analysis" 
                className="w-full h-auto block opacity-80"
                onLoad={() => setImageLoaded(true)}
              />
              
              {imageLoaded && (
                <>
                  {/* Minimap Bounding Box Highlight */}
                  <div 
                    className="absolute border-2 border-[#ff4655]/50 bg-[#ff4655]/10 backdrop-blur-[1px] transition-all duration-700 ease-out z-10"
                    style={highlightStyle}
                  >
                    <div className="absolute -top-6 left-0 bg-[#ff4655] text-black text-[10px] font-bold px-1 py-0.5 font-mono">
                      MINIMAP ZONE
                    </div>
                    
                    {/* Players within the minimap box */}
                    {data.players.map((player, idx) => (
                      <div
                        key={idx}
                        className={`absolute w-3 h-3 rounded-full border border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center group cursor-help transition-all hover:scale-150 ${getTeamColor(player.team)}`}
                        style={{
                          left: `${player.x}%`,
                          top: `${player.y}%`
                        }}
                      >
                         {/* Tooltip */}
                         <div className="absolute bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-black/90 text-white text-xs px-2 py-1 rounded border border-gray-600 pointer-events-none">
                            {player.agentGuess || 'Unknown Agent'} ({player.team})
                         </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex justify-end">
             <button 
              onClick={onReset}
              className="px-6 py-2 bg-transparent border border-[#ff4655] text-[#ff4655] hover:bg-[#ff4655] hover:text-white transition-colors uppercase font-bold tracking-wider text-sm"
            >
              Analyze New Match
            </button>
          </div>
        </div>

        {/* Sidebar / Data Panel */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-[#1f2937] p-5 border-t-4 border-[#ff4655] rounded-b shadow-lg">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
              Tactical Assessment
            </h3>
            <p className="text-gray-100 leading-relaxed text-sm">
              {data.summary}
            </p>
          </div>

          {/* Player List */}
          <div className="bg-[#1f2937] p-0 rounded overflow-hidden shadow-lg">
             <div className="bg-[#0f1923] p-3 border-b border-gray-700 flex items-center gap-2">
                <User className="w-4 h-4 text-[#ff4655]" />
                <h3 className="text-white text-sm font-bold uppercase tracking-wider">Detected Agents</h3>
             </div>
             <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                {data.players.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors group">
                     <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${getTeamColor(player.team).split(' ')[0]}`}></div>
                        <span className="text-sm text-gray-200 font-medium">
                          {player.agentGuess || `Unknown ${player.team}`}
                        </span>
                     </div>
                     <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-300">
                       x:{Math.round(player.x)}, y:{Math.round(player.y)}
                     </span>
                  </div>
                ))}
             </div>
          </div>

          {/* Legend */}
          <div className="bg-[#1f2937] p-4 rounded shadow-lg">
             <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">
               Map Key
             </h3>
             <div className="flex gap-4 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-[#ff4655] border border-white"></div>
                   <span>Attackers / Red</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-[#00e5bf] border border-white"></div>
                   <span>Defenders / Blue</span>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AnalysisVisualizer;
