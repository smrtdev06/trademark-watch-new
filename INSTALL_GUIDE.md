# Trademark Monitoring Platform - Ubuntu Installation Guide

Complete guide to deploy this application on an Ubuntu 22.04+ server.

---

## Prerequisites

- Ubuntu 22.04 LTS or later
- Root or sudo access
- Minimum 2GB RAM, 20GB disk
- Domain name (optional, for HTTPS)

---

## 1. System Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx
```

---

## 2. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # Should show v20.x
npm --version
```

---

## 3. Install pnpm

```bash
npm install -g pnpm@latest

# Verify
pnpm --version
```

---

## 4. Install PostgreSQL 15+

```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database and User

```bash
sudo -u postgres psql <<EOF
CREATE USER monitoring_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
CREATE DATABASE monitoring_db OWNER monitoring_user;
GRANT ALL PRIVILEGES ON DATABASE monitoring_db TO monitoring_user;
\c monitoring_db
GRANT ALL ON SCHEMA public TO monitoring_user;
EOF
```

### Run the Migration

```bash
sudo -u postgres psql -d monitoring_db -f /path/to/your/project/migration.sql
```

Or as the application user:

```bash
PGPASSWORD='YOUR_STRONG_PASSWORD_HERE' psql -h localhost -U monitoring_user -d monitoring_db -f migration.sql
```

---

## 5. Clone and Install the Project

```bash
# Clone or copy the project
cd /opt
git clone <your-repo-url> monitoring
cd monitoring

# Install all dependencies
pnpm install
```

---

## 6. Environment Variables

Create `/opt/monitoring/.env`:

```bash
cat > /opt/monitoring/.env <<EOF
# Database
DATABASE_URL=postgresql://monitoring_user:YOUR_STRONG_PASSWORD_HERE@localhost:5432/monitoring_db

# API Server
PORT=8080
SESSION_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
LOG_LEVEL=info

# Optional: ScaleSerp API key (for social watch feature)
# SCALE_SERP_API_KEY=your_key_here
EOF
```

Restrict file permissions:

```bash
chmod 600 /opt/monitoring/.env
```

---

## 7. Build the Project

```bash
cd /opt/monitoring

# Build everything
pnpm run build
```

### Build individual components (if needed):

```bash
# Build shared libraries first
pnpm --filter @workspace/db run build 2>/dev/null || true
pnpm --filter @workspace/api-zod run build 2>/dev/null || true
pnpm --filter @workspace/api-spec run codegen 2>/dev/null || true
pnpm --filter @workspace/api-client-react run build 2>/dev/null || true

# Build API server
pnpm --filter @workspace/api-server run build

# Build frontend
pnpm --filter @workspace/monitoring run build
```

---

## 8. Serve the Frontend with Nginx

The frontend builds into `artifacts/monitoring/dist/`.

### Nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/monitoring <<'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Change to your domain or server IP

    # Frontend (React app)
    root /opt/monitoring/artifacts/monitoring/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    # Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/monitoring /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Enable HTTPS (optional, requires domain):

```bash
sudo certbot --nginx -d your-domain.com
```

---

## 9. Run the API Server with PM2

```bash
# Install PM2
npm install -g pm2

# Create PM2 ecosystem file
cat > /opt/monitoring/ecosystem.config.js <<'EOF'
module.exports = {
  apps: [{
    name: 'monitoring-api',
    cwd: '/opt/monitoring/artifacts/api-server',
    script: './dist/index.mjs',
    node_args: '--enable-source-maps',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
    },
    env_file: '/opt/monitoring/.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/log/monitoring/api-error.log',
    out_file: '/var/log/monitoring/api-out.log',
  }]
};
EOF

# Create log directory
sudo mkdir -p /var/log/monitoring
sudo chown $USER:$USER /var/log/monitoring

# Load environment and start
set -a; source /opt/monitoring/.env; set +a
pm2 start /opt/monitoring/ecosystem.config.js

# Save PM2 process list and set up startup
pm2 save
pm2 startup
# Run the command PM2 outputs (starts API on server boot)
```

---

## 10. Verify the Installation

```bash
# 1. Check API server is running
curl http://localhost:8080/api/health

# 2. Check Nginx is serving the frontend
curl -I http://localhost

# 3. Test login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@monitoring.com","password":"admin123"}'

