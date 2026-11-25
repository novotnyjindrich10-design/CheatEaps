import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts/local.css'
import './index.css'
import App from './App.jsx'

// Business stránky mají vlastní CSS — nenačítej ho v kritické cestě úvodu.
void import('./business.css')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
