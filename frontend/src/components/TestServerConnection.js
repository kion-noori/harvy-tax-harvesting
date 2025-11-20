import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function TestServerConnection() {
  const [status, setStatus] = useState('Testing...');
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Test the server connection using environment variable
    const testUrl = `${API_BASE}/test`;

    fetch(testUrl, {
      headers: { 'Accept': 'application/json' },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setStatus('✅ Server is running!');
        setResult({ ...data, apiBase: API_BASE });
      })
      .catch(err => {
        setStatus(`❌ Error: ${err.message}`);
        setResult({ error: err.message, attemptedUrl: testUrl });
      });
  }, []);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', margin: '20px' }}>
      <h2>Server Connection Test</h2>
      <p>Status: {status}</p>
      {result && (
        <div>
          <h3>Server Response:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      <p>
        If you see "Server is running!", your frontend can connect to your backend.
        If you see an error, your server might not be running or there might be a CORS issue.
      </p>
    </div>
  );
}

export default TestServerConnection; 