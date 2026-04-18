// src/utils/seed.js
require("dotenv").config();
const mongoose = require("mongoose");

const User      = require("../models/User");
const Token     = require("../models/Token");
const Workspace = require("../models/Workspace");
const Project   = require("../models/Project");
const Ticket    = require("../models/Ticket");
const Comment   = require("../models/Comment");
const Activity  = require("../models/Activity");
const Epic      = require("../models/Epic");
const { signApiToken } = require("./jwt");

const URI = process.env.MONGODB_URI;
const COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ef4444","#ec4899"];

async function seed() {
  await mongoose.connect(URI);
  console.log("🔌 Connected:", URI);

  await Promise.all([
    User.deleteMany(), Token.deleteMany(), Workspace.deleteMany(),
    Project.deleteMany(), Ticket.deleteMany(), Comment.deleteMany(),
    Activity.deleteMany(), Epic.deleteMany(),
  ]);
  console.log("🗑  Cleared data");

  // ── Users ──────────────────────────────────────────────────
  const usersRaw = [
    { name:"Admin",     email:"admin@example.com", password:"admin123",  role:"admin"  },
    { name:"Dev",   email:"dev@example.com",   password:"dev123",    role:"member" },
    { name:"Sam",    email:"sam@example.com",    password:"sam123",     role:"member" },
    { name:"Prem",  email:"prem@example.com", password:"prem123",  role:"member" },
    { name:"Saie",  email:"saie@example.com",  password:"saie123",   role:"viewer" },
  ];
  const users = [];
  for (let i=0; i<usersRaw.length; i++) {
    const u = usersRaw[i];
    const passwordHash = await User.hashPassword(u.password);
    users.push(await User.create({ name:u.name, email:u.email, passwordHash, role:u.role,
      avatar:u.name[0].toUpperCase(), color:COLORS[i%COLORS.length] }));
  }
  const [admin,dev,sam,prem,saie] = users;
  console.log(`👤 ${users.length} users`);

  // ── Workspace ─────────────────────────────────────────────
  const ws = await Workspace.create({
    name:"BUGTRACKER HQ", slug:"bugtracker-hq",
    description:"Main company workspace", color:"#3b82f6", icon:"🏢",
    ownerId: admin._id,
    members:[
      {userId:admin._id,role:"owner"},
      {userId:dev._id,  role:"admin"},
      {userId:sam._id,   role:"member"},
      {userId:prem._id,role:"member"},
      {userId:saie._id, role:"viewer"},
    ],
  });
  await User.updateMany({}, { activeWorkspaceId: ws._id });
  console.log("🏢 1 workspace");

  // ── Projects ─────────────────────────────────────────────
  const p1 = await Project.create({
    workspaceId:ws._id, name:"Phoenix Platform", slug:"phoenix-platform",
    description:"Core SaaS backend rebuild", color:"#3b82f6", icon:"🔥",
    ownerId:admin._id,
    members:[
      {userId:admin._id,role:"owner"},{userId:dev._id,role:"admin"},
      {userId:sam._id,role:"member"},{userId:prem._id,role:"member"},
    ],
  });
  const p2 = await Project.create({
    workspaceId:ws._id, name:"Atlas Dashboard", slug:"atlas-dashboard",
    description:"Analytics & reporting UI", color:"#10b981", icon:"📊",
    ownerId:dev._id,
    members:[
      {userId:dev._id,role:"owner"},{userId:admin._id,role:"admin"},
      {userId:sam._id,role:"member"},{userId:saie._id,role:"viewer"},
    ],
  });
  console.log("📁 2 projects");

  // ── Epics ─────────────────────────────────────────────────
  const e1 = await Epic.create({
    projectId:p1._id, workspaceId:ws._id, title:"Auth & Security Overhaul",
    description:"Complete rewrite of authentication system", color:"#ef4444",
    status:"in_progress", priority:"High", ownerId:admin._id,
  });
  const e2 = await Epic.create({
    projectId:p1._id, workspaceId:ws._id, title:"Performance Improvements",
    description:"Database and API performance optimizations", color:"#f59e0b",
    status:"planned", priority:"Medium", ownerId:dev._id,
  });
  const e3 = await Epic.create({
    projectId:p2._id, workspaceId:ws._id, title:"Data Visualization Suite",
    description:"All chart and graph components", color:"#8b5cf6",
    status:"in_progress", priority:"High", ownerId:dev._id,
  });
  console.log("⚡ 3 epics");

  // ── Tickets ───────────────────────────────────────────────
  const ticketsData = [
    { projectId:p1._id, workspaceId:ws._id, epicId:e1._id, reporterId:admin._id, assigneeId:dev._id,
      title:"Login returns 500 on invalid email format", priority:"Critical", status:"In Progress",
      description:"POST /auth/login with non-email string returns 500.\nExpected: 400 validation error.",
      labels:["backend","auth","bug"], estimate:3 },
    { projectId:p1._id, workspaceId:ws._id, epicId:e1._id, reporterId:admin._id, assigneeId:sam._id,
      title:"JWT refresh tokens not rotating", priority:"High", status:"To Do",
      description:"Old refresh token stays valid after rotation — security issue.",
      labels:["security","auth"], estimate:5 },
    { projectId:p1._id, workspaceId:ws._id, epicId:e1._id, reporterId:dev._id, assigneeId:dev._id,
      title:"Add Google OAuth2 Sign-In", priority:"High", status:"Review",
      description:"Implement Google Identity Services for SSO login.", labels:["feature","auth"], estimate:8 },
    { projectId:p1._id, workspaceId:ws._id, epicId:e2._id, reporterId:prem._id, assigneeId:admin._id,
      title:"Add TOTP two-factor authentication", priority:"Medium", status:"Backlog",
      description:"RFC 6238 TOTP with QR enrollment flow.", labels:["feature","auth"], estimate:13 },
    { projectId:p1._id, workspaceId:ws._id, epicId:e2._id, reporterId:dev._id, assigneeId:dev._id,
      title:"DB connection pool exhausted under load", priority:"Critical", status:"Done",
      description:"Pool size 5 too small. Increase to 20 + monitoring.", labels:["backend","performance"], estimate:6 },
    { projectId:p1._id, workspaceId:ws._id, reporterId:sam._id, assigneeId:prem._id,
      title:"Add structured API logging", priority:"Low", status:"Backlog",
      description:"Winston JSON logging for all requests.", labels:["devops"], estimate:3 },
    { projectId:p2._id, workspaceId:ws._id, epicId:e3._id, reporterId:sam._id, assigneeId:dev._id,
      title:"Bar charts blank on Safari 17", priority:"High", status:"To Do",
      description:"Recharts SVG viewBox issue on Safari 17.x.", labels:["frontend","bug","safari"], estimate:3 },
    { projectId:p2._id, workspaceId:ws._id, epicId:e3._id, reporterId:dev._id, assigneeId:sam._id,
      title:"CSV export for data tables", priority:"Medium", status:"Review",
      description:"Column selection modal, max 10k rows, UTF-8 BOM.", labels:["feature","export"], estimate:4 },
    { projectId:p2._id, workspaceId:ws._id, reporterId:admin._id, assigneeId:dev._id,
      title:"Dashboard LCP > 8s on 3G", priority:"Medium", status:"Done",
      description:"Unoptimized images, no lazy loading. Fix CWV.", labels:["performance","frontend"], estimate:8 },
    { projectId:p2._id, workspaceId:ws._id, reporterId:prem._id, assigneeId:prem._id,
      title:"Real-time updates via WebSocket", priority:"Low", status:"Backlog",
      description:"Replace 30s polling with Socket.io.", labels:["feature","realtime"], estimate:10 },
  ];

  const tickets = [];
  for (const t of ticketsData) tickets.push(await Ticket.create(t));
  console.log(`🎫 ${tickets.length} tickets`);

  // Status history on done tickets
  await Ticket.findByIdAndUpdate(tickets[4]._id, {
    statusHistory:[
      {from:"Backlog",to:"To Do",changedBy:admin._id,changedAt:new Date(Date.now()-5*86400000)},
      {from:"To Do",to:"In Progress",changedBy:dev._id,changedAt:new Date(Date.now()-3*86400000)},
      {from:"In Progress",to:"Review",changedBy:dev._id,changedAt:new Date(Date.now()-86400000)},
      {from:"Review",to:"Done",changedBy:sam._id,changedAt:new Date()},
    ],
  });

  // Comments
  await Comment.insertMany([
    {ticketId:tickets[0]._id,authorId:dev._id,body:"Traced to missing email validator in middleware. PR #142 incoming."},
    {ticketId:tickets[0]._id,authorId:sam._id,body:"Confirmed on staging. Also triggers with empty string."},
    {ticketId:tickets[0]._id,authorId:admin._id,body:"P0 — blocking release. Prioritize before EOD."},
    {ticketId:tickets[1]._id,authorId:admin._id,body:"Need token family tracking per RFC 6819."},
    {ticketId:tickets[2]._id,authorId:dev._id,body:"Using Google Identity Services library. Draft PR up."},
    {ticketId:tickets[6]._id,authorId:dev._id,body:"ResizeObserver fix needed for async viewBox."},
    {ticketId:tickets[7]._id,authorId:prem._id,body:"Need drag-sortable columns + Select All checkbox."},
  ]);
  console.log("💬 7 comments");

  // API Token
  const adminToken = signApiToken({sub:admin._id,role:admin.role,name:admin.name,scope:"full_access"},null);
  await Token.create({userId:admin._id,token:adminToken,label:"Admin Full Access",scope:"full_access",tokenType:"api",isActive:true});
  console.log("🔑 API token created");

  console.log("\n✅ SEED COMPLETE!\n" + "━".repeat(60));
  console.log("🏢 Workspace: BUGTRACKER HQ");
  console.log("📁 Projects: Phoenix Platform, Atlas Dashboard");
  console.log("⚡ Epics: Auth Overhaul, Performance, Data Viz");
  console.log("\n🔐 Demo Credentials:");
  usersRaw.forEach(u=>console.log(`   ${u.email.padEnd(28)} ${u.password}`));
  console.log("━".repeat(60));

  await mongoose.disconnect();
}

seed().catch(err=>{ console.error("❌ Seed error:", err); process.exit(1); });
