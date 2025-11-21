
import React, { useState, useCallback } from 'react';
import { AppState, AnalysisResult, MinimapBounds } from './types';
import { analyzeValorantScreenshot } from './services/geminiService';
import AnalysisVisualizer from './components/AnalysisVisualizer';
import MinimapSelector from './components/MinimapSelector';
import { Upload, Loader2, AlertCircle, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Basic validation
      if (!file.type.startsWith('image/')) {
        setErrorMsg("Please upload a valid image file.");
        return;
      }

      // Convert to base64 for preview and API
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Result = reader.result as string;
        setImageSrc(base64Result);
        setErrorMsg('');
        // Move to Crop state instead of immediately analyzing
        setState(AppState.CROP);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCrop = async (bounds: MinimapBounds) => {
    if (!imageSrc) return;

    setState(AppState.ANALYZING);
    
    // Strip prefix for API
    const base64Data = imageSrc.split(',')[1];

    try {
      const result = await analyzeValorantScreenshot(base64Data, bounds);
      setAnalysisData(result);
      setState(AppState.SUCCESS);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to analyze the image. Please try a clearer screenshot.");
      setState(AppState.ERROR);
    }
  };

  const handleReset = useCallback(() => {
    setState(AppState.IDLE);
    setImageSrc(null);
    setAnalysisData(null);
    setErrorMsg('');
  }, []);

  return (
    <div className="min-h-screen bg-[#0f1923] text-white relative overflow-x-hidden selection:bg-[#ff4655] selection:text-white">
      {/* Background decorations */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#ff4655] opacity-5 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[10%] right-[0%] w-[40%] h-[40%] bg-[#00e5bf] opacity-5 blur-[150px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-[#0f1923]/90 backdrop-blur-sm sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#ff4655] p-1.5 rounded-sm">
              <Zap className="w-6 h-6 text-black fill-current" />
            </div>
            <h1 className="text-3xl font-valo tracking-widest pt-1">VALO<span className="text-[#ff4655]">MAP</span> ANALYST</h1>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-400 tracking-wider">
            <span className="hover:text-[#ff4655] cursor-pointer transition-colors">HISTORY</span>
            <span className="hover:text-[#ff4655] cursor-pointer transition-colors">AGENTS</span>
            <div className="w-px h-4 bg-gray-600"></div>
            <span className="text-[#ff4655]">V1.1</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        
        {state === AppState.IDLE && (
          <div className="w-full max-w-2xl text-center space-y-10 animate-fade-in-up">
            <div className="space-y-4">
              <h2 className="text-5xl md:text-7xl font-valo uppercase tracking-tight">
                Master The <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4655] to-[#ff8a95]">Minimap</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-lg mx-auto">
                Upload your Valorant screenshot. Manually select the minimap to ensure 100% detection accuracy.
              </p>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#ff4655] to-[#00e5bf] rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-[#1f2937] border border-gray-600 hover:border-gray-500 rounded-lg p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group-hover:-translate-y-1">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div className="w-20 h-20 bg-[#0f1923] rounded-full flex items-center justify-center border border-dashed border-gray-500 group-hover:border-[#ff4655] transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#ff4655]" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold text-white">Drop your screenshot here</p>
                  <p className="text-sm text-gray-500">Supports PNG, JPG, WEBP</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {state === AppState.CROP && imageSrc && (
          <MinimapSelector 
            imageSrc={imageSrc}
            onConfirm={handleConfirmCrop}
            onCancel={handleReset}
          />
        )}

        {state === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center space-y-6 animate-pulse">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-[#ff4655]/20 border-t-[#ff4655] rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="w-8 h-8 text-[#ff4655]" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-valo tracking-wide">Scanning Selected Zone...</h3>
              <p className="text-gray-400 font-mono text-sm">IDENTIFYING AGENTS • TRIANGULATING POSITIONS</p>
            </div>
          </div>
        )}

        {state === AppState.SUCCESS && analysisData && imageSrc && (
          <AnalysisVisualizer 
            imageSrc={imageSrc}
            data={analysisData}
            onReset={handleReset}
          />
        )}

        {state === AppState.ERROR && (
           <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-lg text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Analysis Failed</h3>
              <p className="text-gray-300 mb-6">{errorMsg}</p>
              <button 
                onClick={handleReset}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded transition-colors"
              >
                Try Again
              </button>
           </div>
        )}

      </main>

      <footer className="relative z-10 border-t border-white/5 bg-[#0f1923] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-gray-600 text-sm">
          <p>&copy; 2024 VALOMAP ANALYST. Fan project. Not affiliated with Riot Games.</p>
          <p className="font-mono text-xs mt-2 md:mt-0">POWERED BY GOOGLE GEMINI 2.5</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
