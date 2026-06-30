# 🚀 Direct deploy: Local PC → VPS (no GitHub)

Push code straight from your laptop to the VPS over SSH. On every push the VPS
auto-installs deps, rebuilds the client, and restarts the API with PM2.

```
Your PC  ──git push vps main──►  VPS bare repo  ──post-receive hook──►  build + PM2 restart
```

Replace these placeholders everywhere below:
- `USER`  — your VPS SSH username (e.g. `root`, `ubuntu`)
- `HOST`  — your VPS IP or domain
- `PORT`  — SSH port (usually `22`)
- `WORKTREE` — the folder on the VPS that **contains** the `shop-erp-saas` directory
  (your current app path minus the `shop-erp-saas/shop-erp-saas` suffix).

---

## A. One-time setup ON THE VPS (run inside an SSH session)

```bash
# 1. Create a bare git repo (this is what you push to)
mkdir -p ~/repos/shop.git
cd ~/repos/shop.git
git init --bare

# 2. Add the auto-deploy hook
nano hooks/post-receive
#    -> paste the contents of deploy/post-receive
#    -> edit the WORKTREE= line to match your app folder, then save

chmod +x hooks/post-receive
```

> Your real `server/.env` and `client/.env` already live in the app folder and are
> **gitignored**, so deploys never touch them. They stay exactly as they are.

---

## B. One-time setup ON YOUR PC (run in this project)

```bash
# point a new git remote called "vps" at the bare repo
git remote add vps ssh://USER@HOST:PORT/home/USER/repos/shop.git

# (optional) drop GitHub as the push target completely:
# git remote remove origin
```

---

## C. Deploy — every time you change code

```bash
git add -A
git commit -m "your change"
git push vps main
```

That's it. Watch the build/deploy output stream back in your terminal.

---

## First push notes
- The first `git push vps main` checks out the code into `WORKTREE`. If the app
  folder already exists there from the old GitHub clone, tracked files are
  overwritten and your `.env` files are preserved.
- If Nginx `root` still points at the old path, make sure `WORKTREE` resolves to
  the same `.../shop-erp-saas/shop-erp-saas/client/dist`. Easiest: set `WORKTREE`
  to the parent folder of your existing `shop-erp-saas` directory — then nothing
  in Nginx needs to change.

## SSH key (so push doesn't ask for a password every time)
```bash
# on your PC, if you don't already have a key:
ssh-keygen -t ed25519
# copy it to the VPS:
ssh USER@HOST "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys" < ~/.ssh/id_ed25519.pub
```

## Rollback
```bash
# on the VPS, inside WORKTREE:
git --git-dir=$HOME/repos/shop.git --work-tree=. log --oneline
git --git-dir=$HOME/repos/shop.git --work-tree=. checkout -f <older-commit>
cd shop-erp-saas/shop-erp-saas/client && npm run build
pm2 restart shop-api
```

© Future Flow AI Agency
