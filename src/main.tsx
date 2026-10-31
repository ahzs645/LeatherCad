import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/styles/index.scss'
import App from './app/App.tsx'
import { initializeEditorCloudAuth } from './features/editor/localdb/initialize-editor-cloud-auth'

// Configured sign-in resumes independently so an unavailable identity provider
// cannot prevent local drafting. The cloud store announces its ready state.
void initializeEditorCloudAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
