import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ServerProvider } from './contexts/ServerContext'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ServerProvider>
      <App />
    </ServerProvider>
  </React.StrictMode>
)
