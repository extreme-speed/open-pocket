import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import DeckSelect from './ui/routes/DeckSelect'
import Battle from './ui/routes/Battle'
import Replay from './ui/routes/Replay'

const router = createBrowserRouter([
  { path: '/', element: <DeckSelect /> },
  { path: '/game', element: <Battle /> },
  { path: '/replay', element: <Replay /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
