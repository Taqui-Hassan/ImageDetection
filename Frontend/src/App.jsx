import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';

// COMPONENTS
import GuestList from './components/guestList';
import UploadExcel from './components/UploadExcel';
import BulkSender from './components/bulkSender';
import SystemStatus from './components/systemStatus';

// ICONS
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import ReplayIcon from '@mui/icons-material/Replay';
import LockIcon from '@mui/icons-material/Lock';
import LogoutIcon from '@mui/icons-material/Logout';
import SendIcon from '@mui/icons-material/Send';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ListAltIcon from '@mui/icons-material/ListAlt';

export default function App() {
  // --- AUTH STATE ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // --- APP STATE ---
  const webcamRef = useRef(null);
  const [activeTab, setActiveTab] = useState('scan');
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- LOGIN HANDLER ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === "list2024") { 
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Incorrect Passcode");
    }
  };

  // --- CAMERA HANDLER ---
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
      alert("Backend Error. Is Python running?");
    } finally {
      setLoading(false);
    }
  }, [webcamRef]);

  // --- RENDER: LOGIN SCREEN ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
        
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm relative z-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
              <LockIcon className="text-white" style={{ fontSize: 32 }} />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center text-white mb-1">Event Entry OS</h1>
          <p className="text-slate-400 text-center text-sm mb-8">Authorized Personnel Only</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter Access Code"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center tracking-widest"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-red-400 text-xs text-center font-medium">{error}</div>}
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              Unlock Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      
      {/* --- GLASS NAVBAR --- */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="font-bold text-white">E</span>
              </div>
              <div>
                <h1 className="font-bold text-sm sm:text-base leading-none">Entry OS</h1>
                <SystemStatus /> 
              </div>
            </div>
            <button 
              onClick={() => setIsLoggedIn(false)}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <LogoutIcon fontSize="small" />
            </button>
          </div>

          <div className="flex overflow-x-auto gap-1 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            <TabButton active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={<CameraAltIcon fontSize="small"/>} label="Scanner" />
            <TabButton active={activeTab === 'guests'} onClick={() => setActiveTab('guests')} icon={<ListAltIcon fontSize="small"/>} label="Guest List" />
            <TabButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} icon={<CloudUploadIcon fontSize="small"/>} label="Import" />
            <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')} icon={<SendIcon fontSize="small"/>} label="WhatsApp" />
          </div>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-5xl mx-auto p-4 animate-fade-in">
        
        {/* VIEW: SCANNER */}
        {activeTab === 'scan' && (
          <div className="max-w-xl mx-auto mt-4">
            
            {/* CAMERA STATE */}
            {!scanResult && (
              <>
                <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 relative aspect-[4/3] sm:aspect-video">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "environment" }} 
                  />
                  
                  {/* Scanner Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-2 border-blue-500/50 rounded-xl relative">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 -mt-1 -ml-1"></div>
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 -mt-1 -mr-1"></div>
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 -mb-1 -ml-1"></div>
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 -mb-1 -mr-1"></div>
                    </div>
                  </div>
                </div>

                {/* 👇 BUTTON MOVED OUTSIDE THE IMAGE CONTAINER 👇 */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={capture}
                    disabled={loading}
                    className="w-full max-w-sm bg-white text-slate-900 rounded-xl px-8 py-5 font-bold text-lg shadow-xl shadow-blue-900/10 active:scale-95 transition-all hover:bg-slate-100 flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <span className="animate-pulse">Processing...</span>
                    ) : (
                      <>
                        <CameraAltIcon /> SCAN FACE
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* RESULT STATE: MATCH FOUND */}
            {scanResult && scanResult.status === 'matched' && (
              <div className="bg-emerald-600 rounded-3xl p-1 shadow-[0_0_50px_rgba(16,185,129,0.3)] mt-4">
                <div className="bg-slate-900 rounded-[20px] p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
                  
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircleIcon className="text-emerald-400" style={{ fontSize: 48 }} />
                  </div>

                  {/* 👇 NAME IS NOW RENDERED EXACTLY AS IS (No Uppercase) */}
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {scanResult.name}
                  </h2>
                  
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Access Granted
                  </div>

                  <div className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Assigned Seat</p>
                    <p className="text-7xl font-black text-white tracking-tighter">
                      {scanResult.seat || "A-01"}
                    </p>
                  </div>

                  <button 
                    onClick={() => setScanResult(null)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <ReplayIcon /> Next Guest
                  </button>
                </div>
              </div>
            )}

            {/* RESULT STATE: FAILED */}
            {scanResult && scanResult.status !== 'matched' && (
              <div className="bg-red-600 rounded-3xl p-1 shadow-[0_0_50px_rgba(239,68,68,0.3)] mt-4">
                <div className="bg-slate-900 rounded-[20px] p-8 text-center min-h-[300px] flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                    <PersonIcon className="text-red-500" style={{ fontSize: 48 }} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Unknown Guest</h2>
                  <p className="text-slate-400 mb-8">Face not found in database.</p>
                  
                  <button 
                    onClick={() => setScanResult(null)}
                    className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl transition-all hover:bg-slate-200"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OTHER VIEWS */}
        {activeTab === 'guests' && <div className="mt-4"><GuestList /></div>}
        {activeTab === 'upload' && <div className="mt-4"><UploadExcel /></div>}
        {activeTab === 'bulk' && <div className="mt-4"><BulkSender /></div>}

      </main>
    </div>
  );
}

// --- TAB BUTTON COMPONENT ---
function TabButton({ active, onClick, icon, label }) {
    return (
        <button 
            onClick={onClick}
            className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-w-max
                ${active 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white border border-transparent hover:border-slate-700'
                }
            `}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}