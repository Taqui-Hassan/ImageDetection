import React, { useState } from 'react';
import { Container, CssBaseline, Box, Paper, Typography, Divider, Alert, Button, TextField, ThemeProvider, createTheme, Fade } from '@mui/material';
import FaceCapture from './components/faceCapture';
import GuestList from './components/guestList';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import LogoutIcon from '@mui/icons-material/Logout';
import LockOpenIcon from '@mui/icons-material/LockOpen';

// ✨ CUSTOM THEME
const theme = createTheme({
  palette: {
    primary: { main: '#6366f1' }, // Modern Indigo
    secondary: { main: '#ec4899' }, // Pink/Magenta
    background: { default: '#f3f4f6' }
  },
  shape: { borderRadius: 16 }, // Softer corners everywhere
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, padding: '10px 20px' }
      }
    }
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
    else setError("Incorrect Password");
  };

  const handleExcelUpload = async () => {
    if (!excelFile) { setStatus("Please select an Excel file first."); return; }
    const formData = new FormData();
    formData.append("file", excelFile);
    try {
      setStatus("Uploading...");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload-excel`, {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" },
        body: formData,
      });
      const data = await res.json();
      setStatus(data.status || "Done!");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) { setStatus("Error. Is backend running?"); }
  };

  // 🔒 BEAUTIFUL LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={{ 
          height: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' // 💜 Purple Gradient
        }}>
          <CssBaseline />
          <Paper elevation={10} sx={{ p: 5, width: 350, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}>
            <Box sx={{ bgcolor: '#e0e7ff', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <LockOpenIcon color="primary" fontSize="large" />
            </Box>
            <Typography variant="h5" fontWeight="800" color="#333" gutterBottom>Welcome Back</Typography>
            <Typography variant="body2" color="textSecondary" mb={3}>Enter your credentials to access the Event Manager</Typography>
            
            <TextField fullWidth type="password" label="Admin Password" variant="outlined" 
              value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setError(""); }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()} sx={{ mb: 3 }}
            />
            
            <Button variant="contained" fullWidth size="large" onClick={handleLogin} sx={{ boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)' }}>
              Access Dashboard
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Paper>
        </Box>
      </ThemeProvider>
    );
  }

  // 🔓 MAIN DASHBOARD
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', pb: 5 }}>
        <CssBaseline />
        
        {/* HEADER */}
        <Box sx={{ bgcolor: '#fff', py: 2, px: 4, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" fontWeight="800" sx={{ background: '-webkit-linear-gradient(45deg, #6366f1, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Event Manager AI
            </Typography>
            <Button startIcon={<LogoutIcon />} color="error" onClick={() => setIsAuthenticated(false)}>Logout</Button>
        </Box>

        <Container maxWidth="md" sx={{ mt: 5 }}>
            <Fade in={true} timeout={800}>
                <Box>
                    {/* SECTION 1: UPLOAD */}
                    <Paper sx={{ p: 4, mb: 4, position: 'relative', overflow: 'hidden' }}>
                        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '6px', height: '100%', bgcolor: '#6366f1' }} />
                        <Typography variant="h6" fontWeight="bold" gutterBottom>📂 Import Guest List</Typography>
                        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ flexGrow: 1, py: 1.5, borderStyle: 'dashed' }}>
                                {excelFile ? excelFile.name : "Select Excel File"}
                                <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files[0])} />
                            </Button>
                            <Button variant="contained" onClick={handleExcelUpload} disabled={!excelFile} sx={{ px: 4 }}>
                                Upload
                            </Button>
                        </Box>
                        {status && <Alert sx={{ mt: 2 }} severity={status.includes("Error") ? "error" : "success"}>{status}</Alert>}
                    </Paper>

                    {/* SECTION 2: CAMERA */}
                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ ml: 1, color: '#64748b' }}>Live Scanner</Typography>
                    <FaceCapture />

                    <Divider sx={{ my: 6, opacity: 0.5 }}>OR</Divider>

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