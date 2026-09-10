// PM2 process definitions for the VPS — keeps `server` and `client`
// running in production mode (never `npm run dev`/`next dev`, which are
// dev-only watchers with real memory overhead), auto-restarts them on
// crash, and caps memory per process so one runaway process can't take
// down every other project sharing the same box.
//
// `admin` is intentionally not listed here — it's a static SPA
// (`npm run build` in admin/ produces admin/dist/), meant to be served
// directly by Nginx as static files, not run as a Node process.
//
// Usage on the VPS, after `npm install` + `npm run build` in each folder:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   (prints a command to run once, so PM2 survives a reboot)
module.exports = {
  apps: [
    {
      name: "donpion-server",
      cwd: "./server",
      script: "src/server.js",
      env: { NODE_ENV: "production" },
      max_memory_restart: "300M",
    },
    {
      name: "donpion-client",
      cwd: "./client",
      // Requires `npm run build` in client/ first (its own `postbuild`
      // script copies public/ and .next/static into .next/standalone/).
      script: ".next/standalone/server.js",
      env: { NODE_ENV: "production", PORT: 3000 },
      max_memory_restart: "300M",
    },
  ],
};
