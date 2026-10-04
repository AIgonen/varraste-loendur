import { useState } from 'react'
import { supabase } from './lib/supabase'

// Sisselogimine: e-post + PIN-parool. Kasutajad luuakse Supabase'i paneelis (Authentication → Users).
export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('vl_email') ?? '')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pin })
    setBusy(false)
    if (error) { setError('Vale e-post või PIN. Kontrolli ja proovi uuesti.'); return }
    localStorage.setItem('vl_email', email.trim())   // järgmisel korral on e-post ette täidetud
  }

  return (
    <div className="wrap">
      <h1>Varraste Loendur</h1>
      <form onSubmit={onSubmit} className="login">
        <label>E-post
          <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label>PIN
          <input type="password" inputMode="numeric" autoComplete="current-password" required value={pin} onChange={e => setPin(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Sisenen…' : 'Logi sisse'}</button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  )
}
