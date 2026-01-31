import { useRef, useState, useEffect } from "react";
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ReplayIcon from '@mui/icons-material/Replay';

export default function FaceCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // Stores the scan result
  const [facingMode, setFacingMode] = useState("user");

  // --- 1. START HD CAMERA (RUNS ONCE & STAYS ON) ---
  useEffect(() => {
    let currentStream = null;
    const startCamera = async () => {
        if (videoRef.current?.srcObject) {
            // Only stop tracks if we are CHANGING the camera (user clicked switch)
            // We do NOT stop tracks if just showing the result screen
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(t => t.stop());
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode,
                    width: { min: 1280, ideal: 1920, max: 2560 }, // HD 1080p
                    height: { min: 720, ideal: 1080, max: 1440 }
                } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            currentStream = stream;
        } catch (err) { 
            console.error("Camera Error:", err);
            // Fallback
            try {
                const lowStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                if (videoRef.current) videoRef.current.srcObject = lowStream;
                currentStream = lowStream;
            } catch (e) {}
        }
    };
    startCamera();
    
    // Cleanup only on component unmount
    return () => {
        if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    };
  }, [facingMode]);

  // --- 2. CAPTURE ---
  const recognizeFace = async () => {
    if (!videoRef.current) return;
    setLoading(true); 
    
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("image", blob, "capture.jpg");
      
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/recognize-guest`, {
            method: "POST", 
            headers: { "ngrok-skip-browser-warning": "true" }, 
            body: formData
        });
        const data = await res.json();
        setResult(data); // Shows overlay, but KEEPS CAMERA RUNNING BEHIND
      } catch (err) { 
        alert("System Error: Backend Offline");
      } finally { 
        setLoading(false); 
      }
    }, "image/jpeg", 0.95);
  };

  // --- 3. RESET (INSTANT) ---
  const resetScanner = () => {
    setResult(null); // Just hides the overlay. Camera is already running!
  };

  return (
    <div className="bg-black border border-slate-700 rounded-xl p-4 shadow-2xl relative overflow-hidden h-[80vh] flex flex-col">
        
        {/* --- CAMERA VIEW (ALWAYS ACTIVE) --- */}
        <div className="relative rounded-lg overflow-hidden bg-slate-900 border-2 border-slate-800 flex-grow group">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
            
            {/* Header Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-ping'}`}></div>
                    <span className="text-xs font-bold text-white/80 tracking-widest shadow-black drop-shadow-md">
                        {loading ? "TRANSMITTING..." : "LIVE FEED // REC"}
                    </span>
                </div>
                <button onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")} className="text-white hover:text-blue-400 transition-colors drop-shadow-md">
                    <CameraswitchIcon fontSize="medium" />
                </button>
            </div>

            {/* Scanning Scanline Animation */}
            {loading && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-blue-400/50 to-transparent animate-[scan_1.5s_linear_infinite] border-b-4 border-blue-400 shadow-[0_0_20px_#60a5fa]"></div>
                </div>
            )}

            {/* 🟢 SUCCESS OVERLAY (Absolute Positioned on top of video) */}
            {result && result.status === 'matched' && (
                <div className="absolute inset-0 z-50 bg-emerald-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 shadow-2xl">
                        <CheckCircleIcon className="text-white" style={{ fontSize: 50 }} />
                    </div>
                    <h1 className="text-4xl font-black text-white mb-2 drop-shadow-md">{result.name}</h1>
                    <div className="inline-block bg-emerald-800/40 px-4 py-1 rounded-full text-emerald-100 font-bold tracking-widest mb-6 border border-emerald-400/30">
                        ACCESS GRANTED
                    </div>
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-full max-w-xs mx-auto mb-6 shadow-xl">
                        <p className="text-emerald-100 text-xs font-bold uppercase tracking-[0.2em] mb-1">Assigned Seat</p>
                        <p className="text-6xl font-black text-white tracking-tighter shadow-black">
                            {result.seat || "A-01"}
                        </p>
                    </div>
                    <button onClick={resetScanner} className="bg-white text-emerald-800 font-bold text-lg py-4 px-10 rounded-xl shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
                        <ReplayIcon fontSize="medium" /> NEXT GUEST
                    </button>
                </div>
            )}

            {/* 🔴 FAILED OVERLAY */}
            {result && result.status !== 'matched' && (
                <div className="absolute inset-0 z-50 bg-red-600/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 shadow-2xl">
                        <PersonIcon className="text-white" style={{ fontSize: 50 }} />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2 drop-shadow-md">UNKNOWN GUEST</h1>
                    <p className="text-red-100 text-lg font-medium mb-8 max-w-xs">Face not found in list.</p>
                    <button onClick={resetScanner} className="bg-white text-red-800 font-bold text-lg py-4 px-10 rounded-xl shadow-xl hover:scale-105 transition-transform flex items-center gap-2">
                        <ReplayIcon fontSize="medium" /> TRY AGAIN
                    </button>
                </div>
            )}
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* --- BOTTOM BUTTON --- */}
        <div className="mt-4">
            <button 
                onClick={recognizeFace} 
                disabled={loading || result !== null} // Disable if scanning or showing result
                className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg ${
                    loading 
                    ? 'bg-slate-800 text-slate-400 cursor-wait border border-slate-700' 
                    : 'bg-white text-black hover:bg-slate-200 active:scale-95'
                }`}
            >
                {loading ? "PROCESSING..." : <><CameraAltIcon /> SCAN FACE</>}
            </button>
        </div>
    </div>
  );
}