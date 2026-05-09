# 项目介绍 aktools

▶️ 启动服务
# 方法 1：通过 python3.11 直接运行
python3 -m aktools
或者
python3.11 -m aktools
或者
/opt/homebrew/opt/python@3.11/bin/python3.11 -m aktools


🌐 访问 API
启动服务后，在浏览器或工具中访问：
http://127.0.0.1:6670/api/public/stock_zh_a_hist?symbol=600985
参数说明：
symbol: 股票代码（如 600985）

🔧 管理服务进程
查看占用 6670 端口的进程
lsof -i:6670

强制终止进程（谨慎使用）
sudo kill -9 <PID>  # 替换 <PID> 为实际进程号，如 89593
💡 建议优先使用 kill <PID>（无 -9），给进程正常退出的机会。
