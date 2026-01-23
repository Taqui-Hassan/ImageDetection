import React, { useState } from 'react';
import FaceCapture from './components/faceCapture';
import GuestList from './components/guestList';
import BulkSender from './components/bulkSender';
import SystemStatus from './components/systemStatus';

// Icons
import LockIcon from '@mui/icons-material/Lock';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import CellTowerIcon from '@mui/icons-material/CellTower';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LogoutIcon from '@mui/icons-material/Logout';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [currentModule, setCurrentModule] = useState("menu");
  const [excelFile, setExcelFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleLogin = () => {
    const correctPassword = import.meta.env.VITE_APP_LOGIN_PASSWORD;
    if (passwordInput === correctPassword) setIsAuthenticated(true);
    else alert("Access Denied");
  };

  const handleExcelUpload = async () => {
    if (!excelFile) { setUploadStatus("Select file first."); return; }
    const formData = new FormData();
    formData.append("file", excelFile);
    try {
      setUploadStatus("Uploading...");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload-excel`, {
        method: "POST", headers: { "ngrok-skip-browser-warning": "true" }, body: formData,
      });
      await res.json();
      setUploadStatus("Database Updated!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) { setUploadStatus("Connection Error"); }
  };

  // --- 1. LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-700 text-center">
          <div className="bg-blue-500/10 p-3 rounded-full inline-flex mb-4 text-blue-500">
            <LockIcon fontSize="large" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">System Access</h1>
          <p className="text-slate-400 mb-6 text-sm">Enter admin passcode to continue</p>
          
          <input 
            type="password" 
            placeholder="Passcode" 
            className="w-full p-3 mb-4 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
            value={passwordInput} 
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-all"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  // --- 2. DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-10 font-sans">
      {/* Header */}
      <nav className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
            <h1 className="font-bold text-lg tracking-wide">EVENT OS <span className="text-slate-500 text-xs ml-1">v3.0</span></h1>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors">
            <LogoutIcon fontSize="small" /> Logout
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* System Status Widget */}
        <SystemStatus />

        {/* --- MODULE MENU --- */}
        {currentModule === "menu" && (
          <div className="animate-fade-in">
            <h2 className="text-xl md:text-2xl font-bold mb-6 text-white border-l-4 border-blue-500 pl-3">Select Module</h2>
            
            {/* 👇 RESPONSIVE GRID LOGIC: 
                grid-cols-1 = Mobile (Vertical Stack) 
                md:grid-cols-2 = Tablet/Laptop (Side by Side) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              
              {/* Card 1: AI Scanner */}
              <div 
                onClick={() => setCurrentModule('scanner')} 
                className="group cursor-pointer bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 flex flex-col items-center text-center md:items-start md:text-left"
              >
                <div className="p-3 bg-blue-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <FaceRetouchingNaturalIcon className="text-blue-500" style={{ fontSize: 36 }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">AI Scanner</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Biometric recognition for VIPs. Manage database and track entry.</p>
              </div>

              {/* Card 2: Bulk Sender */}
              <div 
                onClick={() => setCurrentModule('bulk')} 
                className="group cursor-pointer bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-green-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 flex flex-col items-center text-center md:items-start md:text-left"
              >
                <div className="p-3 bg-green-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <CellTowerIcon className="text-green-500" style={{ fontSize: 36 }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Direct Messages</h3>
                <p className="text-slate-400 text-sm leading-relaxed">Mass broadcast via Excel. Supports auto-image downloading from URLs.</p>
              </div>

            </div>
          </div>
        )}

        {/* --- MODULE: AI SCANNER --- */}
        {currentModule === "scanner" && (
          <div className="animate-fade-in">
            <button onClick={() => setCurrentModule('menu')} className="mb-4 text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium">
              ← Return to Menu
            </button>

            {/* DB Upload Card */}
            <div className="bg-slate-800/50 border-l-4 border-blue-500 p-5 rounded-r-xl mb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-blue-400">Database Import</h3>
                  <p className="text-xs text-slate-400">Update guest list via Excel.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-slate-600">
                    <UploadFileIcon fontSize="small" />
                    <span className="truncate max-w-37.5">{excelFile ? excelFile.name : "Select File"}</span>
                    <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files[0])} />
                  </label>
                  <button onClick={handleExcelUpload} disabled={!excelFile} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-900/20">
                    Update DB
                  </button>
                </div>
              </div>
              
              {/* Format Hint */}
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/50 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Required Columns:</span>
                {['Name', 'Phone', 'Seat', 'ImageURL'].map(col => (
                  <span key={col} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 font-mono">
                    {col}
                  </span>
                ))}
              </div>
              {uploadStatus && <p className="mt-3 text-sm text-green-400 font-mono">{`> ${uploadStatus}`}</p>}
            </div>

            <FaceCapture />
            <div className="mt-8">
              <GuestList />
            </div>
          </div>
        )}

        {/* --- MODULE: BULK SENDER --- */}
        {currentModule === "bulk" && <BulkSender onBack={() => setCurrentModule('menu')} />}

      </div>
    </div>
  );
}

export default App;