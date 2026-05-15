import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './providers/AppProvider.tsx'
import { ClusterFiDynamicProvider } from './providers/DynamicProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClusterFiDynamicProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ClusterFiDynamicProvider>
  </StrictMode>,
)
