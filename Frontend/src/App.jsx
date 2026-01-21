import React, { useState } from 'react';
import { Container, CssBaseline, Box, Paper, Typography, Divider, Alert, Button, TextField } from '@mui/material';
import FaceCapture from './components/faceCapture';
import GuestList from './components/guestList';

function App() {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");

  // --- APP STATE ---
  const [excelFile, setExcelFile] = useState(null);
  const [status, setStatus] = useState("");

  // 👇 LOGIN FUNCTION
  const handleLogin = () => {
    // CHANGE THIS PASSWORD TO WHATEVER YOU WANT
    if (passwordInput === "admin123") {
      setIsAuthenticated(true);
    } else {
      setError("Incorrect Password");
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      setStatus("Please select an Excel file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", excelFile);

    try {
      setStatus("Uploading and enrolling faces...");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload-excel`, {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" },
        body: formData,
      });
      const data = await res.json();
      setStatus(data.status || "Enrollment complete!");
      
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setStatus("Error during enrollment. Make sure Node.js is running.");
    }
  };

  // 🔒 LOCK SCREEN VIEW (If not logged in)
  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#f0f2f5' }}>
        <CssBaseline />
        <Paper elevation={4} sx={{ p: 5, borderRadius: 3, textAlign: 'center', minWidth: 300 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom color="primary">
            🔒 Admin Access
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Enter password to manage event
          </Typography>
          
          <TextField 
            fullWidth 
            type="password" 
            label="Password" 
            variant="outlined" 
            value={passwordInput}
            onChange={(e) => {
                setPasswordInput(e.target.value);
                setError(""); // Clear error when typing
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            sx={{ mb: 2 }}
          />
          
          <Button variant="contained" fullWidth size="large" onClick={handleLogin}>
            Login
          </Button>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Paper>
      </Box>
    );
  }

  // 🔓 MAIN APP VIEW (If logged in)
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h4" align="center" color="primary" fontWeight="bold">
              Smart Event Manager
            </Typography>
            {/* LOGOUT BUTTON */}
            <Button color="inherit" onClick={() => setIsAuthenticated(false)}>Logout</Button>
          </Box>

          {/* ADMIN ENROLLMENT */}
          <Box sx={{ mb: 4, p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>Step 1: Admin Enrollment</Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <input type="file" accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files[0])} style={{ flexGrow: 1 }} />
              <Button variant="contained" color="secondary" onClick={handleExcelUpload}>Enroll Guests</Button>
            </Box>
            {status && <Alert sx={{ mt: 2 }} severity={status.includes("Error") ? "error" : "info"}>{status}</Alert>}
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* LIVE RECOGNITION */}
          <Box mb={4}>
            <Typography variant="h6" align="center" gutterBottom>Step 2: Guest Recognition</Typography>
            <FaceCapture />
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* GUEST LIST VIEW */}
          <GuestList />
          
        </Paper>
      </Container>
    </Box>
  );
}

export default App;