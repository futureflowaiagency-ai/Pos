# 🚀 Deploying Shop ERP SaaS to a Hostinger VPS

This guide deploys the full MERN app on a single Hostinger VPS:
- **Node/Express API** (`server/`) kept alive by PM2
- **React/Vite build** (`client/dist`) served as static files by Nginx
- **Nginx** reverse-proxies `/api` to the Node process and serves the SPA
- **MongoDB Atlas** as the database
- **HTTPS** via free Let's Encrypt certificates

---

## 0. Before you start — security checklist

- [ ] **Rotate the MongoDB Atlas password.** The original was exposed. In Atlas → *Database Access* → edit the user → set a new password.
- [ ] **Lock Atlas Network Access** to your VPS IP only (remove `0.0.0.0/0`).
- [ ] **Fresh `JWT_SECRET`** — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- [ ] **Change demo passwords** (`admin123` / `owner123`) after first login.
- [ ] Confirm the real `.env` files are **never committed** (already gitignored).

---

## 1. Initial server setup

SSH into the VPS, then:

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx

# PM2 process manager (keeps the API running + auto-restart on reboot/crash)
sudo npm install -g pm2
```

---

## 2. Get the code onto the server

Via git:
```bash
git clone <your-repo-url>
cd shop-erp-saas/shop-erp-saas    # the inner project folder
```
(or upload via SFTP to the same location).

---

## 3. Configure environment

```bash
# Server
cp server/.env.production.example server/.env
nano server/.env        # fill in MONGO_URI (new password), JWT_SECRET, CLIENT_URL

# Client
cp client/.env.production.example client/.env
nano client/.env        # set VITE_API_URL to https://yourdomain.com/api
```

---

## 4. Install dependencies & build

```bash
# API (production deps only)
cd server && npm install --omit=dev

# Client (build the static SPA -> client/dist)
cd ../client && npm install && npm run build
```

---

## 5. Start the API with PM2

```bash
cd ../server
pm2 start src/server.js --name shop-api
pm2 save
pm2 startup        # run the command it prints, to enable boot startup
```

Useful PM2 commands:
```bash
pm2 logs shop-api      # view logs
pm2 restart shop-api   # after code/env changes
pm2 status
```

---

## 6. Configure Nginx

Create `/etc/nginx/sites-available/shop`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Path to the built React app
    root /home/youruser/shop-erp-saas/shop-erp-saas/client/dist;
    index index.html;

    # SPA routing — let React Router handle client-side routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to the Node process
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/shop /etc/nginx/sites-enabled/
sudo nginx -t            # test config
sudo systemctl reload nginx
```

> Adjust the `root` path to wherever you cloned the repo.

---

## 7. Enable HTTPS (free SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot auto-renews. After issuing, make sure `CLIENT_URL` and `VITE_API_URL`
use `https://` (rebuild the client if you change `VITE_API_URL`).

---

## 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Do **not** open port 5000 publicly — Nginx proxies to it internally over localhost.

---

## 9. Updating after a code change

```bash
git pull
cd server && npm install --omit=dev && pm2 restart shop-api
cd ../client && npm install && npm run build   # only if client changed
sudo systemctl reload nginx                    # only if Nginx config changed
```

---

## Architecture at a glance

```
Browser ──HTTPS──> Nginx (:443)
                     ├── /            -> client/dist (static React)
                     └── /api         -> http://127.0.0.1:5000 (Node/Express, via PM2)
                                            └── MongoDB Atlas (TLS)
```

---

## Security features already in the app

- `helmet` security headers
- `cors` locked to `CLIENT_URL`
- Global rate limit (200/min) + stricter login limit (10 / 15 min)
- `bcryptjs` password hashing
- JWT auth with per-tenant (`businessId`) data isolation
- `trust proxy` enabled in production so rate-limiting sees real client IPs

© Future Flow AI Agency
