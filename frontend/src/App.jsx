// src/App.jsx — BUGTRACKER v2
import { useState, useEffect, useRef, useCallback } from "react";
import * as API from "./api.js";

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const T = {
  bg:"#07080a", bg2:"#0d0f12", bg3:"#121519", surface:"#161a1f",
  border:"#1f2530", border2:"#2a3340", text:"#e2ddd6", muted:"#5a6478",
  accent:"#3b82f6", gold:"#f59e0b", goldLo:"#3d2a06",
  green:"#10b981", red:"#ef4444", orange:"#f97316", purple:"#8b5cf6",
  pink:"#ec4899", teal:"#14b8a6",
};

const PM = {
  Critical:{ color:"#ef4444", bg:"#3d0d0d", icon:"●" },
  High:    { color:"#f97316", bg:"#3d1e0d", icon:"▲" },
  Medium:  { color:"#f59e0b", bg:"#3d2d0d", icon:"◆" },
  Low:     { color:"#10b981", bg:"#0d3d26", icon:"▼" },
};
const SM = {
  "Backlog":     { color:"#5a6478", bg:"#151a22", icon:"○" },
  "To Do":       { color:"#3b82f6", bg:"#0f1e3a", icon:"◇" },
  "In Progress": { color:"#f59e0b", bg:"#2e1f08", icon:"◈" },
  "Review":      { color:"#8b5cf6", bg:"#1c1033", icon:"◉" },
  "Done":        { color:"#10b981", bg:"#0a2e1d", icon:"◆" },
};
const EPIC_STATUS = {
  planned:     { color:"#5a6478", label:"Planned" },
  in_progress: { color:"#f59e0b", label:"In Progress" },
  done:        { color:"#10b981", label:"Done" },
  cancelled:   { color:"#ef4444", label:"Cancelled" },
};
const STATUSES   = Object.keys(SM);
const PRIORITIES = Object.keys(PM);
const ROLE_COLORS = { owner:"#f59e0b", admin:"#ef4444", member:"#3b82f6", viewer:"#5a6478" };

const css = {
  input: { width:"100%", background:T.bg3, border:`1px solid ${T.border2}`, borderRadius:8,
    padding:"10px 14px", color:T.text, fontSize:13, fontFamily:"'JetBrains Mono',monospace",
    outline:"none", boxSizing:"border-box" },
  btn:(v="primary")=>({
    border:"none", borderRadius:8, padding:"9px 20px", cursor:"pointer",
    fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:12,
    letterSpacing:"0.04em", transition:"all 0.15s",
    ...(v==="primary" ? {background:T.accent,color:"#fff"}
      : v==="gold"    ? {background:T.gold,color:"#000"}
      : v==="ghost"   ? {background:"transparent",color:T.muted,border:`1px solid ${T.border2}`}
      : v==="danger"  ? {background:"#3d0d0d",color:T.red,border:`1px solid #6b1a1a`}
      : v==="green"   ? {background:"#0a2e1d",color:T.green,border:`1px solid #0f4a2e`}
      : v==="purple"  ? {background:"#1c1033",color:T.purple,border:`1px solid #3b1d6e`}
      : {background:T.surface,color:T.text,border:`1px solid ${T.border}`}),
  }),
};

/* ── Micro components ─────────────────────────────────────────── */
function Spinner({ size=14 }) {
  return <span style={{display:"inline-block",width:size,height:size,border:`2px solid ${T.border2}`,
    borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>;
}
function Avatar({ name="?", color=T.accent, size=28, src=null }) {
  if (src) return <img src={src} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}} alt={name}/>;
  return <span title={name} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
    width:size,height:size,borderRadius:"50%",background:color+"33",border:`1.5px solid ${color}66`,
    color,fontSize:size*0.38,fontWeight:800,fontFamily:"monospace",flexShrink:0}}>
    {name[0]?.toUpperCase()}
  </span>;
}
function Badge({ label, color, bg, small }) {
  return <span style={{background:bg||color+"22",color,border:`1px solid ${color}44`,
    borderRadius:5,padding:small?"1px 6px":"3px 9px",fontSize:small?10:11,fontWeight:700,
    letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"monospace",whiteSpace:"nowrap"}}>
    {label}
  </span>;
}
function Tag({ children }) {
  return <span style={{background:T.bg3,color:T.muted,border:`1px solid ${T.border}`,
    borderRadius:4,padding:"2px 7px",fontSize:10,fontFamily:"monospace"}}>{children}</span>;
}
function Field({ label, hint, children }) {
  return <div style={{marginBottom:16}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <span style={{color:T.muted,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>{label}</span>
      {hint&&<span style={{color:T.muted+"88",fontSize:10}}>{hint}</span>}
    </div>
    {children}
  </div>;
}
function Sel({ value, onChange, options }) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{...css.input,cursor:"pointer"}}>
    {options.map(o=>typeof o==="string"
      ?<option key={o} value={o}>{o}</option>
      :<option key={o.v} value={o.v}>{o.l}</option>)}
  </select>;
}
function Modal({ title, onClose, width=560, children }) {
  useEffect(()=>{
    const h=e=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[onClose]);
  return <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",
      alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
    <div style={{background:`linear-gradient(135deg,${T.surface},${T.bg3})`,border:`1px solid ${T.border2}`,
      borderRadius:14,width:`min(96vw,${width}px)`,maxHeight:"92vh",overflow:"auto",padding:"28px 30px",
      boxShadow:`0 40px 80px rgba(0,0,0,0.7)`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <span style={{color:T.text,fontFamily:"monospace",fontWeight:800,fontSize:15}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
      </div>
      {children}
    </div>
  </div>;
}
function Toast({ msg, type="success", onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,3500); return()=>clearTimeout(t); },[onDone]);
  const bg=type==="error"?T.red:type==="warn"?T.orange:T.green;
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:999,background:bg,color:"#fff",
    borderRadius:10,padding:"12px 20px",fontFamily:"monospace",fontSize:13,fontWeight:700,
    boxShadow:"0 8px 32px rgba(0,0,0,0.5)",animation:"fadeUp 0.3s ease",maxWidth:360}}>{msg}</div>;
}
function useToast() {
  const [t,setT]=useState(null);
  const show=(msg,type="success")=>setT({msg,type,key:Date.now()});
  const el=t?<Toast key={t.key} msg={t.msg} type={t.type} onDone={()=>setT(null)}/>:null;
  return [show,el];
}
const ago=d=>{
  const s=(Date.now()-new Date(d))/1000;
  if(s<60) return "just now"; if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`;
};
function ProgressBar({ value=0, color=T.accent, height=6 }) {
  return <div style={{height,background:T.bg,borderRadius:height,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${Math.min(100,value)}%`,background:color,borderRadius:height,transition:"width 0.5s"}}/>
  </div>;
}

