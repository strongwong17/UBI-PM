// PM2 ecosystem config for UBInsights PMT
// Docs: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: "ubinsights-pmt",
      script: "server.js",
      cwd: "/opt/ubinsights-pmt",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
        HOSTNAME: "0.0.0.0",
      },
      // Restart policy
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 5000,
      // Logging
      error_file: "/opt/ubinsights-pmt/logs/error.log",
      out_file: "/opt/ubinsights-pmt/logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
