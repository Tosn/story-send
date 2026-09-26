#!/usr/bin/env bash
# 一键启动：后端（Express，3001）+ 前端（Vite，5173，自动打开浏览器）
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先安装 Node.js（建议 v22 及以上）"
  exit 1
fi

if [ ! -f .env ]; then
  echo "未找到 .env 文件，请在项目根目录创建"
  exit 1
fi

smtp_user=$(grep -E '^SMTP_USER=' .env | cut -d= -f2-)
smtp_pass=$(grep -E '^SMTP_PASS=' .env | cut -d= -f2-)
if [ -z "$smtp_user" ] || [ -z "$smtp_pass" ]; then
  echo "警告：.env 中 SMTP_USER 或 SMTP_PASS 未填写，暂时无法发送邮件（可以先维护编辑和模板）"
fi

if [ ! -d node_modules ]; then
  echo "首次运行，正在安装依赖..."
  npm install || exit 1
fi

npm run server &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

npm run web