/* ═══════════════════════════════════════════════════════════════
   AUTH SCREEN — Login / Register with background image
═══════════════════════════════════════════════════════════════ */
function AuthScreen({ onLogin }) {
  const [mode,setMode]     = useState("login");
  const [email,setEmail]   = useState("");
  const [password,setPw]   = useState("");
  const [name,setName]     = useState("");
  const [showPw,setShowPw] = useState(false);
  const [err,setErr]       = useState("");
  const [loading,setLoad]  = useState(false);

  const submit = async () => {
    setErr(""); setLoad(true);
    try {
      let data;
      if (mode==="login") {
        if (!email.trim()||!password) { setErr("Email and password are required."); setLoad(false); return; }
        data = await API.auth.login(email.trim(), password);
      } else {
        if (!name.trim())      { setErr("Full name is required.");             setLoad(false); return; }
        if (!email.trim())     { setErr("Email is required.");                 setLoad(false); return; }
        if (password.length<6) { setErr("Password must be at least 6 chars."); setLoad(false); return; }
        data = await API.auth.register({ name: name.trim(), email: email.trim(), password });
      }
      API.setAccessToken(data.accessToken);
      API.setRefreshToken(data.refreshToken);
      API.setStoredUser(data.user);
      onLogin(data.user);
    } catch(e) { setErr(e.message || "Authentication failed — check your credentials."); }
    setLoad(false);
  };

  const handleGoogle = async (response) => {
    setErr("");
    try {
      const data = await API.auth.loginGoogle(response.credential);
      API.setAccessToken(data.accessToken);
      API.setRefreshToken(data.refreshToken);
      API.setStoredUser(data.user);
      onLogin(data.user);
    } catch(e) { setErr(e.message || "Google sign-in failed."); }
  };

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    let script = document.getElementById("gsi-script");
    if (!script) {
      script = document.createElement("script");
      script.id = "gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      document.head.appendChild(script);
    }
    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogle });
      const btn = document.getElementById("g-signin-btn");
      if (btn) {
        btn.innerHTML = "";
        window.google.accounts.id.renderButton(btn, {
          theme:"filled_black", size:"large", width:340,
          text: mode==="login"?"signin_with":"signup_with",
        });
      }
    };
    if (window.google) init();
    else script.addEventListener("load", init);
    return () => script.removeEventListener("load", init);
  }, [mode]);

  const iS = {
    width:"100%", background:"rgba(10,12,16,0.8)", border:"1.5px solid #2a3340",
    borderRadius:10, padding:"13px 16px", color:"#e2ddd6", fontSize:14,
    outline:"none", boxSizing:"border-box", fontFamily:"system-ui,-apple-system,sans-serif",
    transition:"border-color 0.2s", backdropFilter:"blur(4px)",
  };

  const DEMO = [
    { label:"Admin",  email:"admin@example.com", pw:"admin123" },
    { label:"Dev",    email:"dev@example.com",   pw:"dev123"   },
    { label:"Sam",     email:"sam@example.com",    pw:"sam123"    },
  ];

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"system-ui,-apple-system,sans-serif", position:"relative", overflow:"hidden",
    }}>
      {/* Background layers */}
      <div style={{position:"absolute",inset:0,background:"#07080a",zIndex:0}}/>
      {/* Animated gradient orbs */}
      <div style={{position:"absolute",inset:0,zIndex:1,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",
          background:"radial-gradient(circle, #1d3a6b55 0%, transparent 70%)",
          top:"-15%",left:"-10%",animation:"orb1 12s ease-in-out infinite alternate"}}/>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",
          background:"radial-gradient(circle, #1c103388 0%, transparent 70%)",
          bottom:"-10%",right:"-5%",animation:"orb2 10s ease-in-out infinite alternate"}}/>
        <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",
          background:"radial-gradient(circle, #0a2e1d44 0%, transparent 70%)",
          top:"40%",right:"20%",animation:"orb3 14s ease-in-out infinite alternate"}}/>
        {/* Grid pattern overlay */}
        <div style={{position:"absolute",inset:0,
          backgroundImage:`linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)`,
          backgroundSize:"40px 40px"}}/>
        {/* Floating bug icons */}
        {["🐞","🐛","🦟","🐜"].map((icon,i)=>(
          <div key={i} style={{position:"absolute",fontSize:20,opacity:0.08,
            left:`${15+i*22}%`, top:`${20+i*15}%`,
            animation:`float${i} ${8+i*2}s ease-in-out infinite alternate`,
            pointerEvents:"none"}}>{icon}</div>
        ))}
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
        @keyframes orb1{from{transform:translate(0,0) scale(1)}to{transform:translate(60px,40px) scale(1.1)}}
        @keyframes orb2{from{transform:translate(0,0) scale(1)}to{transform:translate(-50px,-30px) scale(1.15)}}
        @keyframes orb3{from{transform:translate(0,0) scale(1)}to{transform:translate(30px,-50px) scale(0.95)}}
        @keyframes float0{from{transform:translate(0,0) rotate(0deg)}to{transform:translate(20px,-30px) rotate(20deg)}}
        @keyframes float1{from{transform:translate(0,0) rotate(0deg)}to{transform:translate(-25px,20px) rotate(-15deg)}}
        @keyframes float2{from{transform:translate(0,0) rotate(0deg)}to{transform:translate(15px,25px) rotate(10deg)}}
        @keyframes float3{from{transform:translate(0,0) rotate(0deg)}to{transform:translate(-20px,-20px) rotate(-20deg)}}
        .ai:focus{border-color:#3b82f6!important;box-shadow:0 0 0 3px #3b82f633}
        .demo-p:hover{background:#1d3a6b!important;border-color:#3b82f6!important;color:#e2ddd6!important}
        .sub-b:hover:not(:disabled){background:#2563eb!important;transform:translateY(-1px)}
        .tog:hover{color:#60a5fa!important}
        .pw-toggle:hover{color:#9bb0cc!important}
      `}</style>

      {/* Card */}
      <div style={{
        position:"relative",zIndex:10,
        background:"rgba(13,15,18,0.92)",
        border:"1px solid rgba(42,51,64,0.8)",
        borderRadius:20, padding:"38px 38px 30px",
        width:"min(94vw,400px)",
        boxShadow:"0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
        animation:"fadeUp 0.45s ease",
        backdropFilter:"blur(20px)",
      }}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{fontSize:36,marginBottom:8,filter:"drop-shadow(0 0 12px #3b82f655)"}}></div>
          <h1 style={{margin:0,color:"#e2ddd6",fontSize:22,fontWeight:800,letterSpacing:"-0.02em"}}>
            {mode==="login"?"Welcome back":"Create account"}
          </h1>
          <p style={{margin:"5px 0 0",color:"#5a6478",fontSize:12,lineHeight:1.4}}>
            {mode==="login"
              ?"Sign in to BUGTRACKER to continue"
              :"Start tracking bugs with your team"}
          </p>
        </div>

        {/* Google Button */}
        {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
          <>
            <div id="g-signin-btn" style={{display:"flex",justifyContent:"center",minHeight:44,marginBottom:4}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0"}}>
              <div style={{flex:1,height:1,background:"rgba(42,51,64,0.8)"}}/><span style={{color:"#5a6478",fontSize:11}}>or continue with email</span>
              <div style={{flex:1,height:1,background:"rgba(42,51,64,0.8)"}}/>
            </div>
          </>
        ):(
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"0 0 18px"}}>
            <div style={{flex:1,height:1,background:"rgba(42,51,64,0.6)"}}/>
            <span style={{color:"#3a4455",fontSize:11,fontFamily:"monospace"}}>email sign in</span>
            <div style={{flex:1,height:1,background:"rgba(42,51,64,0.6)"}}/>
          </div>
        )}

        {/* Fields */}
        {mode==="register"&&(
          <div style={{marginBottom:12}}>
            <label style={{display:"block",color:"#8a9ab5",fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>Full Name</label>
            <input className="ai" value={name} onChange={e=>setName(e.target.value)}
              placeholder="name" style={iS} autoFocus onKeyDown={e=>e.key==="Enter"&&submit()}/>
          </div>
        )}

        <div style={{marginBottom:12}}>
          <label style={{display:"block",color:"#8a9ab5",fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>Email Address</label>
          <input className="ai" type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="you@email.com" style={iS} autoFocus={mode==="login"}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>

        <div style={{marginBottom:mode==="login"?4:18}}>
          <label style={{display:"block",color:"#8a9ab5",fontSize:11,fontWeight:600,marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>Password</label>
          <div style={{position:"relative"}}>
            <input className="ai" type={showPw?"text":"password"} value={password}
              onChange={e=>setPw(e.target.value)} placeholder="••••••••"
              style={{...iS,paddingRight:46}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            <button onClick={()=>setShowPw(s=>!s)} className="pw-toggle"
              style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",cursor:"pointer",color:"#5a6478",
                fontSize:15,padding:0,lineHeight:1,transition:"color 0.2s"}}>
              {showPw?"🙈":"👁️"}
            </button>
          </div>
        </div>

        {mode==="login"&&(
          <div style={{textAlign:"right",marginBottom:18}}>
            <span className="tog" style={{color:"#3b82f6",fontSize:12,cursor:"pointer",transition:"color 0.2s"}}>
              Forgot password?
            </span>
          </div>
        )}

        {err&&(
          <div style={{color:"#ef4444",fontSize:12,marginBottom:14,padding:"10px 14px",
            background:"rgba(61,13,13,0.8)",borderRadius:8,border:"1px solid #6b1a1a",
            lineHeight:1.6,backdropFilter:"blur(4px)"}}>
            ⚠ {err}
          </div>
        )}

        <button className="sub-b" onClick={submit} disabled={loading}
          style={{width:"100%",padding:"13px",background:"#3b82f6",border:"none",
            borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,
            cursor:loading?"not-allowed":"pointer",opacity:loading?0.7:1,
            transition:"all 0.2s",letterSpacing:"0.01em",marginBottom:4}}>
          {loading
            ?<span style={{display:"flex",gap:8,alignItems:"center",justifyContent:"center"}}><Spinner size={14}/>Please wait…</span>
            :mode==="login"?"Log in →":"Create account →"}
        </button>

        <p style={{textAlign:"center",marginTop:16,marginBottom:0,color:"#5a6478",fontSize:13}}>
          {mode==="login"?"Don't have an account? ":"Already have an account? "}
          <span className="tog"
            onClick={()=>{setMode(m=>m==="login"?"register":"login");setErr("");setPw("");setEmail("");setName("");}}
            style={{color:"#3b82f6",cursor:"pointer",fontWeight:700,transition:"color 0.2s"}}>
            {mode==="login"?"Sign Up":"Log in"}
          </span>
        </p>

        {/* Quick demo login pills */}
        {mode==="login"&&(
          <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid rgba(42,51,64,0.6)"}}>
            <div style={{color:"#3a4455",fontSize:10,textAlign:"center",letterSpacing:"0.1em",
              textTransform:"uppercase",marginBottom:8}}>Quick Demo Login</div>
            <div style={{display:"flex",gap:6,justifyContent:"center"}}>
              {DEMO.map(d=>(
                <button key={d.email} className="demo-p"
                  onClick={()=>{setEmail(d.email);setPw(d.pw);}}
                  style={{padding:"5px 14px",background:"rgba(17,19,22,0.8)",
                    border:"1px solid #2a3340",borderRadius:20,color:"#8a9ab5",
                    fontSize:11,cursor:"pointer",fontWeight:600,transition:"all 0.15s",
                    backdropFilter:"blur(4px)"}}>
                  {d.label}
                </button>
              ))}
            </div>
            <p style={{color:"#2a3340",fontSize:10,textAlign:"center",margin:"6px 0 0"}}>
              Click role pill → Log in button
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WORKSPACE SWITCHER + CREATOR
═══════════════════════════════════════════════════════════════ */
function WorkspaceSwitcher({ workspaces, activeWs, onSwitch, onCreate, onClose }) {
  const [creating,setCreating] = useState(false);
  const [name,setName]         = useState("");
  const [desc,setDesc]         = useState("");
  const [color,setColor]       = useState("#3b82f6");
  const [loading,setLoad]      = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setLoad(true);
    try { await onCreate(name,desc,color); setName(""); setDesc(""); setCreating(false); }
    catch(e){}
    setLoad(false);
  };

  const COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316"];

  return (
    <Modal title="🏢 Workspaces" onClose={onClose} width={480}>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16,maxHeight:320,overflowY:"auto"}}>
        {workspaces.map(ws=>(
          <div key={ws._id} onClick={()=>onSwitch(ws._id)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
              background:activeWs===ws._id?T.surface:T.bg3,
              border:`1px solid ${activeWs===ws._id?T.accent:T.border2}`,
              borderRadius:10,cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=activeWs===ws._id?T.accent:T.border2}>
            <div style={{width:36,height:36,borderRadius:10,background:ws.color||T.accent,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
              {ws.icon||"🏢"}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:T.text,fontWeight:700,fontSize:13}}>{ws.name}</div>
              <div style={{color:T.muted,fontSize:10}}>{ws._projectCount||0} projects · {ws._myRole||"member"}</div>
            </div>
            {activeWs===ws._id&&<Badge label="Active" color={T.green} small/>}
          </div>
        ))}
        {workspaces.length===0&&(
          <div style={{color:T.muted,textAlign:"center",padding:32,fontSize:12}}>No workspaces yet. Create one below!</div>
        )}
      </div>

      {!creating ? (
        <button onClick={()=>setCreating(true)} style={{...css.btn("primary"),width:"100%"}}>
          + Create New Workspace
        </button>
      ) : (
        <div style={{background:T.bg,borderRadius:10,padding:18,border:`1px solid ${T.border}`}}>
          <div style={{color:T.text,fontWeight:700,fontSize:11,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.08em"}}>New Workspace</div>
          <Field label="Name"><input value={name} onChange={e=>setName(e.target.value)} placeholder="My Company" style={css.input} autoFocus/></Field>
          <Field label="Description"><input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="What's this workspace for?" style={css.input}/></Field>
          <Field label="Color">
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {COLORS.map(c=>(
                <div key={c} onClick={()=>setColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",
                  border:color===c?`3px solid ${T.text}`:"3px solid transparent",transition:"border 0.15s"}}/>
              ))}
            </div>
          </Field>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setCreating(false)} style={{...css.btn("ghost"),flex:1}}>Cancel</button>
            <button onClick={create} disabled={loading||!name.trim()} style={{...css.btn("primary"),flex:2}}>
              {loading?<Spinner/>:"Create Workspace"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS DASHBOARD
═══════════════════════════════════════════════════════════════ */
function AnalyticsDashboard({ wsId, wsName, onClose }) {
  const [stats,setStats] = useState(null);
  const [loading,setLoad] = useState(true);

  useEffect(()=>{
    API.workspaces.stats(wsId)
      .then(d=>setStats(d.stats))
      .catch(()=>{})
      .finally(()=>setLoad(false));
  },[wsId]);

  if (loading) return <Modal title="📈 Analytics" onClose={onClose} width={900}>
    <div style={{textAlign:"center",padding:60}}><Spinner size={32}/></div>
  </Modal>;

  const s = stats || {};
  const byStatus = s.byStatus || {};
  const byPriority = s.byPriority || {};

  const StatCard = ({label,value,color,sub}) => (
    <div style={{background:T.surface,border:`1px solid ${color}33`,borderRadius:12,padding:"18px 20px",flex:1,minWidth:130}}>
      <div style={{color,fontWeight:800,fontSize:30,fontFamily:"monospace",lineHeight:1}}>{value??0}</div>
      <div style={{color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:4}}>{label}</div>
      {sub&&<div style={{color:color,fontSize:11,marginTop:6}}>{sub}</div>}
    </div>
  );

  const maxBar = Math.max(...STATUSES.map(s=>byStatus[s]||0), 1);
  const maxPBar = Math.max(...PRIORITIES.map(p=>byPriority[p]||0), 1);

  return (
    <Modal title={`📈 Analytics — ${wsName}`} onClose={onClose} width={900}>
      {/* KPI Row */}
      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <StatCard label="Total Tickets" value={s.totalTickets} color={T.accent}/>
        <StatCard label="Open" value={s.openTickets} color={T.orange}/>
        <StatCard label="Completed" value={s.doneTickets} color={T.green} sub={`${s.completionRate||0}% done`}/>
        <StatCard label="Overdue" value={s.overdueTickets} color={T.red}/>
        <StatCard label="Velocity / 7d" value={s.velocity} color={T.purple} sub="tickets closed"/>
        <StatCard label="Projects" value={s.totalProjects} color={T.teal}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        {/* By Status */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:18}}>
          <div style={{color:T.text,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Tickets by Status</div>
          {STATUSES.map(s2=>{
            const count=byStatus[s2]||0;
            const pct=s.totalTickets>0?Math.round((count/s.totalTickets)*100):0;
            return (
              <div key={s2} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:SM[s2].color,fontSize:11}}>{SM[s2].icon} {s2}</span>
                  <span style={{color:T.muted,fontSize:11}}>{count} <span style={{color:T.muted+"88"}}>({pct}%)</span></span>
                </div>
                <ProgressBar value={pct} color={SM[s2].color}/>
              </div>
            );
          })}
        </div>

        {/* By Priority */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:18}}>
          <div style={{color:T.text,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Tickets by Priority</div>
          {PRIORITIES.map(p=>{
            const count=byPriority[p]||0;
            const pct=s.totalTickets>0?Math.round((count/s.totalTickets)*100):0;
            return (
              <div key={p} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:PM[p].color,fontSize:11}}>{PM[p].icon} {p}</span>
                  <span style={{color:T.muted,fontSize:11}}>{count} <span style={{color:T.muted+"88"}}>({pct}%)</span></span>
                </div>
                <ProgressBar value={pct} color={PM[p].color}/>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Assignees */}
      {s.byAssignee && s.byAssignee.length > 0 && (
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:18,marginBottom:14}}>
          <div style={{color:T.text,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Top Assignees</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {s.byAssignee.map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
                background:T.bg,borderRadius:8,border:`1px solid ${T.border}`,flex:"1 1 180px"}}>
                <Avatar name={a.user?.name||"?"} color={a.user?.color||T.accent} size={32}/>
                <div>
                  <div style={{color:T.text,fontSize:12,fontWeight:700}}>{a.user?.name||"?"}</div>
                  <div style={{color:T.accent,fontSize:11}}>{a.count} tickets</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {s.recentActivity && s.recentActivity.length > 0 && (
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:18}}>
          <div style={{color:T.text,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Recently Updated</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
            {s.recentActivity.map(t=>(
              <div key={t._id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",
                borderBottom:`1px solid ${T.border}`}}>
                <span style={{color:PM[t.priority]?.color||T.muted,fontSize:12}}>{PM[t.priority]?.icon}</span>
                <span style={{color:T.text,fontSize:12,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</span>
                <Badge label={t.status} color={SM[t.status]?.color||T.muted} bg={SM[t.status]?.bg} small/>
                <span style={{color:T.muted,fontSize:10,flexShrink:0}}>{ago(t.updatedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WORKSPACE SETTINGS (Members + Invites + Roles)
═══════════════════════════════════════════════════════════════ */
function WorkspaceSettings({ ws, myRole, onClose, showToast, onUpdated }) {
  const [tab,setTab]         = useState("members");
  const [members,setMembers] = useState([]);
  const [invites,setInvites] = useState([]);
  const [email,setEmail]     = useState("");
  const [role,setRole]       = useState("member");
  const [loading,setLoad]    = useState(false);
  const [invLink,setInvLink] = useState(null);

  const load = useCallback(async()=>{
    try {
      const [md,id] = await Promise.all([
        API.workspaces.members(ws._id),
        API.workspaces.invites(ws._id),
      ]);
      setMembers(md.members||[]);
      setInvites(id.invites||[]);
    } catch(e){}
  },[ws._id]);

  useEffect(()=>{ load(); },[load]);

  const invite = async () => {
    if (!email.trim()) return;
    setLoad(true);
    try {
      const d = await API.workspaces.invite(ws._id,{email:email.trim(),role});
      showToast(d.message||"Invite sent!");
      if (d.inviteLink) setInvLink(d.inviteLink);
      setEmail("");
      load();
    } catch(e){ showToast(e.message,"error"); }
    setLoad(false);
  };

  const changeRole = async (uid,newRole) => {
    try {
      await API.workspaces.updateRole(ws._id,uid,newRole);
      showToast("Role updated"); load();
    } catch(e){ showToast(e.message,"error"); }
  };

  const removeMember = async (uid,uname) => {
    if (!confirm(`Remove ${uname}?`)) return;
    try {
      await API.workspaces.removeMember(ws._id,uid);
      showToast(`${uname} removed`); load();
    } catch(e){ showToast(e.message,"error"); }
  };

  const cancelInvite = async (inviteId) => {
    try {
      await API.workspaces.cancelInvite(ws._id,inviteId);
      showToast("Invite cancelled"); load();
    } catch(e){ showToast(e.message,"error"); }
  };

  const canManage = ["owner","admin"].includes(myRole);

  return (
    <Modal title={`⚙️ ${ws.name} Settings`} onClose={onClose} width={640}>
      <div style={{display:"flex",gap:2,marginBottom:20,background:T.bg,borderRadius:8,padding:3}}>
        {["members","invites","roles"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px",border:"none",borderRadius:6,
            cursor:"pointer",background:tab===t?T.surface:"transparent",
            color:tab===t?T.text:T.muted,fontFamily:"monospace",fontSize:12,fontWeight:700,textTransform:"capitalize"}}>
            {t}
          </button>
        ))}
      </div>

      {tab==="members"&&(
        <div>
          {canManage&&(
            <div style={{background:T.bg,borderRadius:10,padding:16,border:`1px solid ${T.border}`,marginBottom:16}}>
              <div style={{color:T.text,fontWeight:700,fontSize:11,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>➕ Invite by Email</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 130px",gap:10,marginBottom:10}}>
                <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&invite()}
                  placeholder="colleague@company.io" style={css.input} autoFocus/>
                <Sel value={role} onChange={setRole} options={[{v:"admin",l:"Admin"},{v:"member",l:"Member"},{v:"viewer",l:"Viewer"}]}/>
              </div>
              <button onClick={invite} disabled={loading||!email.trim()} style={{...css.btn("primary"),width:"100%",opacity:email.trim()?1:0.5}}>
                {loading?<Spinner/>:"Send Invite →"}
              </button>
              {invLink&&(
                <div style={{marginTop:12,padding:10,background:T.goldLo,border:`1px solid ${T.gold}44`,borderRadius:8}}>
                  <div style={{color:T.gold,fontSize:11,fontWeight:700,marginBottom:6}}>📋 Invite Link (copy & share)</div>
                  <div style={{fontFamily:"monospace",fontSize:10,color:"#d4b483",wordBreak:"break-all",cursor:"pointer"}}
                    onClick={()=>{navigator.clipboard.writeText(invLink);showToast("Link copied!");}}>
                    {invLink}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:360,overflowY:"auto"}}>
            {members.map((m,i)=>{
              const u=m.userId||m; const uid=u?._id||u;
              return (
                <div key={uid||i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                  background:`linear-gradient(135deg,${T.surface},${T.bg3})`,border:`1px solid ${T.border2}`,borderRadius:10}}>
                  <Avatar name={u?.name||"?"} color={u?.color||T.accent} size={36}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:T.text,fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis"}}>{u?.name||"?"}</div>
                    <div style={{color:T.muted,fontSize:11}}>{u?.email||""}</div>
                  </div>
                  {canManage && m.role!=="owner" ? (
                    <select value={m.role} onChange={e=>changeRole(uid,e.target.value)}
                      style={{...css.input,width:"auto",padding:"5px 8px",fontSize:11,cursor:"pointer"}}>
                      {["admin","member","viewer"].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <Badge label={m.role} color={ROLE_COLORS[m.role]||T.muted} small/>
                  )}
                  {m.role==="owner"
                    ? <span style={{color:T.gold,fontSize:14}}>👑</span>
                    : canManage && (
                      <button onClick={()=>removeMember(uid,u?.name)} style={{...css.btn("danger"),fontSize:10,padding:"5px 12px"}}>
                        Remove
                      </button>
                    )
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="invites"&&(
        <div>
          {invites.length===0
            ?<div style={{color:T.muted,textAlign:"center",padding:40,fontSize:12}}>No pending invites.</div>
            :<div style={{display:"flex",flexDirection:"column",gap:8}}>
              {invites.map(inv=>(
                <div key={inv._id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                  background:T.surface,border:`1px solid ${T.border2}`,borderRadius:10}}>
                  <div style={{flex:1}}>
                    <div style={{color:T.text,fontSize:13,fontWeight:700}}>{inv.email}</div>
                    <div style={{color:T.muted,fontSize:11}}>Role: {inv.role} · Expires {ago(inv.expiresAt)}</div>
                    <div style={{color:T.muted,fontSize:10}}>Invited by {inv.invitedBy?.name}</div>
                  </div>
                  <Badge label="Pending" color={T.gold} small/>
                  {canManage&&(
                    <button onClick={()=>cancelInvite(inv._id)} style={{...css.btn("danger"),fontSize:10,padding:"5px 12px"}}>Cancel</button>
                  )}
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {tab==="roles"&&(
        <div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {role:"owner",color:T.gold,desc:"Full control. Can delete workspace, manage billing, transfer ownership."},
              {role:"admin",color:T.red,desc:"Can manage members, projects, and all workspace settings."},
              {role:"member",color:T.accent,desc:"Can create and manage projects and tickets they're assigned to."},
              {role:"viewer",color:T.muted,desc:"Read-only access to all workspace projects and tickets."},
            ].map(({role:r,color,desc})=>(
              <div key={r} style={{padding:"14px 16px",background:T.surface,border:`1px solid ${color}44`,borderRadius:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <Badge label={r} color={color} small/>
                  <div style={{color:T.text,fontSize:12,fontWeight:700,textTransform:"capitalize"}}>{r}</div>
                </div>
                <div style={{color:T.muted,fontSize:12}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EPICS PANEL
═══════════════════════════════════════════════════════════════ */
function EpicsPanel({ projectId, members, onClose, showToast }) {
  const [epics,setEpics]   = useState([]);
  const [loading,setLoad]  = useState(true);
  const [creating,setCreate] = useState(false);
  const [f,setF]           = useState({title:"",description:"",priority:"Medium",color:"#8b5cf6",status:"planned"});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const load=useCallback(async()=>{
    setLoad(true);
    try { const d=await API.epics.list(projectId); setEpics(d.epics||[]); }
    catch(e){ showToast(e.message,"error"); }
    setLoad(false);
  },[projectId,showToast]);

  useEffect(()=>{ load(); },[load]);

  const createEpic=async()=>{
    if(!f.title.trim()) return;
    try {
      await API.epics.create(projectId,f);
      showToast("Epic created"); setCreate(false); setF({title:"",description:"",priority:"Medium",color:"#8b5cf6",status:"planned"});
      load();
    } catch(e){ showToast(e.message,"error"); }
  };

  const deleteEpic=async(id,title)=>{
    if(!confirm(`Delete epic "${title}"?`)) return;
    try { await API.epics.delete(id); showToast("Epic deleted"); load(); }
    catch(e){ showToast(e.message,"error"); }
  };

  const EPIC_COLORS=["#8b5cf6","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316"];

  return (
    <Modal title="⚡ Epics" onClose={onClose} width={680}>
      {loading?<div style={{textAlign:"center",padding:40}}><Spinner size={24}/></div>:(
        <>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16,maxHeight:400,overflowY:"auto"}}>
            {epics.length===0&&!creating&&(
              <div style={{color:T.muted,textAlign:"center",padding:32,fontSize:12}}>No epics yet. Create your first epic to group related tickets.</div>
            )}
            {epics.map(ep=>{
              const es=EPIC_STATUS[ep.status]||EPIC_STATUS.planned;
              return (
                <div key={ep._id} style={{padding:"14px 16px",background:`linear-gradient(135deg,${T.surface},${T.bg3})`,
                  border:`1px solid ${ep.color||T.border2}44`,borderRadius:10,
                  borderLeft:`4px solid ${ep.color||T.purple}`}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{color:T.text,fontSize:13,fontWeight:700}}>{ep.title}</div>
                      {ep.description&&<div style={{color:T.muted,fontSize:12,marginTop:3}}>{ep.description}</div>}
                    </div>
                    <Badge label={es.label} color={es.color} small/>
                    <Badge label={ep.priority} color={PM[ep.priority]?.color||T.muted} small/>
                    <button onClick={()=>deleteEpic(ep._id,ep.title)}
                      style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14,padding:"2px 4px"}}>✕</button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1}}>
                      <ProgressBar value={ep.progress||0} color={ep.color||T.purple} height={5}/>
                    </div>
                    <span style={{color:T.muted,fontSize:10,flexShrink:0}}>{ep.progress||0}% · {ep._totalTickets||0} tickets</span>
                  </div>
                </div>
              );
            })}
          </div>

          {creating ? (
            <div style={{background:T.bg,borderRadius:10,padding:16,border:`1px solid ${T.border}`}}>
              <div style={{color:T.text,fontWeight:700,fontSize:11,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>New Epic</div>
              <Field label="Title"><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Epic title…" style={css.input} autoFocus/></Field>
              <Field label="Description"><textarea value={f.description} onChange={e=>set("description",e.target.value)} rows={2} style={{...css.input,resize:"vertical"}}/></Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <Field label="Priority"><Sel value={f.priority} onChange={v=>set("priority",v)} options={PRIORITIES}/></Field>
                <Field label="Status"><Sel value={f.status} onChange={v=>set("status",v)} options={Object.keys(EPIC_STATUS).map(k=>({v:k,l:EPIC_STATUS[k].label}))}/></Field>
              </div>
              <Field label="Color">
                <div style={{display:"flex",gap:8}}>{EPIC_COLORS.map(c=>(
                  <div key={c} onClick={()=>set("color",c)} style={{width:24,height:24,borderRadius:"50%",background:c,
                    cursor:"pointer",border:f.color===c?`3px solid ${T.text}`:"3px solid transparent"}}/>
                ))}</div>
              </Field>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setCreate(false)} style={{...css.btn("ghost"),flex:1}}>Cancel</button>
                <button onClick={createEpic} style={{...css.btn("purple"),flex:2}}>Create Epic</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setCreate(true)} style={{...css.btn("purple"),width:"100%"}}>⚡ New Epic</button>
          )}
        </>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TICKET FORM (with Epic support)
═══════════════════════════════════════════════════════════════ */
function TicketForm({ initial, projectId, members, epics, onSaved, onClose, showToast }) {
  const [f,setF] = useState(initial||{title:"",description:"",priority:"Medium",status:"To Do",assigneeId:"",labels:"",estimate:1,epicId:""});
  const [load,setLoad] = useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const memberOpts=(members||[]).map(m=>({v:m.userId?._id||m._id||"",l:m.userId?.name||m.name||"?"}));
  const epicOpts=(epics||[]).map(e=>({v:e._id,l:e.title}));

  const submit=async()=>{
    if(!f.title.trim()) return;
    setLoad(true);
    try {
      const body={
        title:f.title.trim(),description:f.description,priority:f.priority,status:f.status,
        assigneeId:f.assigneeId||undefined,
        labels:f.labels?f.labels.split(",").map(l=>l.trim()).filter(Boolean):[],
        estimate:Number(f.estimate)||0,
        epicId:f.epicId||undefined,
      };
      const d=initial?await API.tickets.update(initial._id,body):await API.tickets.create(projectId,body);
      showToast(initial?"Ticket updated":"Ticket created");
      onSaved(d.ticket); onClose();
    } catch(e){ showToast(e.message,"error"); }
    setLoad(false);
  };

  return (
    <Modal title={initial?"Edit Ticket":"New Ticket"} onClose={onClose} width={640}>
      <Field label="Title"><input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Clear, specific title…" style={css.input} autoFocus/></Field>
      <Field label="Description">
        <textarea value={f.description} onChange={e=>set("description",e.target.value)} rows={4}
          placeholder={"Steps to reproduce:\n1.\n\nExpected:\nActual:"}
          style={{...css.input,resize:"vertical",lineHeight:1.7}}/>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <Field label="Priority"><Sel value={f.priority} onChange={v=>set("priority",v)} options={PRIORITIES}/></Field>
        <Field label="Status"><Sel value={f.status} onChange={v=>set("status",v)} options={STATUSES}/></Field>
        <Field label="Assignee">
          <Sel value={f.assigneeId} onChange={v=>set("assigneeId",v)} options={[{v:"",l:"Unassigned"},...memberOpts]}/>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 90px",gap:12}}>
        <Field label="Epic">
          <Sel value={f.epicId} onChange={v=>set("epicId",v)} options={[{v:"",l:"No Epic"},...epicOpts]}/>
        </Field>
        <Field label="Labels" hint="comma-separated">
          <input value={f.labels} onChange={e=>set("labels",e.target.value)} placeholder="bug, auth" style={css.input}/>
        </Field>
        <Field label="Est (h)">
          <input type="number" value={f.estimate} onChange={e=>set("estimate",e.target.value)} min={0} style={css.input}/>
        </Field>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:6}}>
        <button onClick={onClose} style={css.btn("ghost")}>Cancel</button>
        <button onClick={submit} disabled={load} style={css.btn("primary")}>
          {load?<Spinner/>:initial?"Update":"Create Ticket"}
        </button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TICKET DETAIL
═══════════════════════════════════════════════════════════════ */
function TicketDetail({ ticketId, members, epics, onClose, onUpdated, showToast }) {
  const [ticket,setTicket]   = useState(null);
  const [comments,setComments] = useState([]);
  const [tab,setTab]         = useState("details");
  const [status,setStatus]   = useState("");
  const [priority,setPri]    = useState("");
  const [assigneeId,setAss]  = useState("");
  const [epicId,setEpic]     = useState("");
  const [comment,setComment] = useState("");
  const [saving,setSave]     = useState(false);
  const [posting,setPost]    = useState(false);
  const [aiLoad,setAiLoad]   = useState(false);
  const [aiReply,setAiReply] = useState("");

  useEffect(()=>{
    API.tickets.get(ticketId).then(d=>{
      setTicket(d.ticket); setComments(d.comments||[]);
      setStatus(d.ticket.status); setPri(d.ticket.priority);
      setAss(d.ticket.assigneeId?._id||"");
      setEpic(d.ticket.epicId?._id||d.ticket.epicId||"");
    }).catch(e=>showToast(e.message,"error"));
  },[ticketId]);

  const save=async()=>{
    setSave(true);
    try {
      const d=await API.tickets.update(ticketId,{status,priority,assigneeId:assigneeId||null,epicId:epicId||null});
      setTicket(d.ticket); showToast("Saved"); onUpdated(d.ticket);
    } catch(e){ showToast(e.message,"error"); }
    setSave(false);
  };

  const postComment=async()=>{
    if(!comment.trim()) return;
    setPost(true);
    try {
      const d=await API.tickets.addComment(ticketId,comment.trim());
      setComments(p=>[...p,d.comment]); setComment("");
    } catch(e){ showToast(e.message,"error"); }
    setPost(false);
  };

  const getAI=async()=>{
    if(!ticket) return;
    setAiLoad(true); setAiReply("");
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,
          messages:[{role:"user",content:`You are a senior engineer. Give a concise 4-5 sentence debugging plan:\n\nTitle: ${ticket.title}\nDescription: ${ticket.description}\nPriority: ${ticket.priority}\nStatus: ${ticket.status}`}]})});
      const d=await res.json();
      setAiReply(d.content?.map(b=>b.text).join("")||"No response");
    } catch{ setAiReply("Could not reach AI."); }
    setAiLoad(false);
  };

  if(!ticket) return <Modal title="Loading…" onClose={onClose}><div style={{textAlign:"center",padding:40}}><Spinner size={28}/></div></Modal>;

  const pm=PM[ticket.priority]||PM.Medium;
  const sm=SM[ticket.status]||SM["To Do"];
  const memberOpts=(members||[]).map(m=>({v:m.userId?._id||m._id||"",l:m.userId?.name||m.name||"?"}));
  const epicOpts=(epics||[]).map(e=>({v:e._id,l:e.title}));

  return (
    <Modal title="" onClose={onClose} width={800}>
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
          <Badge label={`${pm.icon} ${ticket.priority}`} color={pm.color} bg={pm.bg}/>
          <Badge label={`${sm.icon} ${ticket.status}`} color={sm.color} bg={sm.bg}/>
          {ticket.epicId&&<Badge label={`⚡ Epic`} color={T.purple}/>}
          {ticket.labels?.map(l=><Tag key={l}>{l}</Tag>)}
          <span style={{marginLeft:"auto",color:T.muted,fontSize:10,fontFamily:"monospace"}}>#{ticket.ticketNumber}</span>
        </div>
        <h2 style={{margin:"0 0 10px",color:T.text,fontSize:17,fontFamily:"monospace",fontWeight:800,lineHeight:1.3}}>{ticket.title}</h2>
        <div style={{display:"flex",gap:16}}>
          {ticket.reporterId&&<span style={{color:T.muted,fontSize:11}}>By <span style={{color:T.accent}}>{ticket.reporterId.name}</span></span>}
          <span style={{color:T.muted,fontSize:11}}>{ago(ticket.createdAt)}</span>
        </div>
      </div>

      <div style={{display:"flex",gap:2,marginBottom:20,background:T.bg,borderRadius:8,padding:3}}>
        {["details","activity","history"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px",border:"none",borderRadius:6,
            cursor:"pointer",background:tab===t?T.surface:"transparent",
            color:tab===t?T.text:T.muted,fontFamily:"monospace",fontSize:12,fontWeight:700}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab==="details"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 230px",gap:20}}>
          <div>
            <div style={{background:T.bg,borderRadius:8,padding:16,marginBottom:16,border:`1px solid ${T.border}`,
              color:"#a8b3c8",fontSize:13,fontFamily:"monospace",lineHeight:1.8,whiteSpace:"pre-wrap",minHeight:80}}>
              {ticket.description||"No description provided."}
            </div>
            <div style={{borderRadius:10,border:`1px solid ${T.gold}44`,background:T.goldLo,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px"}}>
                <span style={{color:T.gold,fontFamily:"monospace",fontWeight:700,fontSize:11,flex:1}}>⚡ AI Debug Assistant</span>
                <button onClick={getAI} disabled={aiLoad} style={{...css.btn("gold"),fontSize:10,padding:"5px 14px"}}>
                  {aiLoad?<span style={{display:"flex",gap:6,alignItems:"center"}}><Spinner/>Thinking…</span>:"Suggest Fix"}
                </button>
              </div>
              {aiReply&&<p style={{margin:0,padding:"0 14px 14px",color:"#d4b483",fontSize:12,fontFamily:"monospace",lineHeight:1.8}}>{aiReply}</p>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><div style={{color:T.muted,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Status</div><Sel value={status} onChange={setStatus} options={STATUSES}/></div>
            <div><div style={{color:T.muted,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Priority</div><Sel value={priority} onChange={setPri} options={PRIORITIES}/></div>
            <div><div style={{color:T.muted,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Assignee</div>
              <Sel value={assigneeId} onChange={setAss} options={[{v:"",l:"Unassigned"},...memberOpts]}/>
            </div>
            <div><div style={{color:T.muted,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>Epic</div>
              <Sel value={epicId} onChange={setEpic} options={[{v:"",l:"No Epic"},...epicOpts]}/>
            </div>
            {ticket.assigneeId&&(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:T.bg,borderRadius:8,border:`1px solid ${T.border}`}}>
                <Avatar name={ticket.assigneeId.name} color={ticket.assigneeId.color}/>
                <div><div style={{color:T.text,fontSize:12}}>{ticket.assigneeId.name}</div><div style={{color:T.muted,fontSize:10}}>{ticket.assigneeId.email}</div></div>
              </div>
            )}
            <div style={{padding:"10px 12px",background:T.bg,borderRadius:8,border:`1px solid ${T.border}`}}>
              <div style={{color:T.muted,fontSize:10,marginBottom:4}}>ESTIMATE</div>
              <div style={{color:T.accent,fontSize:20,fontWeight:800,fontFamily:"monospace"}}>{ticket.estimate}h</div>
            </div>
          </div>
        </div>
      )}

      {tab==="activity"&&(
        <div>
          <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
            {comments.length===0&&<div style={{color:T.muted,fontSize:12,textAlign:"center",padding:24}}>No comments yet.</div>}
            {comments.map(c=>(
              <div key={c._id} style={{display:"flex",gap:10}}>
                <Avatar name={c.authorId?.name||"?"} color={c.authorId?.color} size={32}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:8,alignItems:"baseline",marginBottom:4}}>
                    <span style={{color:T.text,fontSize:12,fontWeight:700}}>{c.authorId?.name||"?"}</span>
                    <span style={{color:T.muted,fontSize:10}}>{ago(c.createdAt)}</span>
                    {c.isEdited&&<span style={{color:T.muted,fontSize:9}}>(edited)</span>}
                  </div>
                  <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 12px",color:"#a8b3c8",fontSize:12,lineHeight:1.7}}>{c.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Write a comment…" rows={2}
              style={{...css.input,flex:1,resize:"vertical"}}/>
            <button onClick={postComment} disabled={posting} style={{...css.btn("primary"),padding:"0 18px",alignSelf:"flex-end"}}>
              {posting?<Spinner/>:"Post"}
            </button>
          </div>
        </div>
      )}

      {tab==="history"&&(
        <div>
          {(!ticket.statusHistory||ticket.statusHistory.length===0)
            ?<div style={{color:T.muted,textAlign:"center",padding:24,fontSize:12}}>No status changes recorded.</div>
            :ticket.statusHistory.map((h,i)=>(
              <div key={i} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                <Badge label={h.from} color={SM[h.from]?.color||T.muted} bg={SM[h.from]?.bg} small/>
                <span style={{color:T.muted}}>→</span>
                <Badge label={h.to} color={SM[h.to]?.color||T.muted} bg={SM[h.to]?.bg} small/>
                <span style={{color:T.muted,fontSize:11,marginLeft:"auto"}}>{ago(h.changedAt)}</span>
              </div>
            ))}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22,paddingTop:18,borderTop:`1px solid ${T.border}`}}>
        <button onClick={onClose} style={css.btn("ghost")}>Close</button>
        <button onClick={save} disabled={saving} style={css.btn("primary")}>{saving?<Spinner/>:"Save Changes"}</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KANBAN CARD
═══════════════════════════════════════════════════════════════ */
function KanbanCard({ ticket, epics, onClick, onDragStart }) {
  const pm=PM[ticket.priority]||PM.Medium;
  const a=ticket.assigneeId;
  const ep=epics?.find(e=>e._id===ticket.epicId);
  return (
    <div draggable onDragStart={e=>onDragStart(e,ticket)} onClick={onClick}
      style={{background:`linear-gradient(135deg,${T.surface},${T.bg3})`,border:`1px solid ${T.border}`,
        borderRadius:10,padding:"13px 14px",cursor:"pointer",marginBottom:8,
        borderLeft:`3px solid ${pm.color}`,transition:"all 0.15s"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 8px 24px rgba(0,0,0,0.3)`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
      {ep&&<div style={{color:T.purple,fontSize:10,fontWeight:700,fontFamily:"monospace",marginBottom:5}}>⚡ {ep.title}</div>}
      <div style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
        <span style={{color:pm.color,fontFamily:"monospace",fontSize:10,fontWeight:700}}>{pm.icon} {ticket.priority}</span>
        {ticket.labels?.slice(0,2).map(l=><Tag key={l}>{l}</Tag>)}
        <span style={{marginLeft:"auto",color:T.muted,fontSize:9,fontFamily:"monospace"}}>#{ticket.ticketNumber}</span>
      </div>
      <p style={{margin:"0 0 10px",color:T.text,fontFamily:"monospace",fontSize:12,fontWeight:600,lineHeight:1.5}}>{ticket.title}</p>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{color:T.muted,fontSize:10}}>⏱ {ticket.estimate}h</span>
        {a&&<Avatar name={a.name} color={a.color} size={22}/>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD MEMBER MODAL (Project-level)
═══════════════════════════════════════════════════════════════ */
function AddMemberModal({ projectId, currentMembers, onMemberAdded, onMemberRemoved, onClose, showToast }) {
  const [email,setEmail]   = useState("");
  const [role,setRole]     = useState("member");
  const [loading,setLoad]  = useState(false);
  const [removing,setRem]  = useState(null);

  const add=async()=>{
    if(!email.trim()) return;
    setLoad(true);
    try {
      const d=await API.projects.addMember(projectId,{email:email.trim(),role});
      showToast("Member added!"); setEmail(""); onMemberAdded(d.members);
    } catch(e){ showToast(e.message,"error"); }
    setLoad(false);
  };

  const remove=async(uid,uname)=>{
    if(!confirm(`Remove ${uname}?`)) return;
    setRem(uid);
    try {
      await API.projects.removeMember(projectId,uid);
      showToast(`${uname} removed`); onMemberRemoved(uid);
    } catch(e){ showToast(e.message,"error"); }
    setRem(null);
  };

  return (
    <Modal title="👥 Project Members" onClose={onClose} width={580}>
      <div style={{background:T.bg,borderRadius:10,padding:16,border:`1px solid ${T.border}`,marginBottom:20}}>
        <div style={{color:T.text,fontWeight:700,fontSize:11,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>➕ Add Member</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 130px",gap:10,marginBottom:10}}>
          <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
            placeholder="user@company.io" style={css.input} autoFocus/>
          <Sel value={role} onChange={setRole} options={[{v:"admin",l:"Admin"},{v:"member",l:"Member"},{v:"viewer",l:"Viewer"}]}/>
        </div>
        <button onClick={add} disabled={loading||!email.trim()} style={{...css.btn("primary"),width:"100%",opacity:email.trim()?1:0.5}}>
          {loading?<Spinner/>:"Add Member"}
        </button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:320,overflowY:"auto"}}>
        {currentMembers.map((m,i)=>{
          const u=m.userId||m; const uid=u?._id||u;
          return (
            <div key={uid||i} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
              background:`linear-gradient(135deg,${T.surface},${T.bg3})`,border:`1px solid ${T.border2}`,borderRadius:10}}>
              <Avatar name={u?.name||"?"} color={u?.color||T.accent} size={36}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:T.text,fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis"}}>{u?.name||"?"}</div>
                <div style={{color:T.muted,fontSize:11}}>{u?.email||""}</div>
              </div>
              <Badge label={m.role||"member"} color={ROLE_COLORS[m.role||"member"]||T.muted} small/>
              {m.role==="owner"
                ?<span style={{color:T.gold,fontSize:14}}>👑</span>
                :<button onClick={()=>remove(uid,u?.name)} disabled={removing===uid}
                  style={{...css.btn("danger"),fontSize:10,padding:"5px 12px"}}>
                  {removing===uid?<Spinner/>:"Remove"}
                </button>
              }
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [user,setUser]             = useState(null);
  const [workspaces,setWS]         = useState([]);
  const [activeWsId,setActiveWsId] = useState(null);
  const [projects,setProjects]     = useState([]);
  const [activeProjectId,setAP]    = useState(null);
  const [ticketMap,setTMap]        = useState({});
  const [memberMap,setMMap]        = useState({});
  const [epicMap,setEMap]          = useState({});
  const [stats,setStats]           = useState(null);
  const [view,setView]             = useState("kanban");
  const [modal,setModal]           = useState(null);
  const [selectedId,setSelId]      = useState(null);
  const [search,setSearch]         = useState("");
  const [fPri,setFPri]             = useState("");
  const [fStat,setFStat]           = useState("");
  const [fEpic,setFEpic]           = useState("");
  const [fAssignee,setFAssignee]   = useState("");
  const [loading,setLoad]          = useState(false);
  const [sidebar,setSidebar]       = useState(true);
  const [appReady,setAppReady]     = useState(false);
  const [showToast,toastEl]        = useToast();
  const dragRef                    = useRef(null);
  const [over,setOver]             = useState(null);

  const tickets  = activeProjectId?(ticketMap[activeProjectId]||[]):[];
  const members  = activeProjectId?(memberMap[activeProjectId]||[]):[];
  const epics    = activeProjectId?(epicMap[activeProjectId]||[]):[];
  const activeWs = workspaces.find(w=>w._id===activeWsId);
  const activeWsRole = (() => {
    if (!activeWs||!user) return "member";
    const oid = String(activeWs.ownerId?._id||activeWs.ownerId||"");
    if (oid===String(user._id)) return "owner";
    const m = activeWs.members?.find(m=>String(m.userId?._id||m.userId||"")===String(user._id));
    return m?.role||"member";
  })();

  /* ── Bootstrap: always fetches fresh data from server ───── */
  const bootstrap = useCallback(async () => {
    try {
      const data = await API.auth.bootstrap();
      const freshUser = data.user;
      API.setStoredUser(freshUser);
      setUser(freshUser);

      const wsList = data.workspaces||[];
      setWS(wsList);

      if (wsList.length) {
        // Use server-preferred workspace, fallback to first
        const wsId = data.activeWorkspaceId
          ? String(data.activeWorkspaceId)
          : String(wsList[0]._id);
        API.setActiveWs(wsId);
        setActiveWsId(wsId);
      } else {
        setActiveWsId(null);
      }
    } catch(e) {
      // Token expired or invalid — clear and show login
      API.clearTokens();
      setUser(null);
      setWS([]); setProjects([]); setActiveWsId(null);
    } finally {
      setAppReady(true);
    }
  }, []);

  // On mount: check if we have a valid token and bootstrap
  useEffect(()=>{
    const token = API.getAccessToken();
    const storedUser = API.getStoredUser();
    if (token && storedUser) {
      bootstrap();
    } else {
      setAppReady(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load projects whenever active workspace changes
  useEffect(()=>{
    if (!activeWsId||!user) return;
    setProjects([]); setAP(null);
    setTMap({}); setMMap({}); setEMap({});
    API.projects.list(activeWsId)
      .then(d=>{
        const projs = d.projects||[];
        setProjects(projs);
        if (projs.length) setAP(projs[0]._id);
      })
      .catch(e=>showToast("Failed to load projects: "+e.message,"error"));
  },[activeWsId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tickets + members + epics when active project changes
  useEffect(()=>{
    if (!activeProjectId) return;
    setLoad(true);
    setSearch(""); setFPri(""); setFStat(""); setFEpic(""); setFAssignee("");
    Promise.all([
      API.tickets.list(activeProjectId,{}),
      API.projects.stats(activeProjectId),
      API.projects.get(activeProjectId),
      API.epics.list(activeProjectId),
    ]).then(([td,sd,pd,ed])=>{
      setTMap(prev=>({...prev,[activeProjectId]:td.tickets||[]}));
      setStats(sd.stats);
      setMMap(prev=>({...prev,[activeProjectId]:pd.project?.members||[]}));
      setEMap(prev=>({...prev,[activeProjectId]:ed.epics||[]}));
    }).catch(e=>showToast("Failed to load project: "+e.message,"error"))
      .finally(()=>setLoad(false));
  },[activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = projects.find(p=>p._id===activeProjectId);

  /* ── Auth ────────────────────────────────────────────────── */
  const handleLogin = async (loggedInUser) => {
    // After login, bootstrap to get fresh workspace/project data
    await bootstrap();
  };

  const logout = async () => {
    try { await API.auth.logout(API.getRefreshToken()); } catch{}
    API.clearTokens(); API.setActiveWs(null);
    setUser(null); setWS([]); setProjects([]); setAP(null);
    setTMap({}); setMMap({}); setEMap({}); setActiveWsId(null);
    setStats(null); setAppReady(false);
    // Re-show login
    setTimeout(()=>setAppReady(true), 50);
  };

  /* ── Workspace actions ───────────────────────────────────── */
  const switchWorkspace = (wsId) => {
    const id = String(wsId);
    setActiveWsId(id);
    API.setActiveWs(id);
    // Persist preference on server
    API.auth.updateMe({ activeWorkspaceId: id }).catch(()=>{});
  };

  const createWorkspace = async (name,desc,color) => {
    try {
      const d = await API.workspaces.create({name,description:desc,color});
      const ws = d.workspace;
      setWS(prev=>[ws,...prev]);
      setActiveWsId(String(ws._id));
      API.setActiveWs(String(ws._id));
      showToast("Workspace created 🎉");
    } catch(e) { showToast(e.message,"error"); }
  };

  /* ── Project actions ─────────────────────────────────────── */
  const createProject = async (name,desc,color) => {
    if (!activeWsId) { showToast("Create a workspace first","warn"); return; }
    try {
      const d = await API.projects.create({name,description:desc,color,icon:"🐞",workspaceId:activeWsId});
      setProjects(prev=>[d.project,...prev]);
      setAP(d.project._id);
      setWS(prev=>prev.map(w=>w._id===activeWsId?{...w,_projectCount:(w._projectCount||0)+1}:w));
      showToast("Project created ✓");
    } catch(e) { showToast(e.message,"error"); }
  };

  /* ── Ticket actions ──────────────────────────────────────── */
  const setProjectTickets = (pid,fn) =>
    setTMap(prev=>({...prev,[pid]:typeof fn==="function"?fn(prev[pid]||[]):fn}));

  const onTicketUpdated = t =>
    setProjectTickets(activeProjectId, ts=>ts.map(x=>x._id===t._id?t:x));

  const onTicketCreated = t => {
    setProjectTickets(activeProjectId, ts=>[t,...ts]);
    setStats(prev=>prev?{...prev,
      totalTickets:(prev.totalTickets||0)+1,
      openTickets:(prev.openTickets||0)+1
    }:prev);
  };

  const dropTicket = async (ticket,newStatus) => {
    if (ticket.status===newStatus) return;
    onTicketUpdated({...ticket,status:newStatus}); // optimistic
    try {
      const d = await API.tickets.update(ticket._id,{status:newStatus});
      onTicketUpdated(d.ticket);
      // refresh stats
      API.projects.stats(activeProjectId).then(sd=>setStats(sd.stats)).catch(()=>{});
    } catch(e) { onTicketUpdated(ticket); showToast(e.message,"error"); }
  };

  const deleteTicket = async (id) => {
    if (!confirm("Delete this ticket?")) return;
    try {
      await API.tickets.delete(id);
      setProjectTickets(activeProjectId, ts=>ts.filter(t=>t._id!==id));
      showToast("Ticket deleted");
      API.projects.stats(activeProjectId).then(sd=>setStats(sd.stats)).catch(()=>{});
    } catch(e) { showToast(e.message,"error"); }
  };

  /* ── Member actions ──────────────────────────────────────── */
  const onMemberAdded = (newMembers) =>
    setMMap(prev=>({...prev,[activeProjectId]:newMembers}));

  const onMemberRemoved = (uid) =>
    setMMap(prev=>({
      ...prev,[activeProjectId]:(prev[activeProjectId]||[]).filter(m=>
        String(m.userId?._id||m._id||m.userId)!==String(uid))
    }));

  /* ── Epic actions ────────────────────────────────────────── */
  const refreshEpics = async () => {
    if (!activeProjectId) return;
    try {
      const d = await API.epics.list(activeProjectId);
      setEMap(prev=>({...prev,[activeProjectId]:d.epics||[]}));
    } catch(e) {}
  };

  /* ── Loading screen ──────────────────────────────────────── */
  if (!appReady) return (
    <div style={{minHeight:"100vh",background:"#07080a",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:44}}>🐞</div>
      <Spinner size={28}/>
      <div style={{color:"#5a6478",fontSize:13,fontFamily:"monospace"}}>Loading BUGTRACKER…</div>
    </div>
  );

  if (!user) return <AuthScreen onLogin={handleLogin}/>;

  /* ── Filtering (client-side, instant) ───────────────────── */
  const filtered=tickets.filter(t=>{
    if(fPri && t.priority!==fPri) return false;
    if(fStat && t.status!==fStat) return false;
    if(fEpic && String(t.epicId)!==String(fEpic)) return false;
    if(fAssignee && String(t.assigneeId?._id||t.assigneeId)!==String(fAssignee)) return false;
    if(search){
      const q=search.toLowerCase();
      return t.title.toLowerCase().includes(q)||t.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const byStatus=s=>filtered.filter(t=>t.status===s);

  return (
    <div style={{display:"flex",height:"100vh",background:T.bg,color:T.text,fontFamily:"'JetBrains Mono',monospace",overflow:"hidden"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:${T.bg2}}
        ::-webkit-scrollbar-thumb{background:${T.border2};border-radius:3px}
        input:focus,select:focus,textarea:focus{border-color:${T.accent}!important;box-shadow:0 0 0 3px ${T.accent}22}
        *{box-sizing:border-box} button:not([disabled]):hover{filter:brightness(1.12)}
      `}</style>

      {/* ── SIDEBAR ── */}
      {sidebar&&(
        <aside style={{width:240,background:T.bg2,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
          {/* Workspace selector */}
          <div style={{padding:"14px 14px",borderBottom:`1px solid ${T.border}`}}>
            <button onClick={()=>setModal("workspaces")}
              style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:T.surface,
                border:`1px solid ${T.border2}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left"}}>
              <div style={{width:32,height:32,borderRadius:8,background:activeWs?.color||T.accent,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                {activeWs?.icon||"🏢"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:T.text,fontWeight:700,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {activeWs?.name||"Select Workspace"}
                </div>
                <div style={{color:T.muted,fontSize:9}}>{activeWsRole} · click to switch</div>
              </div>
              <span style={{color:T.muted,fontSize:12}}>⌄</span>
            </button>
          </div>

          {/* Workspace actions */}
          {activeWs&&(
            <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:6}}>
              <button onClick={()=>setModal("analytics")} style={{...css.btn("ghost"),flex:1,fontSize:10,padding:"5px"}}>📈 Analytics</button>
              <button onClick={()=>setModal("wsSettings")} style={{...css.btn("ghost"),flex:1,fontSize:10,padding:"5px"}}>⚙️ Settings</button>
            </div>
          )}

          {/* Projects */}
          <div style={{padding:"10px 10px 6px"}}>
            <div style={{color:T.muted,fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8,paddingLeft:4}}>Projects</div>
            {projects.map(p=>(
              <button key={p._id} onClick={()=>setAP(p._id)}
                style={{display:"block",width:"100%",textAlign:"left",padding:"8px 12px",borderRadius:8,border:"none",
                  background:activeProjectId===p._id?T.surface:"transparent",
                  color:activeProjectId===p._id?T.text:T.muted,fontSize:12,cursor:"pointer",marginBottom:2,
                  borderLeft:`2px solid ${activeProjectId===p._id?p.color||T.accent:"transparent"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:p.color||T.accent,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontWeight:700,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                </div>
                <span style={{fontSize:9,color:T.muted,display:"block",paddingLeft:14,marginTop:1}}>{p._openCount||0} open</span>
              </button>
            ))}
            <button onClick={()=>setModal("newProject")} style={{display:"block",width:"100%",textAlign:"left",
              padding:"7px 12px",borderRadius:8,border:`1px dashed ${T.border}`,
              background:"transparent",color:T.muted,fontSize:11,cursor:"pointer",marginTop:4}}>+ New Project</button>
          </div>

          {/* Views */}
          <div style={{padding:"6px 10px"}}>
            <div style={{color:T.muted,fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:8,paddingLeft:4}}>Views</div>
            {[["kanban","⬛ Kanban"],["list","☰ List"],["epics","⚡ Epics"],["metrics","◎ Metrics"]].map(([v,l])=>(
              <button key={v} onClick={()=>setView(v)}
                style={{display:"block",width:"100%",textAlign:"left",padding:"7px 12px",borderRadius:8,border:"none",
                  background:view===v?T.surface:"transparent",color:view===v?T.text:T.muted,
                  fontSize:12,cursor:"pointer",marginBottom:2,borderLeft:`2px solid ${view===v?T.accent:"transparent"}`}}>{l}</button>
            ))}
          </div>

          <div style={{margin:"8px 10px 0",padding:"10px 12px",background:T.bg3,borderRadius:8,border:`1px solid ${T.border}`}}>
            <div style={{color:T.green,fontSize:10,fontWeight:700,marginBottom:3}}>🟢 MongoDB · Bug Tracking</div>
            <div style={{color:T.muted,fontSize:9}}>Workspaces · Epics · Analytics</div>
          </div>

          <div style={{marginTop:"auto",padding:"12px",borderTop:`1px solid ${T.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <Avatar name={user.name} color={user.color} size={30} src={user.googleAvatar}/>
              <div style={{flex:1,overflow:"hidden"}}>
                <div style={{color:T.text,fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
                <div style={{color:T.muted,fontSize:9}}>{user.provider==="google"?"Google · ":""}{user.role}</div>
              </div>
            </div>
            <button onClick={()=>setModal("tokens")} style={{...css.btn("ghost"),width:"100%",fontSize:10,marginBottom:6,padding:"6px"}}>🔑 API Tokens</button>
            <button onClick={logout} style={{...css.btn("ghost"),width:"100%",fontSize:10,padding:"6px",color:T.red}}>→ Sign Out</button>
          </div>
        </aside>
      )}

      {/* ── MAIN ── */}
      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Header */}
        <header style={{borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",alignItems:"center",
          gap:12,flexShrink:0,background:`linear-gradient(90deg,${T.bg2},${T.bg})`}}>
          <button onClick={()=>setSidebar(s=>!s)} style={{...css.btn("ghost"),padding:"6px 10px",fontSize:13}}>☰</button>
          {project&&(
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span>{project.icon||"🐞"}</span>
              <span style={{color:T.text,fontWeight:700,fontSize:14}}>{project.name}</span>
              <span style={{color:T.muted,fontSize:12}}>/</span>
              <span style={{color:T.muted,fontSize:12,textTransform:"capitalize"}}>{view}</span>
            </div>
          )}
          <div style={{display:"flex",gap:6,marginLeft:"auto",alignItems:"center",flexWrap:"wrap"}}>
            {stats&&[
              {l:"Open",v:stats.openTickets,c:T.accent},
              {l:"Done",v:stats.doneTickets,c:T.green},
              {l:"Critical",v:stats.byPriority?.Critical||0,c:T.red},
            ].map(s=>(
              <div key={s.l} style={{background:T.surface,border:`1px solid ${s.c}33`,borderRadius:8,padding:"4px 12px",textAlign:"center"}}>
                <div style={{color:s.c,fontWeight:800,fontSize:16,fontFamily:"monospace"}}>{s.v}</div>
                <div style={{color:T.muted,fontSize:9,letterSpacing:"0.08em",textTransform:"uppercase"}}>{s.l}</div>
              </div>
            ))}
            {members.slice(0,5).map((m,i)=>{
              const u=m.userId||m;
              return <span key={i} style={{marginLeft:i===0?4:-6,zIndex:5-i}}>
                <Avatar name={u?.name||"?"} color={u?.color||T.accent} size={26} src={u?.googleAvatar}/>
              </span>;
            })}
            {activeProjectId&&(
              <button onClick={()=>setModal("members")} style={{...css.btn("green"),padding:"7px 14px",fontSize:11}}>👥 Members</button>
            )}
            {activeProjectId&&(
              <button onClick={()=>setModal("epics")} style={{...css.btn("purple"),padding:"7px 14px",fontSize:11}}>⚡ Epics</button>
            )}
            <button onClick={()=>setModal("newTicket")} style={{...css.btn("primary"),padding:"7px 16px"}}>+ Ticket</button>
          </div>
        </header>

        {/* Filter Bar */}
        <div style={{padding:"8px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:8,
          alignItems:"center",flexShrink:0,background:T.bg2,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search tickets…"
            style={{...css.input,width:190,padding:"7px 12px",fontSize:12}}/>
          <select value={fPri} onChange={e=>setFPri(e.target.value)} style={{...css.input,width:"auto",padding:"7px 10px",fontSize:11,cursor:"pointer"}}>
            <option value="">Priority: All</option>
            {PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <select value={fStat} onChange={e=>setFStat(e.target.value)} style={{...css.input,width:"auto",padding:"7px 10px",fontSize:11,cursor:"pointer"}}>
            <option value="">Status: All</option>
            {STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fEpic} onChange={e=>setFEpic(e.target.value)} style={{...css.input,width:"auto",padding:"7px 10px",fontSize:11,cursor:"pointer"}}>
            <option value="">Epic: All</option>
            {epics.map(e=><option key={e._id} value={e._id}>{e.title}</option>)}
          </select>
          <select value={fAssignee} onChange={e=>setFAssignee(e.target.value)} style={{...css.input,width:"auto",padding:"7px 10px",fontSize:11,cursor:"pointer"}}>
            <option value="">Assignee: All</option>
            {members.map(m=>{const u=m.userId||m;return <option key={u?._id||u} value={u?._id||u}>{u?.name||"?"}</option>;})}
          </select>
          {(fPri||fStat||fEpic||fAssignee||search)&&(
            <button onClick={()=>{setFPri("");setFStat("");setFEpic("");setFAssignee("");setSearch("");}}
              style={{...css.btn("ghost"),fontSize:10,padding:"6px 12px"}}>Clear ×</button>
          )}
          <span style={{marginLeft:"auto",color:T.muted,fontSize:11}}>
            {loading?<Spinner/>:`${filtered.length} ticket${filtered.length!==1?"s":""}`}
          </span>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:20,overflowX:view==="kanban"?"auto":"hidden"}}>

          {/* ── KANBAN ── */}
          {view==="kanban"&&(
            <div style={{display:"flex",gap:14,alignItems:"flex-start",minHeight:"100%"}}>
              {STATUSES.map(s=>{
                const sm2=SM[s]; const col=byStatus(s);
                return (
                  <div key={s}
                    onDragOver={e=>{e.preventDefault();setOver(s);}}
                    onDragLeave={()=>setOver(null)}
                    onDrop={e=>{setOver(null);if(dragRef.current){dropTicket(dragRef.current,s);dragRef.current=null;}}}
                    style={{flexShrink:0,width:252,background:over===s?sm2.bg:T.bg2,
                      border:`1px solid ${over===s?sm2.color+"66":T.border}`,
                      borderRadius:12,padding:"14px 12px",transition:"all 0.15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                      <span style={{color:sm2.color,fontSize:14}}>{sm2.icon}</span>
                      <span style={{color:T.text,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:"0.08em"}}>{s}</span>
                      <span style={{marginLeft:"auto",background:sm2.bg,color:sm2.color,border:`1px solid ${sm2.color}44`,
                        borderRadius:10,padding:"1px 8px",fontSize:10,fontWeight:700}}>{col.length}</span>
                    </div>
                    {col.map(t=>(
                      <KanbanCard key={t._id} ticket={t} epics={epics}
                        onClick={()=>{setSelId(t._id);setModal("detail");}}
                        onDragStart={(_,tk)=>{dragRef.current=tk;}}/>
                    ))}
                    {col.length===0&&(
                      <div style={{textAlign:"center",color:over===s?sm2.color+"88":T.border2,fontFamily:"monospace",
                        fontSize:11,padding:"28px 0",border:`1px dashed ${over===s?sm2.color+"55":T.border}`,
                        borderRadius:8,transition:"all 0.15s"}}>
                        {over===s?"Release to move":"Drop here"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── LIST ── */}
          {view==="list"&&(
            <div style={{maxWidth:1060}}>
              <div style={{display:"grid",gridTemplateColumns:"30px 1fr 80px 100px 80px 120px 60px 30px",gap:10,
                padding:"8px 14px",borderBottom:`1px solid ${T.border}`,marginBottom:4}}>
                {["","Title","Priority","Status","Epic","Assignee","Est",""].map((h,i)=>(
                  <span key={i} style={{color:T.muted,fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase"}}>{h}</span>
                ))}
              </div>
              {filtered.length===0&&!loading&&(
                <div style={{color:T.muted,textAlign:"center",padding:60,fontSize:12}}>
                  {tickets.length===0?"No tickets yet — create one!":"No tickets match your filters."}
                </div>
              )}
              {filtered.map(t=>{
                const pm2=PM[t.priority]||PM.Medium;
                const sm2=SM[t.status]||SM["To Do"];
                const a=t.assigneeId;
                const ep=epics.find(e=>e._id===t.epicId||e._id===String(t.epicId));
                return (
                  <div key={t._id} onClick={()=>{setSelId(t._id);setModal("detail");}}
                    style={{display:"grid",gridTemplateColumns:"30px 1fr 80px 100px 80px 120px 60px 30px",gap:10,
                      padding:"10px 14px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",
                      borderRadius:8,borderLeft:`3px solid ${pm2.color}`,transition:"background 0.1s",marginBottom:2}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{color:pm2.color,display:"flex",alignItems:"center"}}>{pm2.icon}</span>
                    <div style={{overflow:"hidden"}}>
                      <div style={{color:T.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                      <div style={{display:"flex",gap:5,marginTop:3}}>{t.labels?.map(l=><Tag key={l}>{l}</Tag>)}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center"}}><Badge label={t.priority} color={pm2.color} bg={pm2.bg} small/></div>
                    <div style={{display:"flex",alignItems:"center"}}><Badge label={t.status} color={sm2.color} bg={sm2.bg} small/></div>
                    <div style={{display:"flex",alignItems:"center"}}>
                      {ep&&<span style={{color:T.purple,fontSize:10,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>⚡{ep.title}</span>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {a&&<><Avatar name={a.name} color={a.color} size={20}/><span style={{fontSize:11,color:T.muted,overflow:"hidden",textOverflow:"ellipsis"}}>{a.name}</span></>}
                    </div>
                    <div style={{display:"flex",alignItems:"center"}}><span style={{color:T.accent,fontSize:11,fontWeight:700}}>{t.estimate}h</span></div>
                    <button onClick={e=>{e.stopPropagation();deleteTicket(t._id);}}
                      style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center"}}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── EPICS VIEW ── */}
          {view==="epics"&&(
            <div style={{maxWidth:900}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{color:T.text,fontWeight:700,fontSize:14}}>⚡ Project Epics</div>
                <button onClick={()=>setModal("epics")} style={{...css.btn("purple"),fontSize:11,padding:"7px 16px"}}>Manage Epics</button>
              </div>
              {epics.length===0?(
                <div style={{color:T.muted,textAlign:"center",padding:60,fontSize:12}}>
                  No epics yet.<br/>Epics help group related tickets into larger features.
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {epics.map(ep=>{
                    const es=EPIC_STATUS[ep.status]||EPIC_STATUS.planned;
                    const epicTickets=tickets.filter(t=>String(t.epicId)===String(ep._id));
                    const done=epicTickets.filter(t=>t.status==="Done").length;
                    const pct=epicTickets.length>0?Math.round((done/epicTickets.length)*100):0;
                    return (
                      <div key={ep._id} style={{background:T.surface,border:`1px solid ${ep.color||T.border}44`,
                        borderRadius:12,padding:"18px 20px",borderLeft:`4px solid ${ep.color||T.purple}`}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                          <div style={{flex:1}}>
                            <div style={{color:T.text,fontSize:15,fontWeight:800,marginBottom:4}}>{ep.title}</div>
                            {ep.description&&<div style={{color:T.muted,fontSize:12}}>{ep.description}</div>}
                          </div>
                          <Badge label={es.label} color={es.color} small/>
                          <Badge label={ep.priority} color={PM[ep.priority]?.color||T.muted} bg={PM[ep.priority]?.bg} small/>
                        </div>
                        <div style={{marginBottom:10}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{color:T.muted,fontSize:11}}>{done}/{epicTickets.length} tickets done</span>
                            <span style={{color:ep.color||T.purple,fontSize:11,fontWeight:700}}>{pct}%</span>
                          </div>
                          <ProgressBar value={pct} color={ep.color||T.purple} height={8}/>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          {STATUSES.map(st=>{
                            const cnt=epicTickets.filter(t=>t.status===st).length;
                            if(cnt===0) return null;
                            return <Badge key={st} label={`${SM[st].icon} ${st}: ${cnt}`} color={SM[st].color} bg={SM[st].bg} small/>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── METRICS ── */}
          {view==="metrics"&&stats&&(
            <div style={{maxWidth:940}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:20}}>
                {[
                  {l:"Total Tickets",v:stats.totalTickets,c:T.accent},
                  {l:"Open",v:stats.openTickets,c:T.orange},
                  {l:"Resolved",v:stats.doneTickets,c:T.green},
                  {l:"Team Size",v:stats.members,c:T.purple},
                ].map(s=>(
                  <div key={s.l} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"16px 18px"}}>
                    <div style={{color:s.c,fontWeight:800,fontSize:28,fontFamily:"monospace"}}>{s.v}</div>
                    <div style={{color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"18px"}}>
                  <div style={{color:T.text,fontWeight:700,fontSize:12,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.08em"}}>By Priority</div>
                  {PRIORITIES.map(p=>{
                    const count=stats.byPriority?.[p]||0;
                    const pct=stats.totalTickets>0?Math.round((count/stats.totalTickets)*100):0;
                    return (
                      <div key={p} style={{marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{color:PM[p].color,fontSize:11}}>{PM[p].icon} {p}</span>
                          <span style={{color:T.muted,fontSize:11}}>{count}</span>
                        </div>
                        <ProgressBar value={pct} color={PM[p].color}/>
                      </div>
                    );
                  })}
                </div>
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"18px"}}>
                  <div style={{color:T.text,fontWeight:700,fontSize:12,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.08em"}}>By Status</div>
                  {STATUSES.map(s=>{
                    const count=stats.byStatus?.[s]||0;
                    const pct=stats.totalTickets>0?Math.round((count/stats.totalTickets)*100):0;
                    return (
                      <div key={s} style={{marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{color:SM[s].color,fontSize:11}}>{SM[s].icon} {s}</span>
                          <span style={{color:T.muted,fontSize:11}}>{count}</span>
                        </div>
                        <ProgressBar value={pct} color={SM[s].color}/>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Epic progress in metrics */}
              {epics.length>0&&(
                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"18px"}}>
                  <div style={{color:T.text,fontWeight:700,fontSize:12,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.08em"}}>⚡ Epic Progress</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {epics.map(ep=>{
                      const epicTs=tickets.filter(t=>String(t.epicId)===String(ep._id));
                      const done=epicTs.filter(t=>t.status==="Done").length;
                      const pct=epicTs.length>0?Math.round((done/epicTs.length)*100):0;
                      return (
                        <div key={ep._id}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                            <span style={{color:ep.color||T.purple,fontSize:12,fontWeight:700}}>⚡ {ep.title}</span>
                            <span style={{color:T.muted,fontSize:11}}>{done}/{epicTs.length} · {pct}%</span>
                          </div>
                          <ProgressBar value={pct} color={ep.color||T.purple} height={8}/>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── MODALS ── */}
      {modal==="workspaces"&&(
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWs={activeWsId}
          onSwitch={id=>{ switchWorkspace(id); setModal(null); }}
          onCreate={createWorkspace}
          onClose={()=>setModal(null)}
        />
      )}
      {modal==="analytics"&&activeWs&&(
        <AnalyticsDashboard wsId={activeWs._id} wsName={activeWs.name} onClose={()=>setModal(null)}/>
      )}
      {modal==="wsSettings"&&activeWs&&(
        <WorkspaceSettings
          ws={activeWs}
          myRole={activeWsRole}
          onClose={()=>setModal(null)}
          showToast={showToast}
          onUpdated={ws=>setWS(prev=>prev.map(w=>w._id===ws._id?ws:w))}
        />
      )}
      {modal==="newTicket"&&activeProjectId&&(
        <TicketForm projectId={activeProjectId} members={members} epics={epics}
          onSaved={onTicketCreated} onClose={()=>setModal(null)} showToast={showToast}/>
      )}
      {modal==="detail"&&selId&&(
        <TicketDetail ticketId={selId} members={members} epics={epics}
          onUpdated={onTicketUpdated} onClose={()=>{setModal(null);setSelId(null);}} showToast={showToast}/>
      )}
      {modal==="members"&&activeProjectId&&(
        <AddMemberModal projectId={activeProjectId} currentMembers={members}
          onMemberAdded={onMemberAdded} onMemberRemoved={onMemberRemoved}
          onClose={()=>setModal(null)} showToast={showToast}/>
      )}
      {modal==="epics"&&activeProjectId&&(
        <EpicsPanel projectId={activeProjectId} members={members}
          onClose={()=>{setModal(null);refreshEpics();}} showToast={showToast}/>
      )}
      {modal==="newProject"&&(
        <NewProjectModal onCreate={createProject} onClose={()=>setModal(null)}/>
      )}
      {modal==="tokens"&&(
        <TokenManager onClose={()=>setModal(null)} showToast={showToast}/>
      )}

      {toastEl}
    </div>
  );
}

/* ── New Project Modal ─────────────────────────────────────── */
function NewProjectModal({ onCreate, onClose }) {
  const [pn,setPn]=useState(""); const [pd,setPd]=useState(""); const [pc,setPc]=useState("#3b82f6");
  return (
    <Modal title="New Project" onClose={onClose} width={440}>
      <Field label="Name"><input value={pn} onChange={e=>setPn(e.target.value)} placeholder="My Project" style={css.input} autoFocus/></Field>
      <Field label="Description"><textarea value={pd} onChange={e=>setPd(e.target.value)} rows={2} style={{...css.input,resize:"vertical"}}/></Field>
      <Field label="Color">
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316"].map(c=>(
            <div key={c} onClick={()=>setPc(c)} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",
              border:pc===c?`3px solid ${T.text}`:"3px solid transparent"}}/>
          ))}
        </div>
      </Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:8}}>
        <button onClick={onClose} style={css.btn("ghost")}>Cancel</button>
        <button onClick={()=>{if(pn.trim()){onCreate(pn,pd,pc);onClose();}}} style={css.btn("primary")}>Create Project</button>
      </div>
    </Modal>
  );
}

/* ── Token Manager ─────────────────────────────────────────── */
function TokenManager({ onClose, showToast }) {
  const [list,setList]   = useState([]);
  const [load,setLoad]   = useState(true);
  const [label,setLabel] = useState("");
  const [scope,setScope] = useState("full_access");
  const [expiry,setExp]  = useState("never");
  const [newTok,setNew]  = useState(null);
  const [copied,setCopy] = useState(false);
  const SCOPES=["full_access","read_only","issues_only","admin","ci_cd"];

  const reload=useCallback(async()=>{
    setLoad(true);
    try{const d=await API.tokens.list();setList(d.tokens||[]);}catch(e){showToast(e.message,"error");}
    setLoad(false);
  },[showToast]);

  useEffect(()=>{reload();},[reload]);

  const generate=async()=>{
    if(!label.trim()) return;
    try{
      const expiresAt=expiry==="never"?null:new Date(Date.now()+(expiry==="7d"?7:30)*86400000).toISOString();
      const d=await API.tokens.create({label,scope,expiresAt});
      setNew(d.token); setLabel(""); showToast("Token generated!"); reload();
    }catch(e){showToast(e.message,"error");}
  };

  const revoke=async(id)=>{
    try{await API.tokens.revoke(id);showToast("Revoked");reload();}
    catch(e){showToast(e.message,"error");}
  };

  const copy=t=>{
    const v=typeof t==="object"?t.token:t;
    navigator.clipboard.writeText(v).catch(()=>{});
    setCopy(true);setTimeout(()=>setCopy(false),2000);
  };

  return (
    <Modal title="🔑 API Token Manager" onClose={onClose} width={700}>
      {newTok&&(
        <div style={{background:T.goldLo,border:`1px solid ${T.gold}55`,borderRadius:10,padding:16,marginBottom:20}}>
          <div style={{color:T.gold,fontWeight:700,fontSize:12,marginBottom:8}}>⚠ Copy now — won't show again</div>
          <div style={{fontFamily:"monospace",fontSize:11,color:"#d4b483",background:T.bg,borderRadius:6,padding:"10px 12px",wordBreak:"break-all",marginBottom:8}}>{newTok.token||newTok}</div>
          <button onClick={()=>copy(newTok)} style={{...css.btn("gold"),fontSize:11,padding:"6px 16px"}}>{copied?"✓ Copied!":"Copy Token"}</button>
        </div>
      )}
      <div style={{background:T.bg,borderRadius:10,padding:16,border:`1px solid ${T.border}`,marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
          <Field label="Label"><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="CI Pipeline" style={css.input}/></Field>
          <Field label="Scope"><Sel value={scope} onChange={setScope} options={SCOPES.map(s=>({v:s,l:s.replace("_"," ")}))}/></Field>
          <Field label="Expiry"><Sel value={expiry} onChange={setExp} options={[{v:"never",l:"Never"},{v:"7d",l:"7 days"},{v:"30d",l:"30 days"}]}/></Field>
        </div>
        <button onClick={generate} style={{...css.btn("gold"),width:"100%"}}>⚡ Generate Token</button>
      </div>
      {load?<div style={{textAlign:"center",padding:24}}><Spinner size={20}/></div>:(
        <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:300,overflowY:"auto"}}>
          {list.length===0&&<div style={{color:T.muted,textAlign:"center",padding:24,fontSize:12}}>No tokens yet.</div>}
          {list.map(t=>{
            const expired=t.expiresAt&&new Date(t.expiresAt)<new Date();
            return (
              <div key={t._id} style={{background:T.surface,border:`1px solid ${T.border2}`,borderRadius:10,padding:"12px 14px",opacity:t.isActive&&!expired?1:0.5}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:T.text,fontWeight:700,fontSize:13,flex:1}}>{t.label}</span>
                  <Badge label={t.scope.replace("_"," ")} color={T.purple} small/>
                  {!t.isActive&&<Badge label="Revoked" color={T.red} small/>}
                  {expired&&<Badge label="Expired" color={T.orange} small/>}
                  {t.isActive&&!expired&&<Badge label="Active" color={T.green} small/>}
                  {t.isActive&&!expired&&<button onClick={()=>revoke(t._id)} style={{...css.btn("danger"),fontSize:10,padding:"4px 10px"}}>Revoke</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
