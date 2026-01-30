import { useRef, useState, useEffect } from "react";
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function FaceCapture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [facingMode, setFacingMode] = useState("user");

  useEffect(() => {
    let currentStream = null;
    const startCamera = async () => {
        if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
            if (videoRef.current) videoRef.current.srcObject = stream;
            currentStream = stream;
        } catch (err) { console.error(err); }
    };
    startCamera();
    return () => currentStream?.getTracks().forEach(t => t.stop());
  }, [facingMode]);

  const recognizeFace = async () => {
    if (!videoRef.current) return;
    setLoading(true); setResult(null);
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("image", blob, "capture.jpg");
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/recognize-guest`, {
            method: "POST", headers: { "ngrok-skip-browser-warning": "true" }, body: formData
        });
        setResult(await res.json());
      } catch (err) { setResult({ error: "System Offline" }); } 
      finally { setLoading(false); }
    }, "image/jpeg");
  };

  return (
    <div className="bg-black border border-slate-700 rounded-xl p-4 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-ping'}`}></div>
                <span className="text-xs font-bold text-slate-400 tracking-widest">
                    {loading ? "TRANSMITTING DATA..." : "LIVE FEED // REC"}
                </span>
            </div>
            <button onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")} className="text-slate-500 hover:text-white transition-colors">
                <CameraswitchIcon fontSize="small" />
            </button>
        </div>

        {/* Viewfinder */}
        <div className="relative rounded-lg overflow-hidden bg-slate-900 border-2 border-slate-800 aspect-4/3 group">
            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
            
            {/* Overlay Grid */}
            <div className="absolute inset-0 border border-slate-500/20 m-4 rounded pointer-events-none"></div>
            
            {/* Scanning Animation (Only when sending) */}
            {loading && (
                <div className="absolute inset-0 z-10">
                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-blue-400/30 to-transparent animate-[scan_1.5s_linear_infinite] border-b-2 border-blue-400"></div>
                </div>
            )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Status Message (The Relief Message) */}
        {loading && (
            <div className="mt-3 flex items-center justify-center gap-2 text-blue-400 animate-pulse">
                <CloudUploadIcon fontSize="small" />
                <span className="text-xs font-bold tracking-wider">SENDING TO AI ENGINE...</span>
            </div>
        )}

        {/* Capture Button */}
        <div className="mt-4">
            <button 
                onClick={recognizeFace} 
                disabled={loading}
                className={`w-full font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
                    loading 
                    ? 'bg-slate-800 text-slate-400 cursor-wait border border-slate-700' 
                    : 'bg-white text-black hover:bg-slate-200'
                }`}
            >
                {loading ? "SENDING..." : <><CameraAltIcon /> CAPTURE</>}
            </button>
        </div>

        {/* Result Card */}
        {result && (
            <div className={`mt-4 p-4 rounded-lg border ${result.status === 'matched' ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'} animate-fade-in`}>
                <div className="flex items-start gap-3">
                    {result.status === 'matched' ? <CheckCircleIcon className="text-green-500" /> : <WarningIcon className="text-red-500" />}
                    <div>
                        <h4 className={`text-sm font-bold uppercase ${result.status === 'matched' ? 'text-green-500' : 'text-red-500'}`}>
                            {result.status === 'matched' ? 'IDENTITY VERIFIED' : 'NO MATCH FOUND'}
                        </h4>
                        {result.name && <p className="text-xl font-bold text-white mt-1">Welcome {result.name} San</p>}
                        {result.seat && <p className="text-sm text-slate-400 font-mono">Your SEAT: <span className="text-white">{result.seat}</span></p>}
                        
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}