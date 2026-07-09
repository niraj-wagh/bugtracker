// src/utils/access.js
// Centralized membership checks. Admin users always pass.

const isMember = (project, userId, user) => {
  if (user?.role === "admin") return true;
  return (
    project.ownerId.toString() === userId.toString() ||
    project.members.some((m) => m.userId.toString() === userId.toString())
  );
};

const isWsMember = (ws, userId, user) => {
  if (user?.role === "admin") return true;
  return (
    ws.ownerId.toString() === userId.toString() ||
    ws.members.some((m) => m.userId.toString() === userId.toString())
  );
};

module.exports = { isMember, isWsMember };