# 4. Check PM2 status
pm2 status
pm2 logs monitoring-api --lines 20
```

Open your browser and navigate to `http://your-server-ip` or `http://your-domain.com`.

**Default admin login:**
- Email: `admin@monitoring.com`
- Password: `admin123`

---

## 11. Frontend Build for Custom Base Path

If you need the app served under a subpath (e.g., `/app`):

```bash
BASE_PATH=/app pnpm --filter @workspace/monitoring run build
```

Then update your Nginx config to adjust the root and location blocks accordingly.

---

## Quick Reference: Useful Commands

| Task | Command |
|---|---|
| Start API | `pm2 start monitoring-api` |
| Stop API | `pm2 stop monitoring-api` |
| Restart API | `pm2 restart monitoring-api` |
| View API logs | `pm2 logs monitoring-api` |
| Rebuild API | `cd /opt/monitoring && pnpm --filter @workspace/api-server run build` |
| Rebuild frontend | `cd /opt/monitoring && pnpm --filter @workspace/monitoring run build` |
| Rebuild everything | `cd /opt/monitoring && pnpm run build` |
| Run DB migration | `psql -h localhost -U monitoring_user -d monitoring_db -f migration.sql` |
| Sync schema (dev) | `cd /opt/monitoring/lib/db && DATABASE_URL=... pnpm run push` |
| Trigger cron manually | `curl -X POST http://localhost:8080/api/cron/trigger-all -H "Authorization: Bearer <token>"` |
| List cron jobs | `curl http://localhost:8080/api/cron/jobs -H "Authorization: Bearer <token>"` |
| Check Nginx config | `sudo nginx -t` |
| Restart Nginx | `sudo systemctl restart nginx` |
| PostgreSQL shell | `sudo -u postgres psql -d monitoring_db` |

---

## Troubleshooting

### API won't start
```bash
# Check logs
pm2 logs monitoring-api --err --lines 50

# Verify DATABASE_URL
source /opt/monitoring/.env
psql "$DATABASE_URL" -c "SELECT 1"

# Check port availability
sudo lsof -i :8080
```

### Frontend shows blank page
```bash
# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log

# Verify build exists
ls -la /opt/monitoring/artifacts/monitoring/dist/

# Rebuild if needed
cd /opt/monitoring && pnpm --filter @workspace/monitoring run build
```

### Database connection refused
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check pg_hba.conf allows local connections
sudo cat /etc/postgresql/*/main/pg_hba.conf | grep -v '^#'

# Ensure the user can connect
psql -h localhost -U monitoring_user -d monitoring_db -c "SELECT NOW()"
```

### Cron jobs not running
The cron jobs run inside the Node.js process (via `node-cron`), not system crontab.
They start automatically when the API server starts. Check with:
```bash
pm2 logs monitoring-api | grep CRON
```

---

## Architecture Overview

```
                    ┌─────────────────────┐
                    │      Nginx          │
                    │   (Port 80/443)     │
                    └─────┬───────┬───────┘
                          │       │
                  /api/*  │       │  /*
                          │       │
              ┌───────────▼─┐   ┌─▼──────────────┐
              │  API Server │   │  React Frontend │
              │  (Port 8080)│   │  (Static files) │
              │  Express.js │   │  Vite build     │
              │  + Cron Jobs│   │                 │
              └──────┬──────┘   └─────────────────┘
                     │
              ┌──────▼──────┐
              │ PostgreSQL  │
              │  Database   │
              └─────────────┘
```

---

## Project Structure

```
/opt/monitoring/
├── artifacts/
│   ├── api-server/          # Express.js backend
│   │   ├── src/
│   │   │   ├── routes/      # API route handlers
│   │   │   ├── cron/        # Cron job definitions
│   │   │   └── lib/         # Auth, logger, utils
│   │   └── dist/            # Built output (index.mjs)
│   └── monitoring/          # React frontend
│       ├── src/
│       │   ├── pages/       # Page components
│       │   ├── components/  # Shared UI components
│       │   └── hooks/       # React hooks
│       └── dist/            # Built output (served by Nginx)
├── lib/
│   └── db/                  # Database schema (Drizzle ORM)
│       └── src/schema/      # Table definitions
├── migration.sql            # Full database schema
├── .env                     # Environment variables
└── ecosystem.config.js      # PM2 configuration
```
