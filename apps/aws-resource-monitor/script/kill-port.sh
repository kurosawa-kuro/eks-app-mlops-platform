#!/bin/bash

# ポート番号
PORT=28000

echo "Checking port $PORT..."

# ポートを使用しているプロセスのPIDを取得
PID=$(lsof -t -i:$PORT)

if [ -z "$PID" ]; then
    echo "Port $PORT is not in use."
    exit 0
fi

echo "Port $PORT is being used by PID: $PID"

# プロセスの詳細情報を表示
echo "Process details:"
ps -fp $PID

# プロセスを強制終了
echo "Killing process..."
kill -9 $PID

# 結果を確認
if [ $? -eq 0 ]; then
    echo "Process killed successfully."
else
    echo "Failed to kill process. You may need sudo privileges."
    exit 1
fi