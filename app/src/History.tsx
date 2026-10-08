import { useEffect, useState } from 'react'
import { myCounts, photoUrl, reportError, type HistoryRow } from './lib/supabase'

// Minu viimased loendused. Rea puudutus näitab fotot (privaatne bucket → ajutine allkirjastatud link).
export default function History() {
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<{ id: string; url: string | null } | null>(null)

  async function load() {
    setError('')
    try { setRows(await myCounts(20)) }
    catch (err) { setError(`Ajaloo laadimine ebaõnnestus: ${reportError('ajalugu', err)}`) }
  }
  useEffect(() => { load() }, [])

  async function toggle(r: HistoryRow) {
    if (open?.id === r.id) { setOpen(null); return }
    setOpen({ id: r.id, url: null })
    try { const url = await photoUrl(r.photo_path); setOpen(o => o?.id === r.id ? { id: r.id, url } : o) }
    catch (err) { setError(`Foto avamine ebaõnnestus: ${reportError('ajaloo foto', err)}`); setOpen(null) }
  }

  if (error) return <><div className="error">{error}</div><button className="btn sec" onClick={load}>Proovi uuesti</button></>
  if (!rows) return <div className="status">Laen…</div>
  if (!rows.length) return <div className="status">Sul pole veel ühtegi loendust.</div>

  return (
    <>
      <div className="status">Viimased {rows.length} loendust · puuduta rida, et näha fotot</div>
      <table className="hist">
        <thead><tr><th>Aeg</th><th>Kimp</th><th className="num">Mudel</th><th className="num">Kinnitatud</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <Row key={r.id} r={r} open={open?.id === r.id ? open.url : undefined} onClick={() => toggle(r)} />
          ))}
        </tbody>
      </table>
    </>
  )
}

function Row({ r, open, onClick }: { r: HistoryRow; open: string | null | undefined; onClick: () => void }) {
  const diff = r.final_count == null ? null : r.final_count - r.predicted_count
  return (
    <>
      <tr onClick={onClick} className={open !== undefined ? 'sel' : ''}>
        <td>{when(r.created_at)}</td>
        <td>{r.bundle?.code ?? '–'}</td>
        <td className="num">{r.predicted_count}</td>
        <td className="num">
          {r.final_count == null ? <span className="muted">kinnitamata</span>
            : <>{r.final_count}{diff ? <span className="muted"> ({diff > 0 ? '+' : ''}{diff})</span> : null}
                {r.manual_count != null && <span className={r.manual_count === r.final_count ? 'ok' : 'warn-t'} title={`Käsitsi: ${r.manual_count}`}> ✋{r.manual_count}</span>}</>}
        </td>
      </tr>
      {open !== undefined && (
        <tr className="photo"><td colSpan={4}>
          {open ? <img src={open} alt="Loenduse foto" /> : <div className="status">Laen fotot…</div>}
          <div className="muted small">Mudel: {r.model_tag}{r.manual_count != null ? ` · käsitsi loetud: ${r.manual_count}` : ''}</div>
        </td></tr>
      )}
    </>
  )
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('et-EE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
