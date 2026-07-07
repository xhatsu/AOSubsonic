import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { polyfill } from 'mobile-drag-drop'
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour'
import 'mobile-drag-drop/default.css'

// Polyfill HTML5 drag and drop for mobile touch devices
polyfill({
  dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
  holdToDrag: 300 // 300ms long press to start drag
})

window.addEventListener('touchmove', function() {}, {passive: false})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
