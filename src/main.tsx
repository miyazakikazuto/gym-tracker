import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import ErrorBoundary, { installGlobalErrorFallback } from './components/ErrorBoundary.tsx'

installGlobalErrorFallback()
window.__GT_BOOTED = true

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)