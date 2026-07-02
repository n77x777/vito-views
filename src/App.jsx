import { useState, useEffect, useMemo } from "react"
import { supabase } from "./supabase.js"
import { Plus, Trash2, X, ChevronDown, ChevronUp, LogOut, Shield, TrendingUp, Search, ArrowLeft, Wallet, User, Save, CheckCircle, Clock, Link, BarChart2, Film } from "lucide-react"

const C = {
  bg: "#04040C", surface: "#08081A", card: "#0C0C1E", border: "#161632",
  blue: "#1A3FC4", blueGlow: "#2451D8", silver: "#9BAAC2", silverHi: "#C8D4E8",
  white: "#EEF1F7", green: "#3BE8A0", red: "#F05050", gold: "#C8A84B",
}

const PLATFORMS = {
  tiktok:    { label: "TikTok",    color: "#4A9EFF" },
  instagram: { label: "Instagram", color: "#B06CDE" },
}

const fmt     = (n) => { n=n??0; if(n>=1e6) return(n/1e6).toFixed(1).replace(/\.0$/,"")+"M"; if(n>=1e3) return(n/1e3).toFixed(1).replace(/\.0$/,"")+"K"; return String(n) }
const eur     = (n) => "€ "+(n??0).toFixed(0)
const today   = () => new Date().toISOString().slice(0,10)
const payout  = (v) => v<3000 ? 0 : 3+Math.floor((v-3000)/1000)
const latestV = (post) => { const e=[...(post.view_entries||[])].sort((a,b)=>a.date.localeCompare(b.date)); return e.length?e.at(-1).views:0 }
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—"

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.white};font-family:'Inter',sans-serif}
  input,button{font-family:inherit}
  input::placeholder{color:${C.silver}55}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-thumb{background:${C.blue};border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
`

const INPUT = { width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:14, padding:"11px 14px", outline:"none", marginBottom:8 }

const Pill = ({ label, active, color, onClick }) => (
  <button onClick={onClick} style={{ flex:"0 0 auto", padding:"6px 14px", borderRadius:999, fontSize:12, fontWeight:600, border:`1px solid ${active?color:C.border}`, background:active?color+"18":"transparent", color:active?color:C.silver, cursor:"pointer" }}>{label}</button>
)

const KPI = ({ label, value, sub, accent, wide }) => (
  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderTop:`2px solid ${accent||C.blue}`, borderRadius:10, padding:"14px 16px", ...(wide ? { gridColumn:"span 2" } : {}) }}>
    <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:22, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", color:C.white }}>{value}</div>
    {sub&&<div style={{ fontSize:11, color:C.silver, marginTop:3 }}>{sub}</div>}
  </div>
)

export default function App() {
  const [session,     setSession]     = useState(null)
  const [profile,     setProfile]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [screen,      setScreen]      = useState("auth")
  const [authMode,    setAuthMode]    = useState("login")
  const [form,        setForm]        = useState({ email:"", password:"", username:"", wallet:"", profile_link:"" })
  const [authErr,     setAuthErr]     = useState("")
  const [posts,       setPosts]       = useState([])
  const [myPayouts,   setMyPayouts]   = useState([])
  const [tab,         setTab]         = useState("dashboard")
  const [showAdd,     setShowAdd]     = useState(false)
  const [expanded,    setExpanded]    = useState(null)
  const [filter,      setFilter]      = useState("all")
  const [draft,       setDraft]       = useState({ platform:"tiktok", title:"", url:"", views:"" })
  const [rowDrafts,   setRowDrafts]   = useState({})
  const [board,       setBoard]       = useState(null)
  const [admins,      setAdmins]      = useState(null)
  const [allUsers,    setAllUsers]    = useState(null)
  const [search,      setSearch]      = useState("")
  const [selUser,     setSelUser]     = useState(null)
  const [busy,        setBusy]        = useState(false)
  const [payoutBusy,  setPayoutBusy]  = useState(false)
  const [profileForm, setProfileForm] = useState({ username:"", wallet:"", profile_link:"", newPassword:"" })
  const [profileMsg,  setProfileMsg]  = useState("")
  const [payoutNote,  setPayoutNote]  = useState("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false); setScreen("auth") }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single()
    setProfile(data)
    setProfileForm({ username:data?.username||"", wallet:data?.wallet||"", profile_link:data?.profile_link||"", newPassword:"" })
    setLoading(false); setScreen("app")
    setTab("dashboard")
    fetchPosts(userId, data?.is_admin)
    if (!data?.is_admin) fetchMyPayouts(userId)
  }

  const fetchMyPayouts = async (userId) => {
    const { data } = await supabase.from("payouts").select("*").eq("user_id", userId).order("paid_at", { ascending:false })
    setMyPayouts(data||[])
  }

  const handleAuth = async () => {
    setAuthErr(""); setBusy(true)
    try {
      if (authMode==="signup") {
        if (!form.username.trim()||!form.wallet.trim()||!form.profile_link.trim()) { setAuthErr("Bitte alle Felder ausfüllen."); return }
        const { data, error } = await supabase.auth.signUp({ email:form.email, password:form.password })
        if (error) { setAuthErr(error.message); return }
        if (data.user) {
          await supabase.from("profiles").insert({ id:data.user.id, username:form.username.trim().toLowerCase(), wallet:form.wallet.trim(), profile_link:form.profile_link.trim() })
        }
        setAuthErr("Bitte bestätige deine E-Mail, dann kannst du dich einloggen.")
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email:form.email, password:form.password })
        if (error) setAuthErr("E-Mail oder Passwort falsch.")
      }
    } finally { setBusy(false) }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setPosts([]); setBoard(null); setAllUsers(null); setAdmins(null); setSelUser(null); setMyPayouts([])
    setForm({ email:"", password:"", username:"", wallet:"", profile_link:"" })
  }

  const saveProfile = async () => {
    setBusy(true); setProfileMsg("")
    try {
      const { error } = await supabase.from("profiles").update({ username:profileForm.username.trim(), wallet:profileForm.wallet.trim(), profile_link:profileForm.profile_link.trim() }).eq("id", session.user.id)
      if (error) { setProfileMsg("Fehler: "+error.message); return }
      if (profileForm.newPassword) {
        const { error: pwErr } = await supabase.auth.updateUser({ password:profileForm.newPassword })
        if (pwErr) { setProfileMsg("Profil gespeichert, Passwort-Fehler: "+pwErr.message); return }
      }
      await fetchProfile(session.user.id)
      setProfileMsg("Gespeichert ✓")
    } finally { setBusy(false) }
  }

  const fetchPosts = async (userId, isAdm) => {
    let query = supabase.from("posts").select("*, view_entries(*), profiles(username, is_admin)")
    if (!isAdm) query = query.eq("user_id", userId)
    const { data } = await query.order("created_at", { ascending:false })
    setPosts(data||[])
  }

  useEffect(() => {
    if (session && profile !== null) fetchPosts(session.user.id, profile?.is_admin)
  }, [profile?.is_admin])

  const addPost = async () => {
    if (!draft.title.trim()||!session) return
    setBusy(true)
    const { data: post } = await supabase.from("posts").insert({ user_id:session.user.id, platform:draft.platform, title:draft.title.trim(), url:draft.url.trim() }).select().single()
    if (post) {
      const views = parseInt(draft.views.replace(/\D/g,""),10)||0
      await supabase.from("view_entries").insert({ post_id:post.id, date:today(), views })
      await fetchPosts(session.user.id, profile?.is_admin)
    }
    setDraft({ platform:"tiktok", title:"", url:"", views:"" }); setShowAdd(false); setBusy(false)
  }

  const addEntry = async (postId) => {
    const d = rowDrafts[postId]
    if (!d?.views) return
    const views = parseInt(String(d.views).replace(/\D/g,""),10)||0
    await supabase.from("view_entries").upsert({ post_id:postId, date:d.date||today(), views }, { onConflict:"post_id,date" })
    await fetchPosts(session.user.id, profile?.is_admin)
    setRowDrafts((r)=>({...r,[postId]:{ date:today(), views:"" }}))
  }

  const delPost  = async (id) => { await supabase.from("posts").delete().eq("id",id); setPosts((p)=>p.filter((x)=>x.id!==id)); if(expanded===id) setExpanded(null) }
  const delEntry = async (entryId) => { await supabase.from("view_entries").delete().eq("id",entryId); await fetchPosts(session?.user?.id, profile?.is_admin) }

  const calcOpenEarnings = (userPosts, lastPayoutDate) => {
    let total = 0
    userPosts?.forEach((p) => {
      const entries = [...(p.view_entries||[])].sort((a,b)=>a.date.localeCompare(b.date))
      const currentViews = entries.length ? entries.at(-1).views : 0
      const baseViews = lastPayoutDate ? (entries.filter((e)=>e.date<=lastPayoutDate).at(-1)?.views||0) : 0
      total += Math.max(0, payout(currentViews)-payout(baseViews))
    })
    return total
  }

  const calcTotalEarnings = (userPosts) => { let t=0; userPosts?.forEach((p)=>{ t+=payout(latestV(p)) }); return t }

  const executePayout = async (user) => {
    const amount = user.openEarnings
    if (amount<=0) return
    if (!window.confirm(`Payout für ${user.username}?\nBetrag: ${eur(amount)}\nWallet: ${user.wallet||"—"}`)) return
    setPayoutBusy(true)
    try {
      const { error } = await supabase.from("payouts").insert({ user_id:user.id, amount, note:payoutNote||null, paid_at:new Date().toISOString() })
      if (error) { alert("Fehler: "+error.message); return }
      setPayoutNote(""); setSelUser(null); await loadAllUsers()
    } finally { setPayoutBusy(false) }
  }

  const isAdmin = profile?.is_admin
  const myPosts = useMemo(() => posts.filter((p)=>p.user_id===session?.user?.id), [posts, session])

  // User Dashboard Stats
  const userStats = useMemo(() => {
    const lastPayout = myPayouts.length ? myPayouts[0] : null
    const lastPayoutDate = lastPayout?.paid_at?.slice(0,10)||null
    const totalEarnings = calcTotalEarnings(myPosts)
    const openEarnings  = calcOpenEarnings(myPosts, lastPayoutDate)
    const totalPaid     = myPayouts.reduce((s,p)=>s+p.amount,0)
    const totalViews    = myPosts.reduce((s,p)=>s+latestV(p),0)
    const over3k        = myPosts.filter((p)=>latestV(p)>=3000).length
    const byP           = { tiktok:0, instagram:0 }
    myPosts.forEach((p)=>{ byP[p.platform]=(byP[p.platform]||0)+latestV(p) })
    return { totalEarnings, openEarnings, totalPaid, totalViews, over3k, lastPayout, byP }
  }, [myPosts, myPayouts])

  const filtered = useMemo(() => {
    const list = filter==="all" ? posts : posts.filter((p)=>p.platform===filter)
    return [...list].sort((a,b)=>latestV(b)-latestV(a))
  }, [posts, filter])

  const loadBoard = async () => {
    setBoard("loading")
    const { data } = await supabase.from("profiles").select("username, is_admin, posts(*, view_entries(*))")
    const rows = (data||[]).map((u) => { let v=0,e=0; u.posts?.forEach((p)=>{ const lv=latestV(p); v+=lv; e+=payout(lv) }); return { username:u.username, is_admin:u.is_admin, views:v, earnings:e, count:u.posts?.length||0 } }).sort((a,b)=>b.earnings-a.earnings)
    setBoard(rows)
  }

  const loadAdmins = async () => {
    setAdmins("loading")
    const { data } = await supabase.from("profiles").select("username, profile_link, created_at").eq("is_admin",true)
    setAdmins(data||[])
  }

  const loadAllUsers = async () => {
    setAllUsers("loading")
    const { data: usersData } = await supabase.from("profiles").select("*, posts(*, view_entries(*))")
    const { data: payoutsData } = await supabase.from("payouts").select("*").order("paid_at",{ ascending:false })
    const rows = (usersData||[]).map((u) => {
      let v=0; const byP={ tiktok:0, instagram:0 }
      u.posts?.forEach((p)=>{ const lv=latestV(p); v+=lv; byP[p.platform]=(byP[p.platform]||0)+lv })
      const userPayouts = (payoutsData||[]).filter((p)=>p.user_id===u.id).sort((a,b)=>b.paid_at.localeCompare(a.paid_at))
      const lastPayout = userPayouts[0]||null
      const lastPayoutDate = lastPayout?.paid_at?.slice(0,10)||null
      const totalEarnings = calcTotalEarnings(u.posts)
      const openEarnings  = calcOpenEarnings(u.posts, lastPayoutDate)
      const totalPaid     = userPayouts.reduce((s,p)=>s+p.amount,0)
      return { ...u, views:v, byP, totalEarnings, openEarnings, totalPaid, lastPayout, userPayouts }
    }).sort((a,b)=>b.openEarnings-a.openEarnings)
    setAllUsers(rows)
  }

  useEffect(() => {
    if (tab==="board")     loadBoard()
    if (tab==="admins")    loadAdmins()
    if (tab==="dashboard"&&isAdmin) loadAllUsers()
  }, [tab])

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(allUsers)) return []
    if (!search.trim()) return allUsers
    return allUsers.filter((u)=>u.username.toLowerCase().includes(search.toLowerCase()))
  }, [allUsers, search])

  const adminTotals = useMemo(() => {
    if (!Array.isArray(allUsers)) return { totalUsers:0, totalPosts:0, totalViews:0, totalOpen:0, totalPaid:0 }
    return { totalUsers:allUsers.length, totalPosts:allUsers.reduce((s,u)=>s+(u.posts?.length||0),0), totalViews:allUsers.reduce((s,u)=>s+u.views,0), totalOpen:allUsers.reduce((s,u)=>s+u.openEarnings,0), totalPaid:allUsers.reduce((s,u)=>s+u.totalPaid,0) }
  }, [allUsers])

  if (loading) return <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}><style>{css}</style><div style={{ color:C.silver }}>Lädt…</div></div>

  // ── AUTH ──
  if (screen==="auth") return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.white, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", padding:24 }}>
      <style>{css}</style>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.blueGlow})`, display:"flex", alignItems:"center", justifyContent:"center" }}><TrendingUp size={18} color="#fff"/></div>
          <span style={{ fontSize:24, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>Vito <span style={{ color:C.blueGlow }}>Views</span></span>
        </div>
        <div style={{ fontSize:13, color:C.silver }}>Ab 3.000 Views · 1 € pro 1.000 Views</div>
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:24, width:"100%", maxWidth:360, animation:"fadeUp .3s ease" }}>
        <div style={{ display:"flex", gap:4, marginBottom:20, background:C.surface, borderRadius:10, padding:4 }}>
          {["login","signup"].map((m)=>(
            <button key={m} onClick={()=>{setAuthMode(m);setAuthErr("")}} style={{ flex:1, padding:"9px 0", borderRadius:7, fontSize:13, fontWeight:600, border:"none", background:authMode===m?C.blue:"transparent", color:authMode===m?"#fff":C.silver, cursor:"pointer" }}>
              {m==="login"?"Anmelden":"Registrieren"}
            </button>
          ))}
        </div>
        {authMode==="signup"&&<>
          <input style={INPUT} placeholder="Benutzername (öffentlich)" value={form.username} onChange={(e)=>setForm((f)=>({...f,username:e.target.value}))}/>
          <div style={{ position:"relative" }}><Link size={13} color={C.silver} style={{ position:"absolute", left:12, top:13, pointerEvents:"none" }}/><input style={{ ...INPUT, paddingLeft:32 }} placeholder="TikTok / Instagram Profillink" value={form.profile_link} onChange={(e)=>setForm((f)=>({...f,profile_link:e.target.value}))}/></div>
          <div style={{ position:"relative" }}><Wallet size={13} color={C.silver} style={{ position:"absolute", left:12, top:13, pointerEvents:"none" }}/><input style={{ ...INPUT, paddingLeft:32 }} placeholder="Wallet-Adresse (für Auszahlung)" value={form.wallet} onChange={(e)=>setForm((f)=>({...f,wallet:e.target.value}))}/></div>
        </>}
        <input style={INPUT} type="email" placeholder="E-Mail" value={form.email} onChange={(e)=>setForm((f)=>({...f,email:e.target.value}))}/>
        <input style={{ ...INPUT, marginBottom:authErr?8:16 }} type="password" placeholder="Passwort" value={form.password} onChange={(e)=>setForm((f)=>({...f,password:e.target.value}))} onKeyDown={(e)=>e.key==="Enter"&&handleAuth()}/>
        {authErr&&<div style={{ fontSize:12.5, marginBottom:12, padding:"8px 12px", background:authErr.includes("bestätige")?C.blue+"20":C.red+"12", color:authErr.includes("bestätige")?C.silverHi:C.red, borderRadius:7 }}>{authErr}</div>}
        <button onClick={handleAuth} disabled={busy} style={{ width:"100%", background:`linear-gradient(135deg,${C.blue},${C.blueGlow})`, color:"#fff", border:"none", borderRadius:9, fontWeight:700, fontSize:14, padding:"13px 0", cursor:"pointer", opacity:busy?0.7:1, boxShadow:`0 4px 20px ${C.blue}40` }}>
          {busy?"…":authMode==="login"?"Einloggen":"Account erstellen"}
        </button>
      </div>
    </div>
  )

  // ── USER DETAIL (Admin klickt auf User) ──
  if (selUser) {
    const u = selUser
    return (
      <div style={{ minHeight:"100vh", background:C.bg, color:C.white, paddingBottom:60 }}>
        <style>{css}</style>
        <div style={{ padding:"0 18px", height:58, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, background:C.bg+"F0", backdropFilter:"blur(12px)", zIndex:30 }}>
          <button onClick={()=>setSelUser(null)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.silver, padding:"7px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:5, fontSize:12 }}><ArrowLeft size={14}/> Zurück</button>
          <span style={{ fontSize:15, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{u.username}</span>
          {u.is_admin&&<span style={{ fontSize:10, color:C.gold, fontWeight:700, display:"flex", alignItems:"center", gap:3 }}><Shield size={10}/>Admin</span>}
        </div>
        <div style={{ padding:"24px 18px 0" }}>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
            <KPI label="Offen" value={eur(u.openEarnings)} sub="seit letztem Payout" accent={C.green}/>
            <KPI label="Gesamt verdient" value={eur(u.totalEarnings)} accent={C.blueGlow}/>
            <KPI label="Bereits gezahlt" value={eur(u.totalPaid)} accent={C.silver}/>
            <KPI label="Views gesamt" value={fmt(u.views)} accent={C.silverHi}/>
          </div>

          {/* Wallet + Profillink */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6, display:"flex", alignItems:"center", gap:5 }}><Wallet size={11}/> Wallet</div>
            <div style={{ fontSize:13, color:C.white, wordBreak:"break-all", fontFamily:"monospace", marginBottom:12 }}>{u.wallet||"—"}</div>
            <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6, display:"flex", alignItems:"center", gap:5 }}><Link size={11}/> Profillink</div>
            {u.profile_link ? <a href={u.profile_link} target="_blank" rel="noreferrer" style={{ fontSize:13, color:C.blueGlow, wordBreak:"break-all" }}>{u.profile_link}</a> : <span style={{ fontSize:13, color:C.silver }}>—</span>}
          </div>

          {/* Letzter Payout */}
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}><Clock size={11}/> Letzter Payout</div>
            {u.lastPayout ? <div><div style={{ fontSize:16, fontWeight:700, color:C.green }}>{eur(u.lastPayout.amount)}</div><div style={{ fontSize:12, color:C.silver, marginTop:3 }}>{fmtDate(u.lastPayout.paid_at)}{u.lastPayout.note&&` · ${u.lastPayout.note}`}</div></div> : <div style={{ fontSize:13, color:C.silver }}>Noch kein Payout</div>}
          </div>

          {/* Payout Button */}
          {u.openEarnings>0&&(
            <div style={{ background:C.card, border:`1px solid ${C.green}40`, borderRadius:12, padding:"16px", marginBottom:12 }}>
              <div style={{ fontSize:10, color:C.green, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Payout ausführen</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ fontSize:13, color:C.silver }}>Offener Betrag</span>
                <span style={{ fontSize:22, fontWeight:800, fontFamily:"'Space Grotesk',sans-serif", color:C.green }}>{eur(u.openEarnings)}</span>
              </div>
              <input style={{ ...INPUT, marginBottom:10 }} placeholder="Notiz (optional)" value={payoutNote} onChange={(e)=>setPayoutNote(e.target.value)}/>
              <button onClick={()=>executePayout(u)} disabled={payoutBusy} style={{ width:"100%", background:payoutBusy?C.surface:`linear-gradient(135deg,#1a7a4a,${C.green})`, color:payoutBusy?C.silver:"#0B0B0F", border:"none", borderRadius:10, fontWeight:800, fontSize:14, padding:"13px 0", cursor:payoutBusy?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <CheckCircle size={16}/> {payoutBusy?"Verarbeitung…":`Payout ${eur(u.openEarnings)} bestätigen`}
              </button>
            </div>
          )}

          {/* Payout History */}
          {u.userPayouts?.length>0&&(
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Payout-History</div>
              {u.userPayouts.map((p)=>(
                <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div><div style={{ fontSize:13, fontWeight:600, color:C.green }}>{eur(p.amount)}</div><div style={{ fontSize:11.5, color:C.silver, marginTop:2 }}>{fmtDate(p.paid_at)}{p.note&&` · ${p.note}`}</div></div>
                  <CheckCircle size={16} color={C.green}/>
                </div>
              ))}
            </div>
          )}

          {/* Alle Posts */}
          <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Alle Einreichungen</div>
          {(!u.posts||u.posts.length===0)&&<div style={{ color:C.silver, fontSize:13 }}>Keine Posts.</div>}
          {[...(u.posts||[])].sort((a,b)=>latestV(b)-latestV(a)).map((p)=>{
            const plat=PLATFORMS[p.platform]; const lv=latestV(p); const earn=payout(lv)
            const sorted=[...(p.view_entries||[])].sort((a,b)=>a.date.localeCompare(b.date))
            return (
              <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${plat.color}`, borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <div style={{ fontSize:10, color:plat.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>{plat.label}</div>
                    <div style={{ fontSize:14, fontWeight:600, wordBreak:"break-word" }}>{p.title}</div>
                    {p.url&&<a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:C.blueGlow, display:"block", marginTop:3, wordBreak:"break-all" }}>{p.url}</a>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:17, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{fmt(lv)}</div>
                    <div style={{ fontSize:12, color:earn>0?C.green:C.silver, fontWeight:600 }}>{earn>0?eur(earn):"< 3K"}</div>
                  </div>
                </div>
                {sorted.length>1&&(
                  <div style={{ borderTop:`1px solid ${C.border}`, marginTop:10, paddingTop:10 }}>
                    {sorted.map((h,i)=>{ const pv=i>0?sorted[i-1].views:null; const d=pv!==null?h.views-pv:null; return (
                      <div key={h.id} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", fontSize:12, color:C.silver }}>
                        <span>{h.date}</span>
                        <span style={{ color:C.white }}>{fmt(h.views)}{d!==null&&d!==0&&<span style={{ color:d>0?C.green:C.red, marginLeft:6 }}>{d>0?"+":""}{fmt(d)}</span>}</span>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── TABS ──
  const TABS = [
    { id:"dashboard", label:"Dashboard" },
    { id:"posts",     label:"Meine Posts" },
    { id:"board",     label:"Rangliste" },
    { id:"admins",    label:"Admins" },
    { id:"profile",   label:"Profil" },
  ]

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.white, paddingBottom:100 }}>
      <style>{css}</style>

      {/* Topbar */}
      <div style={{ padding:"0 18px", height:58, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:C.bg+"F0", backdropFilter:"blur(12px)", zIndex:30 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:`linear-gradient(135deg,${C.blue},${C.blueGlow})`, display:"flex", alignItems:"center", justifyContent:"center" }}><TrendingUp size={14} color="#fff"/></div>
          <span style={{ fontSize:16, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>Vito <span style={{ color:C.blueGlow }}>Views</span></span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {isAdmin&&<span style={{ fontSize:10, color:C.gold, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:4 }}><Shield size={10}/>Admin</span>}
          <button onClick={logout} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.silver, padding:"7px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:5, fontSize:12 }}><LogOut size={13}/> Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", padding:"0 18px", borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
        {TABS.map((t)=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"12px 14px", background:"none", border:"none", borderBottom:`2px solid ${tab===t.id?C.blueGlow:"transparent"}`, color:tab===t.id?C.white:C.silver, fontWeight:tab===t.id?700:500, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>{t.label}</button>
        ))}
      </div>

      {/* ── DASHBOARD: USER ── */}
      {tab==="dashboard"&&!isAdmin&&(
        <div style={{ padding:"24px 18px 0" }}>
          <div style={{ fontSize:11, color:C.silver, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>Willkommen, {profile?.username}</div>
          <div style={{ fontSize:40, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", background:`linear-gradient(90deg,${C.white},${C.silverHi},${C.white})`, backgroundSize:"200% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"shimmer 4s linear infinite", marginBottom:4 }}>
            {eur(userStats.openEarnings)}
          </div>
          <div style={{ fontSize:13, color:C.silver, marginBottom:4 }}>Offen seit letztem Payout</div>
          {userStats.lastPayout&&<div style={{ fontSize:12, color:C.silver, marginBottom:20, display:"flex", alignItems:"center", gap:5 }}><CheckCircle size={12} color={C.green}/> Letzter Payout: {eur(userStats.lastPayout.amount)} am {fmtDate(userStats.lastPayout.paid_at)}</div>}
          {!userStats.lastPayout&&<div style={{ marginBottom:20 }}/>}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <KPI label="Gesamt verdient" value={eur(userStats.totalEarnings)} accent={C.blueGlow}/>
            <KPI label="Bereits ausgezahlt" value={eur(userStats.totalPaid)} accent={C.silver}/>
            <KPI label="Videos gepostet" value={myPosts.length} accent={C.silverHi}/>
            <KPI label="Über 3.000 Views" value={userStats.over3k} sub={`von ${myPosts.length} Videos`} accent={C.green}/>
            <KPI label="TikTok Views" value={fmt(userStats.byP.tiktok)} accent={PLATFORMS.tiktok.color}/>
            <KPI label="Instagram Views" value={fmt(userStats.byP.instagram)} accent={PLATFORMS.instagram.color}/>
          </div>

          {/* Alle Videos kurz */}
          {myPosts.length>0&&(
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Deine Videos</div>
              {[...myPosts].sort((a,b)=>latestV(b)-latestV(a)).map((p)=>{
                const plat=PLATFORMS[p.platform]; const lv=latestV(p); const earn=payout(lv)
                return (
                  <div key={p.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${plat.color}`, borderRadius:10, padding:"12px 14px", marginBottom:6, display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, color:plat.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:2 }}>{plat.label}</div>
                      <div style={{ fontSize:13.5, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:15, fontWeight:700 }}>{fmt(lv)}</div>
                      <div style={{ fontSize:11, color:earn>0?C.green:C.silver, fontWeight:600 }}>{earn>0?eur(earn):"< 3K"}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DASHBOARD: ADMIN ── */}
      {tab==="dashboard"&&isAdmin&&(
        <div style={{ padding:"24px 18px 0" }}>
          <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}><Shield size={11}/>Admin Dashboard</div>
          <div style={{ fontSize:28, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", marginBottom:20 }}>Plattform-Übersicht</div>

          {Array.isArray(allUsers)&&(
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                <KPI label="Nutzer gesamt" value={adminTotals.totalUsers} accent={C.silverHi}/>
                <KPI label="Posts gesamt" value={adminTotals.totalPosts} accent={C.silver}/>
                <KPI label="Views gesamt" value={fmt(adminTotals.totalViews)} accent={C.blueGlow}/>
                <KPI label="Bereits gezahlt" value={eur(adminTotals.totalPaid)} accent={C.silver}/>
              </div>
              <div style={{ background:C.card, border:`1px solid ${C.green}40`, borderRadius:10, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:10, color:C.green, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase" }}>Ausstehende Auszahlungen</div>
                  <div style={{ fontSize:11.5, color:C.silver, marginTop:2 }}>Summe aller offenen Beträge</div>
                </div>
                <div style={{ fontSize:26, fontWeight:800, fontFamily:"'Space Grotesk',sans-serif", color:C.green }}>{eur(adminTotals.totalOpen)}</div>
              </div>

              <div style={{ position:"relative", marginBottom:14 }}>
                <Search size={14} color={C.silver} style={{ position:"absolute", left:12, top:13, pointerEvents:"none" }}/>
                <input placeholder="Nutzer suchen…" value={search} onChange={(e)=>setSearch(e.target.value)} style={{ ...INPUT, paddingLeft:34, marginBottom:0 }}/>
              </div>

              {filteredUsers.map((row,i)=>(
                <div key={row.id} onClick={()=>setSelUser(row)}
                  style={{ background:C.card, border:`1px solid ${row.openEarnings>0?C.green+"40":C.border}`, borderRadius:12, marginBottom:8, padding:"14px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}
                  onMouseEnter={(e)=>e.currentTarget.style.borderColor=C.blueGlow}
                  onMouseLeave={(e)=>e.currentTarget.style.borderColor=row.openEarnings>0?C.green+"40":C.border}
                >
                  <div style={{ width:22, textAlign:"center", fontSize:12, fontWeight:800, color:i===0?C.gold:C.silver+"60", fontFamily:"'Space Grotesk',sans-serif", flexShrink:0 }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14.5, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                      {row.username}
                      {row.is_admin&&<span style={{ fontSize:10, color:C.gold, fontWeight:700, display:"flex", alignItems:"center", gap:2 }}><Shield size={9}/>Admin</span>}
                    </div>
                    <div style={{ fontSize:11.5, color:C.silver, marginTop:2 }}>{row.posts?.length||0} Posts · {fmt(row.views)} Views</div>
                    <div style={{ fontSize:11, color:C.silver+"70", marginTop:2, display:"flex", alignItems:"center", gap:4 }}>
                      <Wallet size={10}/> {row.wallet?(row.wallet.length>22?row.wallet.slice(0,22)+"…":row.wallet):"Keine Wallet"}
                    </div>
                    {row.lastPayout&&<div style={{ fontSize:11, color:C.silver, marginTop:2, display:"flex", alignItems:"center", gap:4 }}><Clock size={10}/> Letzter Payout: {fmtDate(row.lastPayout.paid_at)}</div>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:18, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", color:row.openEarnings>0?C.green:C.silver }}>{eur(row.openEarnings)}</div>
                    <div style={{ fontSize:10, color:C.silver, marginTop:2 }}>offen · Details →</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {allUsers==="loading"&&<div style={{ color:C.silver, fontSize:13 }}>Lädt…</div>}
        </div>
      )}

      {/* ── MEINE POSTS ── */}
      {tab==="posts"&&(
        <>
          <div style={{ display:"flex", gap:6, padding:"16px 18px 4px", overflowX:"auto" }}>
            <Pill label="Alle" active={filter==="all"} color={C.silverHi} onClick={()=>setFilter("all")}/>
            {Object.entries(PLATFORMS).map(([k,p])=><Pill key={k} label={p.label} active={filter===k} color={p.color} onClick={()=>setFilter(k)}/>)}
          </div>
          <div style={{ padding:"12px 18px 0" }}>
            {filtered.length===0&&<div style={{ textAlign:"center", padding:"70px 20px" }}><Film size={28} color={C.border} style={{ marginBottom:12 }}/><div style={{ color:C.silver, fontSize:14 }}>Noch keine Posts erfasst.</div></div>}
            {filtered.map((post)=>{
              const plat=PLATFORMS[post.platform]; const isOpen=expanded===post.id
              const entries=[...(post.view_entries||[])].sort((a,b)=>a.date.localeCompare(b.date))
              const last=entries.length?entries.at(-1).views:0; const earned=payout(last)
              const rd=rowDrafts[post.id]||{ date:today(), views:"" }
              const isOwnPost=post.user_id===session?.user?.id
              const ownerName=post.profiles?.username
              return (
                <div key={post.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, marginBottom:8, overflow:"hidden", animation:"fadeUp .2s ease" }}>
                  <div onClick={()=>setExpanded(isOpen?null:post.id)} style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
                    <div style={{ width:3, alignSelf:"stretch", borderRadius:2, background:plat.color, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, color:plat.color, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:1 }}>{plat.label}{isAdmin&&ownerName&&!isOwnPost&&<span style={{ color:C.silver, marginLeft:8 }}>· {ownerName}</span>}</div>
                      <div style={{ fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{post.title}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:17, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>{fmt(last)}</div>
                      <div style={{ fontSize:12, color:earned>0?C.green:C.silver, fontWeight:600 }}>{earned>0?eur(earned):"< 3K"}</div>
                    </div>
                    {isOpen?<ChevronUp size={15} color={C.silver}/>:<ChevronDown size={15} color={C.silver}/>}
                  </div>
                  {isOpen&&(
                    <div style={{ padding:"0 16px 16px", borderTop:`1px solid ${C.border}` }}>
                      {post.url&&<a href={post.url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:C.blueGlow, display:"block", margin:"12px 0 4px", wordBreak:"break-all" }}>{post.url}</a>}
                      <div style={{ marginTop:12 }}>
                        {entries.map((h,i)=>{ const pv=i>0?entries[i-1].views:null; const d=pv!==null?h.views-pv:null; return (
                          <div key={h.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:i<entries.length-1?`1px solid ${C.border}`:"none" }}>
                            <span style={{ fontSize:12.5, color:C.silver }}>{h.date}</span>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <span style={{ fontSize:13.5, fontWeight:600 }}>{fmt(h.views)}</span>
                              {d!==null&&d!==0&&<span style={{ fontSize:11, color:d>0?C.green:C.red, fontWeight:600 }}>{d>0?"+":""}{fmt(d)}</span>}
                              {isOwnPost&&<button onClick={()=>delEntry(h.id)} style={{ background:"none", border:"none", color:C.silver+"50", cursor:"pointer", padding:2 }}><X size={12}/></button>}
                            </div>
                          </div>
                        )})}
                      </div>
                      {isOwnPost&&(
                        <div style={{ display:"flex", gap:6, marginTop:12 }}>
                          <input type="date" value={rd.date} max={today()} onChange={(e)=>setRowDrafts((r)=>({...r,[post.id]:{...rd,date:e.target.value}}))} style={{ flex:"0 0 128px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:12.5, padding:"9px 10px" }}/>
                          <input type="text" inputMode="numeric" placeholder="Views" value={rd.views} onChange={(e)=>setRowDrafts((r)=>({...r,[post.id]:{...rd,views:e.target.value}}))} onKeyDown={(e)=>e.key==="Enter"&&addEntry(post.id)} style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.white, fontSize:13, padding:"9px 10px", minWidth:0, outline:"none" }}/>
                          <button onClick={()=>addEntry(post.id)} style={{ background:`linear-gradient(135deg,${C.blue},${C.blueGlow})`, border:"none", borderRadius:8, color:"#fff", fontWeight:700, fontSize:13, padding:"0 14px", cursor:"pointer" }}>OK</button>
                        </div>
                      )}
                      {(isAdmin||isOwnPost)&&(
                        <button onClick={()=>delPost(post.id)} style={{ display:"flex", alignItems:"center", gap:5, background:"none", border:"none", color:C.red+"70", fontSize:12, marginTop:14, cursor:"pointer", padding:0 }}><Trash2 size={12}/> Post löschen</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={()=>setShowAdd(true)} style={{ position:"fixed", right:18, bottom:24, width:54, height:54, background:`linear-gradient(135deg,${C.blue},${C.blueGlow})`, border:"none", borderRadius:999, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 6px 24px ${C.blue}60`, cursor:"pointer", zIndex:40 }}><Plus size={22} color="#fff"/></button>
        </>
      )}

      {/* ── RANGLISTE ── */}
      {tab==="board"&&(
        <div style={{ padding:"16px 18px 0" }}>
          {board==="loading"&&<div style={{ color:C.silver, fontSize:13, padding:24 }}>Lädt…</div>}
          {Array.isArray(board)&&board.map((row,i)=>(
            <div key={row.username} style={{ display:"flex", alignItems:"center", gap:14, background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px", marginBottom:8 }}>
              <div style={{ width:26, textAlign:"center", fontSize:14, fontWeight:800, fontFamily:"'Space Grotesk',sans-serif", color:i===0?C.gold:i===1?C.silverHi:C.silver+"80" }}>{i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                  {row.username}
                  {row.username===profile?.username&&<span style={{ fontSize:10, color:C.silver }}>(du)</span>}
                  {row.is_admin&&<span style={{ fontSize:10, color:C.gold, fontWeight:700, display:"flex", alignItems:"center", gap:2 }}><Shield size={9}/>Admin</span>}
                </div>
                <div style={{ fontSize:11.5, color:C.silver, marginTop:2 }}>{row.count} Posts · {fmt(row.views)} Views</div>
              </div>
              <div style={{ fontSize:18, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif", color:row.earnings>0?C.green:C.silver }}>{eur(row.earnings)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADMINS ── */}
      {tab==="admins"&&(
        <div style={{ padding:"24px 18px 0" }}>
          <div style={{ fontSize:11, color:C.gold, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16, display:"flex", alignItems:"center", gap:5 }}><Shield size={11}/>Das Admin-Team</div>
          {admins==="loading"&&<div style={{ color:C.silver, fontSize:13 }}>Lädt…</div>}
          {Array.isArray(admins)&&admins.map((a)=>(
            <div key={a.username} style={{ background:C.card, border:`1px solid ${C.gold}40`, borderRadius:12, padding:"16px", marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:a.profile_link?8:0 }}>
                <div style={{ width:36, height:36, borderRadius:999, background:`linear-gradient(135deg,${C.blue},${C.blueGlow})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Shield size={16} color={C.gold}/></div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700 }}>{a.username}</div>
                  <div style={{ fontSize:11, color:C.gold, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", marginTop:1 }}>Admin</div>
                </div>
              </div>
              {a.profile_link&&<a href={a.profile_link} target="_blank" rel="noreferrer" style={{ fontSize:12, color:C.blueGlow, display:"block", marginTop:6, wordBreak:"break-all" }}>{a.profile_link}</a>}
            </div>
          ))}
        </div>
      )}

      {/* ── PROFIL ── */}
      {tab==="profile"&&(
        <div style={{ padding:"24px 18px 0", maxWidth:420 }}>
          <div style={{ fontSize:11, color:C.silver, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:20, display:"flex", alignItems:"center", gap:6 }}><User size={11}/>Mein Profil</div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 16px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>Account</div>
            <div style={{ fontSize:11, color:C.silver, marginBottom:4 }}>Benutzername</div>
            <input style={INPUT} value={profileForm.username} onChange={(e)=>setProfileForm((f)=>({...f,username:e.target.value}))}/>
            <div style={{ fontSize:11, color:C.silver, marginBottom:4, marginTop:4 }}>Neues Passwort (leer = nicht ändern)</div>
            <input style={INPUT} type="password" placeholder="Neues Passwort" value={profileForm.newPassword} onChange={(e)=>setProfileForm((f)=>({...f,newPassword:e.target.value}))}/>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 16px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12, display:"flex", alignItems:"center", gap:5 }}><Link size={11}/>Profillink</div>
            <input style={INPUT} placeholder="TikTok / Instagram Profillink" value={profileForm.profile_link} onChange={(e)=>setProfileForm((f)=>({...f,profile_link:e.target.value}))}/>
          </div>
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 16px", marginBottom:16 }}>
            <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12, display:"flex", alignItems:"center", gap:5 }}><Wallet size={11}/>Wallet für Auszahlung</div>
            <input style={{ ...INPUT, fontFamily:"monospace", fontSize:13 }} placeholder="Wallet-Adresse" value={profileForm.wallet} onChange={(e)=>setProfileForm((f)=>({...f,wallet:e.target.value}))}/>
            <div style={{ fontSize:11, color:C.silver, marginTop:4 }}>Stelle sicher dass die Adresse korrekt ist.</div>
          </div>
          {!isAdmin&&myPayouts.length>0&&(
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 16px", marginBottom:16 }}>
              <div style={{ fontSize:10, color:C.silver, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12, display:"flex", alignItems:"center", gap:5 }}><Clock size={11}/>Payout-History</div>
              {myPayouts.map((p)=>(
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div><div style={{ fontSize:13, fontWeight:600, color:C.green }}>{eur(p.amount)}</div><div style={{ fontSize:11.5, color:C.silver }}>{fmtDate(p.paid_at)}{p.note&&` · ${p.note}`}</div></div>
                  <CheckCircle size={14} color={C.green}/>
                </div>
              ))}
            </div>
          )}
          {profileMsg&&<div style={{ fontSize:13, color:profileMsg.includes("✓")?C.green:C.red, marginBottom:12, padding:"8px 12px", background:profileMsg.includes("✓")?C.green+"12":C.red+"12", borderRadius:8 }}>{profileMsg}</div>}
          <button onClick={saveProfile} disabled={busy} style={{ width:"100%", background:`linear-gradient(135deg,${C.blue},${C.blueGlow})`, color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:14, padding:"14px 0", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:`0 4px 20px ${C.blue}40`, opacity:busy?0.7:1 }}>
            <Save size={15}/> {busy?"Speichern…":"Änderungen speichern"}
          </button>
        </div>
      )}

      {/* ── ADD SHEET ── */}
      {showAdd&&(
        <div onClick={()=>setShowAdd(false)} style={{ position:"fixed", inset:0, background:"#000000CC", display:"flex", alignItems:"flex-end", zIndex:50 }}>
          <div onClick={(e)=>e.stopPropagation()} style={{ background:C.card, borderTop:`1px solid ${C.border}`, borderRadius:"18px 18px 0 0", padding:"22px 18px 32px", width:"100%", animation:"fadeUp .2s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>Neuer Post</div>
              <button onClick={()=>setShowAdd(false)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.silver, padding:"7px", cursor:"pointer", display:"flex" }}><X size={16}/></button>
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:14 }}>
              {Object.entries(PLATFORMS).map(([k,p])=>(
                <button key={k} onClick={()=>setDraft((d)=>({...d,platform:k}))} style={{ flex:1, padding:"10px 0", borderRadius:9, fontSize:13, fontWeight:600, border:`1px solid ${draft.platform===k?p.color:C.border}`, background:draft.platform===k?p.color+"18":C.surface, color:draft.platform===k?p.color:C.silver, cursor:"pointer" }}>{p.label}</button>
              ))}
            </div>
            <input style={INPUT} placeholder="Titel / Clip-Beschreibung" value={draft.title} onChange={(e)=>setDraft((d)=>({...d,title:e.target.value}))}/>
            <input style={INPUT} placeholder="Link (optional)" value={draft.url} onChange={(e)=>setDraft((d)=>({...d,url:e.target.value}))}/>
            <input style={{ ...INPUT, marginBottom:16 }} placeholder="Views heute" inputMode="numeric" value={draft.views} onChange={(e)=>setDraft((d)=>({...d,views:e.target.value}))}/>
            <button onClick={addPost} disabled={!draft.title.trim()||busy} style={{ width:"100%", background:draft.title.trim()?`linear-gradient(135deg,${C.blue},${C.blueGlow})`:C.surface, color:draft.title.trim()?"#fff":C.silver, border:"none", borderRadius:10, fontWeight:700, fontSize:14, padding:"14px 0", cursor:draft.title.trim()?"pointer":"default", boxShadow:draft.title.trim()?`0 4px 20px ${C.blue}40`:"none" }}>
              {busy?"…":"Post anlegen"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
