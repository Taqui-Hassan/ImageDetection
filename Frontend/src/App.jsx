import React, { useState } from 'react';
import { Container, CssBaseline, Box, Paper, Typography, Button, TextField, ThemeProvider, createTheme, Fade, Grid, Chip } from '@mui/material';
import FaceCapture from './components/faceCapture';
import GuestList from './components/guestList';
import BulkSender from './components/bulkSender'; 
import SystemStatus from './components/systemStatus'; // ✅ Imported with Capital Letter

// ICONS
import LockIcon from '@mui/icons-material/Lock';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import CellTowerIcon from '@mui/icons-material/CellTower';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LogoutIcon from '@mui/icons-material/Logout';

// 🌑 TECH DARK THEME
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6' },
    secondary: { main: '#a855f7' },
    background: { default: '#0f172a', paper: '#1e293b' },
    text: { primary: '#f1f5f9', secondary: '#94a3b8' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
    h6: { fontWeight: 600, letterSpacing: '0.05em' },
    button: { fontWeight: 600 }
  },
  shape: { borderRadius: 12 }
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [currentModule, setCurrentModule] = useState("menu"); 
  const [excelFile, setExcelFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleLogin = () => {
    if (passwordInput === "admin123") setIsAuthenticated(true);
    else alert("ACCESS DENIED");
  };

  const handleExcelUpload = async () => {
    if (!excelFile) { setUploadStatus("Select file first."); return; }
    const formData = new FormData();
    formData.append("file", excelFile);
    try {
      setUploadStatus("UPLOADING...");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload-excel`, {
        method: "POST", headers: { "ngrok-skip-browser-warning": "true" }, body: formData,
      });
      await res.json();
      setUploadStatus("DATABASE UPDATED");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) { setUploadStatus("CONNECTION ERROR"); }
  };

  // 1. LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0f172a' }}>
          <Paper sx={{ p: 5, width: 350, textAlign: 'center', border: '1px solid #334155', bgcolor: '#1e293b' }}>
            <Box mb={3} color="#3b82f6"><LockIcon fontSize="large" /></Box>
            <Typography variant="h5" color="white" gutterBottom>SYSTEM ACCESS</Typography>
            <TextField fullWidth type="password" placeholder="Passcode" variant="outlined" 
              value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()} sx={{ mb: 3 }}
            />
            <Button variant="contained" fullWidth size="large" onClick={handleLogin}>AUTHENTICATE</Button>
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  // 2. MAIN APP
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: '#0f172a', pb: 5 }}>
        <Box sx={{ borderBottom: '1px solid #334155', bgcolor: '#1e293b', py: 2, px: 4, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6" color="white">EVENT OS <span style={{opacity:0.5}}>v2.1</span></Typography>
            <Button startIcon={<LogoutIcon />} color="inherit" onClick={() => setIsAuthenticated(false)}>LOGOUT</Button>
        </Box>

        <Container maxWidth="md" sx={{ mt: 5 }}>
            
            {/* ✅ SYSTEM STATUS WIDGET */}
            <SystemStatus />

            {/* --- MENU --- */}
            {currentModule === "menu" && (
                <Fade in={true}>
                    <Box>
                        <Typography variant="h4" color="white" gutterBottom sx={{ mb: 4 }}>SELECT MODULE</Typography>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Paper onClick={() => setCurrentModule('scanner')} sx={{ p: 4, cursor: 'pointer', border: '1px solid #334155', height: '100%', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-5px)', borderColor: '#3b82f6' } }}>
                                    <FaceRetouchingNaturalIcon sx={{ fontSize: 50, color: '#3b82f6', mb: 2 }} />
                                    <Typography variant="h5" fontWeight="bold">AI SCANNER</Typography>
                                    <Typography variant="body2" color="textSecondary">Biometric recognition & DB Management.</Typography>
                                </Paper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Paper onClick={() => setCurrentModule('bulk')} sx={{ p: 4, cursor: 'pointer', border: '1px solid #334155', height: '100%', transition: 'all 0.3s', '&:hover': { transform: 'translateY(-5px)', borderColor: '#10b981' } }}>
                                    <CellTowerIcon sx={{ fontSize: 50, color: '#10b981', mb: 2 }} />
                                    <Typography variant="h5" fontWeight="bold">DIRECT BLAST</Typography>
                                    <Typography variant="body2" color="textSecondary">Mass message via Excel + Image URLs.</Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                </Fade>
            )}

            {/* --- MODULE 1: AI SCANNER --- */}
            {currentModule === "scanner" && (
                <Fade in={true}>
                    <Box>
                        <Button onClick={() => setCurrentModule('menu')} sx={{ mb: 2, color: '#94a3b8' }}>&larr; RETURN TO MODULES</Button>
                        
                        {/* 2.1 DB UPLOAD WITH FORMAT GUIDE */}
                        <Paper sx={{ p: 3, mb: 4, borderLeft: '4px solid #3b82f6', bgcolor: 'rgba(59, 130, 246, 0.05)' }}>
                            <Box display="flex" alignItems="center" gap={2} mb={2}>
                                <Box flexGrow={1}>
                                    <Typography variant="h6" color="primary">BIOMETRIC DATA IMPORT</Typography>
                                    <Typography variant="caption" color="textSecondary">Update known guest database.</Typography>
                                </Box>
                                <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                                    {excelFile ? excelFile.name : "SELECT FILE"}
                                    <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files[0])} />
                                </Button>
                                <Button variant="contained" onClick={handleExcelUpload} disabled={!excelFile}>UPDATE DB</Button>
                            </Box>

                            {/* FORMAT GUIDE */}
                            <Box sx={{ p: 1.5, bgcolor: '#1e293b', borderRadius: 2, border: '1px dashed #475569', display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 'bold' }}>REQUIRED COLUMNS:</Typography>
                                <Box display="flex" gap={1}>
                                    {['Name', 'Phone', 'Seat'].map((col) => (
                                        <Chip key={col} label={col} size="small" sx={{ bgcolor: '#334155', color: '#fff', borderRadius: 1, fontSize: '0.7rem' }} />
                                    ))}
                                </Box>
                            </Box>
                            {uploadStatus && <Typography variant="caption" sx={{ color: '#10b981', mt: 1, display: 'block' }}>{uploadStatus}</Typography>}
                        </Paper>

                        <FaceCapture />
                        <Box mt={4}><GuestList /></Box>
                    </Box>
                </Fade>
            )}

            {/* --- MODULE 2: BULK SENDER --- */}
            {currentModule === "bulk" && <BulkSender onBack={() => setCurrentModule('menu')} />}

        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;