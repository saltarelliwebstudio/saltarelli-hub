/**
 * PM2 Ecosystem Configuration
 * Deploy with: pm2 start ecosystem.config.cjs
 */

module.exports = {
  apps: [
    {
      name: 'saltarelli-sms-drip',
      script: './index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 20,
      env: {
        NODE_ENV: 'production',
      },
      // Log configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
