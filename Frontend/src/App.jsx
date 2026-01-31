import React, { useState } from 'react';

// --- COMPONENTS ---
import FaceCapture from './components/faceCapture'; 
import GuestList from './components/guestList'; 
import UploadExcel from './components/UploadExcel'; 
import BulkSender from './components/bulkSender';
import SystemStatus from './components/systemStatus';

// ICONS
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import SendIcon from '@mui/icons-material/Send';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LogoutIcon from '@mui/icons-material/Logout';
import LockIcon from '@mui/icons-material/Lock';

export default function App() {
  // --- AUTH STATE ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState('scan');

  // --- LOGIN HANDLER ---
  const handleLogin = (e) => {
    e.preventDefault();
    // Get password from .env
    const appPassword = import.meta.env.VITE_APP_LOGIN_PASSWORD;

    if (!appPassword) {
        console.error("⚠️ VITE_APP_LOGIN_PASSWORD is missing in .env file!");
        setError("Config Error: Check .env");
        return;
    }

    if (password === appPassword) { 
      setIsLoggedIn(true);
      setError("");
    } else {
      setError("Incorrect Passcode");
    }
  };

  // --- RENDER: LOGIN SCREEN ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Decoration */}
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

          {/* TABS SCROLLABLE */}
          <div className="flex overflow-x-auto gap-1 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            <TabButton active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={<CameraAltIcon fontSize="small"/>} label="Scanner" />
            <TabButton active={activeTab === 'guests'} onClick={() => setActiveTab('guests')} icon={<ListAltIcon fontSize="small"/>} label="Guest List" />
            <TabButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} icon={<CloudUploadIcon fontSize="small"/>} label="Import" />
            <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')} icon={<SendIcon fontSize="small"/>} label="WhatsApp" />
          </div>
        </div>
      </nav>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="max-w-5xl mx-auto p-4 animate-fade-in">
        
        {/* TAB 1: HD SCANNER */}
        {activeTab === 'scan' && (
          <div className="max-w-xl mx-auto mt-4">
            {/* 👇 THIS IS THE NEW COMPONENT 👇 */}
            <FaceCapture />
          </div>
        )}

        {/* TAB 2: GUEST LIST */}
        {activeTab === 'guests' && (
           <div className="mt-4">
             <GuestList />
           </div>
        )}

        {/* TAB 3: UPLOAD EXCEL */}
        {activeTab === 'upload' && (
           <div className="mt-4">
             <UploadExcel />
           </div>
        )}

        {/* TAB 4: WHATSAPP BULK SENDER */}
        {activeTab === 'bulk' && (
           <div className="mt-4">
             <BulkSender />
           </div>
        )}

      </main>
    </div>
  );
}

// --- HELPER: TAB BUTTON ---
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