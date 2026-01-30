import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import GuestList from './components/guestList';
import UploadExcel from './components/UploadExcel';
import AddGuest from './components/AddGuest'; // (If you have this component)

// ICONS
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import ReplayIcon from '@mui/icons-material/Replay';

export default function App() {
  const webcamRef = useRef(null);
  const [activeTab, setActiveTab] = useState('scan');
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1. CAPTURE & SEND TO AI
  const capture = useCallback(async () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setLoading(true);
    setScanResult(null);

    // Convert Base64 to Blob
    const blob = await fetch(imageSrc).then(res => res.blob());
    const formData = new FormData();
    formData.append('image', blob, 'capture.jpg');

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/recognize-guest`, formData, {
        headers: { 
            'Content-Type': 'multipart/form-data',
            "ngrok-skip-browser-warning": "true" 
        }
      });
      setScanResult(res.data);
    } catch (err) {
      console.error(err);
      alert("Scan Failed. Check Backend.");
    } finally {
      setLoading(false);
    }
  }, [webcamRef]);

  // 2. RESET SCANNER
  const resetScan = () => {
    setScanResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-blue-500 selection:text-white">
      
      {/* --- NAVIGATION --- */}
      <nav className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Event OS 🚀
          </h1>
          <div className="flex gap-2">
            <button 
                onClick={() => setActiveTab('scan')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'scan' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-700'}`}
            >
              Face Scanner
            </button>
            <button 
                onClick={() => setActiveTab('guests')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'guests' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-700'}`}
            >
              Guest List
            </button>
            <button 
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'upload' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 hover:bg-slate-700'}`}
            >
              Import Data
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        
        {/* === TAB: FACE SCANNER === */}
        {activeTab === 'scan' && (
          <div className="max-w-2xl mx-auto">
            
            {/* 1. CAMERA VIEW (Only show if no result) */}
            {!scanResult && (
              <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative">
                <div className="relative aspect-video bg-black">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover opacity-90"
                    videoConstraints={{ facingMode: "user" }} // Use "environment" for back camera
                  />
                  
                  {/* Overlay Scanner UI */}
                  <div className="absolute inset-0 border-[3px] border-blue-500/30 rounded-lg m-4 pointer-events-none">
                    <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
                  </div>

                  {loading && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-blue-400 font-bold tracking-widest animate-pulse">SCANNING FACE...</p>
                    </div>
                  )}
                </div>

                <div className="p-6 text-center">
                  <button
                    onClick={capture}
                    disabled={loading}
                    className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CameraAltIcon />
                    {loading ? "Processing..." : "SCAN GUEST"}
                  </button>
                  <p className="mt-3 text-slate-500 text-sm">Ensure good lighting and face the camera directly.</p>
                </div>
              </div>
            )}

            {/* 2. SUCCESS RESULT (THE BIG UPDATE) 🚀 */}
            {scanResult && scanResult.status === 'matched' && (
              <div className="bg-linear-to-br from-green-500 to-emerald-700 rounded-3xl p-1 shadow-2xl animate-fade-in-up text-center">
                <div className="bg-slate-900 rounded-[22px] p-8 md:p-12 h-full flex flex-col items-center justify-center min-h-125">
                  
                  <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircleIcon className="text-green-400" style={{ fontSize: 60 }} />
                  </div>

                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                    Welcome, <span className="text-green-400">{scanResult.name}</span>!
                  </h2>
                  <p className="text-slate-400 text-lg mb-8">Access Granted • WhatsApp Sent ✅</p>

                  {/* 👇 THE MASSIVE SEAT NUMBER */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 w-full max-w-md mb-8">
                    <p className="text-slate-400 uppercase tracking-widest text-sm font-bold mb-2">Your Seat Number</p>
                    <p className="text-7xl md:text-9xl font-black text-white tracking-tighter">
                      {scanResult.seat || "A-12"}
                    </p>
                  </div>

                  <button 
                    onClick={resetScan}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2 border border-slate-600"
                  >
                    <ReplayIcon /> Scan Next Guest
                  </button>

                </div>
              </div>
            )}

            {/* 3. FAILED RESULT */}
            {scanResult && scanResult.status !== 'matched' && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-8 text-center animate-shake">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PersonIcon className="text-red-500" style={{ fontSize: 40 }} />
                </div>
                <h3 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h3>
                <p className="text-slate-400 mb-6">Face not recognized in the database.</p>
                <button 
                  onClick={resetScan}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-bold transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

          </div>
        )}

        {/* === OTHER TABS === */}
        {activeTab === 'guests' && <guestList />}
        {activeTab === 'upload' && <UploadExcel />}
      </main>
    </div>
  );
}