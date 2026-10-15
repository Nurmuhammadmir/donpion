// PM2 process definitions for the Valentino brand deployment — sibling to
// the root ecosystem.config.js (donpion), same pattern: `server` and
// `client` run in production mode under PM2, `admin` is a static SPA built
// to admin/dist/ and served by Nginx, not run as a Node process.
//
// Usage on the VPS, from inside this valentino/ folder, after `npm install`
// + `npm run build` in server/ and client/:
//   pm2 start ecosystem.config.js
//   pm2 save
module.exports = {
  apps: [
    {
      name: "valentino-server",
      cwd: "./server",
      script: "src/server.js",
      env: { NODE_ENV: "production" },
      max_memory_restart: "300M",
    },
    {
      name: "valentino-client",
      cwd: "./client",
      script: ".next/standalone/server.js",
      env: { NODE_ENV: "production", PORT: 3001 },
      max_memory_restart: "300M",
    },
  ],
};
