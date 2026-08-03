# mcp-server-tapd Windows部署极简文档（适配uv+Python≥3.13）
整体使用uv管理虚拟环境，规避pip环境错乱问题，附带本次踩坑要点，步骤极简可一键复制。
## 硬性前置要求
本地/测试机必须安装 **Python 3.13及更高版本**，低版本直接无法运行；提前装好uv工具。

## 完整部署步骤（PowerShell执行）
### 步骤1：拉取代码
```powershell
git clone https://cnb.cool/tapd_mcp/mcp-server-tapd.git
cd mcp-server-tapd
```
注意：文件夹路径全程不要带中文、空格。

### 步骤2：用uv创建虚拟环境并激活
```powershell
uv venv
.venv\Scripts\activate
```
注意
1. 激活成功终端前缀显示`.venv`；
2. uv会自动绑定本机Python3.13，不要混用其他Python版本；
3. 旧环境异常直接删除`.venv`文件夹重跑本步骤。

### 步骤3：安装全部依赖
```powershell
uv pip install requests markdown mcp mcp_server_tapd
```
注意
1. 统一使用`uv pip`，**全程不用原生pip/python -m pip**，彻底杜绝全局包串位；
2. 必须装全4个包，缺包会出现mcp模块导入失败；
3. 本机正常就用`uv pip freeze > requirements.txt`导出，测试机用`uv pip install -r requirements.txt`对齐版本。

### 步骤4：启动Streamable HTTP服务
二选一执行（根据当前目录）
#### 方式1：根目录直接执行（推荐，适配你的目录结构）
```powershell
python src\mcp_server_tapd\server.py --mode=streamable-http --host="0.0.0.0" --port=8000 --path="/mcp" --access-token=E3b4459407caa2638543646cdab769ba0e496555 --api-base-url=https://api.tapd.cn --tapd-base-url=https://www.tapd.cn
```
#### 方式2：进入src/mcp_server_tapd目录启动
```powershell
cd src/mcp_server_tapd
python server.py --mode=streamable-http --host="0.0.0.0" --port=8000 --path="/mcp" --access-token=E3b4459407caa2638543646cdab769ba0e496555 --api-base-url=https://api.tapd.cn --tapd-base-url=https://www.tapd.cn
```
注意
1. access-token替换为自己真实TAPD凭证；
2. host=0.0.0.0允许局域网其他设备访问，如需本地访问改成127.0.0.1；
3. 端口8000被占用，修改--port后的数字即可。

## 高频踩坑&注意清单
1. **版本红线**：Python低于3.13必然各种导入报错，不要用3.12及更早版本；
2. **环境错乱根源**：禁止混用uv pip、系统pip、python -m pip。所有安装只使用uv pip；
3. **ModuleNotFound报错**：大概率没激活venv、依赖没装全、Python版本过低；激活环境重装依赖即可；
4. **uv venv创建失败**：系统没有Python3.13，手动给uv指定Python3.13路径创建；
5. 每次重新部署优先删除`.venv`文件夹，完整重建环境，避免旧缓存异常。

## 快速校验命令（启动前必跑）
激活环境后执行导入测试，无报错再启动服务
```powershell
python -c "from mcp.server.fastmcp import FastMCP;print('依赖正常')"
```