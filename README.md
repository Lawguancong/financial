
# node 版本建议
node -v
v20.19.5

# 需基于python环境，升级pip版本
pip install --upgrade pip


# 项目介绍 aktools
AKTools 是一款用于快速搭建 AKShare HTTP API 的工具， 通过 AKTools 可以利用一行命令来启动 HTTP 服务， 从而让原本专属服务于 Python 用户的开源财经数据接口库 AKShare 的使用突破编程语言的限制。 无论您使用的是 C/C++、Java、Go、Rust、Ruby、PHP、JavaScript、R、Matlab、Stata 等编程语言或软件都可以快速、 轻松获取财经数据，助力您更好地展开研究和开发工作。
https://akshare.akfamily.xyz/deploy_http.html
https://aktools.akfamily.xyz/
https://github.com/akfamily/aktools


# 由于目前版本更新迭代频繁, 请在使用 aktools 前先升级, 命令如下所示
pip3 install aktools
pip3.11 install aktools

# 运行服务端
npm run start:server:aktools
yarn start:server:aktools
服务端项目端口：6670，确保端口不被占用
http://localhost:6670/



# 运行前端
npm run start:frontend:aktools
yarn start:frontend:aktools
前端项目端口：6671，确保端口不被占用
http://localhost:6671/

# 访问前端项目
http://localhost:6671/

