import { useRef, useState, useEffect } from "react";
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ReplayIcon from '@mui/icons-material/Replay';
import PersonIcon from '@mui/icons-material/Person';

export default function FaceCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [facingMode, setFacingMode] = useState("user");

  // --- 1. START HD CAMERA ---
  useEffect(() => {
    let currentStream = null;
    const startCamera = async () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode,
                    width: { min: 1280, ideal: 1920, max: 2560 }, // HD 1080p
                    height: { min: 720, ideal: 1080, max: 1440 }
                } 
            });
            if (videoRef.current) videoRef.current.srcObject = stream;
            currentStream = stream;
        } catch (err) { 
            console.error("Camera Error:", err);
            // Fallback for older phones
            try {
                const lowStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
                if (videoRef.current) videoRef.current.srcObject = lowStream;
                currentStream = lowStream;
            } catch (e) {}
        }
    };
    startCamera();
    return () => currentStream?.getTracks().forEach(t => t.stop());
  }, [facingMode]);

  // --- 2. CAPTURE & SCAN ---
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
        setResult(data); // Show the Big Screen
      } catch (err) { 
        alert("System Error: Backend Offline");
      } finally { 
        setLoading(false); 
      }
    }, "image/jpeg", 0.95);
  };

  // --- 3. RESET SCANNER ---
  const resetScanner = () => {
    setResult(null);
  };

  // ============================================================
  // VIEW 1: SUCCESS (BIG GREEN SCREEN)
  // ============================================================
  if (result && result.status === 'matched') {
    return (
      <div className="fixed inset-0 z-50 bg-emerald-600 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        
        {/* Success Icon */}
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-2xl">
            <CheckCircleIcon className="text-white" style={{ fontSize: 64 }} />
        </div>

        {/* Name */}
        <h1 className="text-4xl sm:text-6xl font-black text-white mb-2 drop-shadow-md">
            {result.name}
        </h1>
        
        <div className="inline-block bg-emerald-800/30 px-6 py-2 rounded-full text-emerald-100 font-bold tracking-widest mb-10 border border-emerald-400/30">
            ACCESS GRANTED
        </div>

        {/* Seat Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 w-full max-w-sm mx-auto mb-10 shadow-xl">
            <p className="text-emerald-100 text-sm font-bold uppercase tracking-[0.2em] mb-2">Assigned Seat</p>
            <p className="text-7xl font-black text-white tracking-tighter shadow-black">
                {result.seat || "A-01"}
            </p>
        </div>

        {/* Custom Message (if any) */}
        {result.message && (
             <p className="text-yellow-300 font-bold text-lg mb-8 bg-black/20 px-4 py-2 rounded-lg">
                ⚠️ {result.message}
             </p>
        )}

        {/* Next Button */}
        <button 
            onClick={resetScanner}
            className="bg-white text-emerald-800 font-bold text-xl py-5 px-12 rounded-2xl shadow-xl hover:scale-105 transition-transform flex items-center gap-3"
        >
            <ReplayIcon fontSize="large" /> NEXT GUEST
        </button>
      </div>
    );
  }

  // ============================================================
  // VIEW 2: FAILED (BIG RED SCREEN)
  // ============================================================
  if (result && result.status !== 'matched') {
    return (
      <div className="fixed inset-0 z-50 bg-red-600 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-2xl">
            <PersonIcon className="text-white" style={{ fontSize: 64 }} />
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 drop-shadow-md">
            UNKNOWN GUEST
        </h1>
        
        <p className="text-red-100 text-xl font-medium mb-10 max-w-md">
            Face not found in the guest list. Please check with the registration desk.
        </p>

        <button 
            onClick={resetScanner}
            className="bg-white text-red-800 font-bold text-xl py-5 px-12 rounded-2xl shadow-xl hover:scale-105 transition-transform flex items-center gap-3"
        >
            <ReplayIcon fontSize="large" /> TRY AGAIN
        </button>
      </div>
    );
  }

  // ============================================================
  // VIEW 3: CAMERA (DEFAULT)
  // ============================================================
  return (
    <div className="bg-black border border-slate-700 rounded-xl p-4 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-ping'}`}></div>
                <span className="text-xs font-bold text-slate-400 tracking-widest">
                    {loading ? "TRANSMITTING..." : "LIVE FEED // REC"}
                </span>
            </div>
            <button onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")} className="text-slate-500 hover:text-white transition-colors">
                <CameraswitchIcon fontSize="small" />
            </button>
        </div>

        {/* Viewfinder */}
        <div className="relative rounded-lg overflow-hidden bg-slate-900 border-2 border-slate-800 aspect-[4/3] group">
            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
            
            {/* Grid Overlay */}
            <div className="absolute inset-0 border border-slate-500/20 m-4 rounded pointer-events-none"></div>

            {/* Scanning Animation */}
            {loading && (
                <div className="absolute inset-0 z-10">
                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-blue-400/30 to-transparent animate-[scan_1.5s_linear_infinite] border-b-2 border-blue-400"></div>
                </div>
            )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Sending Message */}
        {loading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-blue-400 animate-pulse">
                <CloudUploadIcon fontSize="small" />
                <span className="text-xs font-bold tracking-wider">SENDING TO AI...</span>
            </div>
        )}

        {/* Capture Button */}
        <div className="mt-4">
            <button 
                onClick={recognizeFace} 
                disabled={loading}
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