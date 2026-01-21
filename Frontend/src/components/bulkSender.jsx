import React, { useState } from 'react';
import { Box, Paper, Typography, Button, LinearProgress, Alert, Fade } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import TerminalIcon from '@mui/icons-material/Terminal';

export default function BulkSender({ onBack }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);

    const handleBlast = async () => {
        if (!file) return;
        setLoading(true);
        setReport(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/send-bulk`, {
                method: "POST",
                headers: { "ngrok-skip-browser-warning": "true" },
                body: formData
            });
            const data = await res.json();
            setReport(data);
        } catch (err) {
            setReport({ status: "error", message: "Server Connection Failed" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Fade in={true}>
            <Box>
                <Button onClick={onBack} sx={{ mb: 2, color: '#94a3b8' }}>&larr; RETURN TO MODULES</Button>
                
                <Paper sx={{ p: 4, bgcolor: '#0f172a', border: '1px solid #334155', position: 'relative', overflow: 'hidden' }}>
                    <Box display="flex" alignItems="center" gap={2} mb={3}>
                        <Box p={1} bgcolor="rgba(16, 185, 129, 0.1)" borderRadius="50%" color="#10b981"><TerminalIcon /></Box>
                        <Box>
                            <Typography variant="h6" color="white">DIRECT BROADCAST PROTOCOL</Typography>
                            <Typography variant="body2" color="textSecondary">Mass messaging for non-biometric guests.</Typography>
                        </Box>
                    </Box>

                    {/* UPLOAD AREA */}
                    <Box sx={{ border: '2px dashed #334155', borderRadius: 2, p: 4, textAlign: 'center', mb: 3, bgcolor: '#1e293b' }}>
                        <Button component="label" startIcon={<UploadFileIcon />} sx={{ color: '#fff', fontSize: '1.1rem' }}>
                            {file ? file.name : "SELECT TARGET LIST (.xlsx)"}
                            <input type="file" hidden accept=".xlsx, .xls" onChange={(e) => setFile(e.target.files[0])} />
                        </Button>
                    </Box>

                    {loading && <LinearProgress sx={{ mb: 3, bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />}

                    <Button 
                        fullWidth variant="contained" size="large" onClick={handleBlast} disabled={!file || loading}
                        startIcon={<SendIcon />}
                        sx={{ 
                            bgcolor: '#10b981', py: 2, fontWeight: 'bold', letterSpacing: 1,
                            '&:hover': { bgcolor: '#059669' },
                            '&:disabled': { bgcolor: '#334155', color: '#64748b' }
                        }}
                    >
                        {loading ? "TRANSMITTING..." : "INITIATE BROADCAST"}
                    </Button>

                    {/* REPORT CARD */}
                    {report && (
                        <Box mt={3}>
                            {report.status === 'success' ? (
                                <Alert severity="success" variant="outlined" sx={{ color: '#10b981', borderColor: '#10b981' }}>
                                    <strong>MISSION COMPLETE</strong><br/>
                                    Targeted: {report.total}<br/>
                                    Delivered: {report.sent}<br/>
                                    Failed: {report.failed}
                                </Alert>
                            ) : (
                                <Alert severity="error" variant="outlined">{report.message || "Operation Failed"}</Alert>
                            )}
                        </Box>
                    )}
                </Paper>
            </Box>
        </Fade>
    );
}