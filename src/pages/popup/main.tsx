import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { runtimeAdapter } from '../../chrome/runtimeAdapter'
import { MESSAGE_VERSION } from '../../types/messages'
import '../shared.css'

export function Popup() {
  const [opening, setOpening] = useState(false)

  const openManager = async () => {
    setOpening(true)
    await runtimeAdapter.send({ version: MESSAGE_VERSION, type: 'OPEN_MANAGER' })
    window.close()
  }

  return (
    <main className="shell" style={{ width: 360, padding: 20 }}>
      <section className="card">
        <span className="eyebrow">Bookmark Tidy</span>
        <h1>A cleaner library, safely.</h1>
        <p>Analyze first, review every change, and keep an undo path.</p>
        <button type="button" onClick={openManager} disabled={opening}>
          {opening ? 'Opening…' : 'Open manager'}
        </button>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><Popup /></StrictMode>,
)
