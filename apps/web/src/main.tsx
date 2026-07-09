import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'
import App from './App'
import './index.css'
import './lib/i18n'  // must be imported before App renders

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
