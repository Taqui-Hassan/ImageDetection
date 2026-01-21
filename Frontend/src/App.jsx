import React, { useState } from 'react';
import { Container, CssBaseline, Box, Paper, Typography, Divider, Alert, Button } from '@mui/material';
import FaceCapture from './components/faceCapture';
import GuestList from './components/guestList';

function App() {
  const [excelFile, setExcelFile] = useState(null);
  const [status, setStatus] = useState("");

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
        headers:{
            "ngrok-skip-browser-warning": "true"
        },
        body: formData,
      });
      const data = await res.json();
      setStatus(data.status || "Enrollment complete!");
      
      // Refresh to update GuestList
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      setStatus("Error during enrollment. Make sure Node.js is running.");
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" align="center" gutterBottom color="primary" fontWeight="bold">
            Smart Event Manager
          </Typography>

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