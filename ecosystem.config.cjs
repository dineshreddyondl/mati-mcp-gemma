module.exports = {
  apps: [
    {
      name: "su-mati",
      script: "npm",
      args: "run web",
      cwd: "/Users/design/Documents/mati-mcp-gemma",
      restart_delay: 3000,
      max_restarts: 10,
    }
  ]
};