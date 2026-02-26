AKTools
AKTools 是一款用于快速搭建 AKShare HTTP API 的工具， 通过 AKTools 可以利用一行命令来启动 HTTP 服务， 从而让原本专属服务于 Python 用户的开源财经数据接口库 AKShare 的使用突破编程语言的限制。 无论您使用的是 C/C++、Java、Go、Rust、Ruby、PHP、JavaScript、R、Matlab、Stata 等编程语言或软件都可以快速、 轻松获取财经数据，助力您更好地展开研究和开发工作。
https://aktools.akfamily.xyz/
https://github.com/akfamily/aktools

📦 安装依赖（Python 3.11）
# 使用指定 Python 3.11 环境安装
pip3 install aktools
或者
pip3.11 install aktools

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
