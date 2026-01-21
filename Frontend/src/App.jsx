import React, { useState } from 'react';
import { Container, CssBaseline, Box, Paper, Typography, Divider, Alert, Button, TextField, ThemeProvider, createTheme, Fade, IconButton } from '@mui/material';
import FaceCapture from './components/faceCapture';
import GuestList from './components/guestList';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LogoutIcon from '@mui/icons-material/Logout';
import LockIcon from '@mui/icons-material/Lock';

// 🌑 TECH DARK THEME
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6' }, // Electric Blue
    secondary: { main: '#a855f7' }, // Neon Purple
    background: { default: '#0f172a', paper: '#1e293b' },
    text: { primary: '#f1f5f9', secondary: '#94a3b8' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.875rem' },
    button: { fontWeight: 600, textTransform: 'none' }
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid rgba(148, 163, 184, 0.1)' } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiTextField: { styleOverrides: { root: { '& .MuiOutlinedInput-root': { backgroundColor: 'rgba(0,0,0,0.2)' } } } }
  }
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");
  const [excelFile, setExcelFile] = useState(null);
  const [status, setStatus] = useState("");

  const handleLogin = () => {
    if (passwordInput === "admin123") setIsAuthenticated(true);
    else setError("ACCESS DENIED");
  };

  const handleExcelUpload = async () => {
    if (!excelFile) { setStatus("Select file first."); return; }
    const formData = new FormData();
    formData.append("file", excelFile);
    try {
      setStatus("INITIALIZING UPLOAD...");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload-excel`, {
        method: "POST", headers: { "ngrok-skip-browser-warning": "true" }, body: formData,
      });
      const data = await res.json();
      setStatus(data.status || "DATABASE UPDATED");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) { setStatus("CONNECTION ERROR"); }
  };

  // 🔒 LOGIN TERMINAL
  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0f172a' }}>
          <Paper elevation={0} sx={{ p: 5, width: 380, textAlign: 'center', border: '1px solid #334155', bgcolor: '#1e293b' }}>
            <Box sx={{ mb: 3, display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <LockIcon />
            </Box>
            <Typography variant="h5" color="white" gutterBottom>SYSTEM ACCESS</Typography>
            <Typography variant="body2" color="textSecondary" mb={4} sx={{ fontFamily: 'monospace' }}>SECURE GATEWAY v2.0</Typography>
            
            <TextField fullWidth type="password" placeholder="ENTER PASSCODE" variant="outlined" 
              value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setError(""); }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()} sx={{ mb: 3 }}
            />
            
            <Button variant="contained" fullWidth size="large" onClick={handleLogin} sx={{ py: 1.5, bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}>
              AUTHENTICATE
            </Button>
            {error && <Alert severity="error" variant="outlined" sx={{ mt: 3, color: '#ef4444', borderColor: '#ef4444' }}>{error}</Alert>}
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  // 🔓 MAIN DASHBOARD
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: '#0f172a', pb: 5 }}>
        
        {/* TOP BAR */}
        <Box sx={{ borderBottom: '1px solid #334155', bgcolor: '#1e293b', py: 2, px: {xs: 2, md: 4}, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box display="flex" alignItems="center" gap={1}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                <Typography variant="h6" sx={{ color: '#fff', letterSpacing: 1 }}>EVENT MANAGER <span style={{opacity:0.5}}>| PRO</span></Typography>
            </Box>
            <Button startIcon={<LogoutIcon />} color="inherit" onClick={() => setIsAuthenticated(false)} sx={{ opacity: 0.7 }}>LOGOUT</Button>
        </Box>

        <Container maxWidth="md" sx={{ mt: 5 }}>
            <Fade in={true}>
                <Box>
                    {/* SECTION 1: DATABASE UPLOAD */}
                    <Paper sx={{ p: 3, mb: 4, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', borderLeft: '4px solid #3b82f6' }}>
                        <Box flexGrow={1}>
                            <Typography variant="h6" color="primary" gutterBottom>DATA IMPORT</Typography>
                            <Typography variant="body2" color="textSecondary">Upload .xlsx guest manifest to update local database.</Typography>
                        </Box>
                        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ borderColor: '#475569', color: '#94a3b8', '&:hover': { borderColor: '#fff', color: '#fff' } }}>
                            {excelFile ? excelFile.name : "SELECT FILE"}
                            <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files[0])} />
                        </Button>
                        <Button variant="contained" onClick={handleExcelUpload} disabled={!excelFile}>UPDATE DB</Button>
                        {status && <Typography variant="caption" sx={{ width: '100%', mt: 1, color: status.includes("Error") ? '#ef4444' : '#10b981' }}>{`> ${status}`}</Typography>}
                    </Paper>

                    {/* SECTION 2: SCANNER */}
                    <Box mb={4}>
                        <FaceCapture />
                    </Box>

                    {/* SECTION 3: LIST */}
                    <GuestList />
                </Box>
            </Fade>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;