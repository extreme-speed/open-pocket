import { Navigate } from 'react-router-dom'
import { useGame } from '../store'
import Board from '../components/Board'

export default function Battle() {
  const hasGame = useGame((s) => s.state !== null)
  if (!hasGame) return <Navigate to="/" replace />

  return <Board />
}
