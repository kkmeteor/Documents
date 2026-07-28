## 项目结构
```
PdcServiceTestTool/
├── PdcServiceTestTool.csproj    # 
项目文件
├── App.xaml                     # 
应用程序入口
├── App.xaml.cs
├── App.config                   # 
配置文件
├── MainWindow.xaml              # 
主窗口UI
├── MainWindow.xaml.cs           # 
主窗口逻辑
├── PdcServiceClient.cs          # 
PDC服务客户端封装
├── Properties/
│   ├── AssemblyInfo.cs
│   ├── Resources.resx
│   ├── Resources.Designer.cs
│   └── Settings.Designer.cs
└── Service References/
    └── PdcControlService/
        ├── Reference.cs         # 
        WCF服务引用
        └── Reference.svcmap
```
## 功能特性
### 1. 连接设置
- 可配置PDC服务IP地址和端口
- 测试连接按钮验证服务可用性
- 连接状态显示（绿色=已连接，红色=未连接）
### 2. 快速操作
- HeartBeat : 心跳检测
- Inspect PDC Process : 检查PDC进程状态
- Get PDC Version : 获取PDC软件版本
- Inspect Database : 检查数据库状态
- Inspect Log Service : 检查日志服务状态
- Get Disk Size : 获取PDC磁盘大小
### 3. 扫描操作
- Start/Stop Scan : 启动/停止扫描（可指定Series ID）
- Is Sorting/Reconing : 检查是否正在排序/重建
- Inspect Acquisition/Sorting/Recon Process : 检查各进程状态
### 4. GB（Gantry Board）操作
- Connect/Disconnect GB : 连接/断开GB
- Inspect GB Communication : 检查GB通信状态
- GB Health State : 获取GB健康状态
- System State : 获取系统状态
- GB Firmware/Software Version : 获取版本信息
- GB Voltage : 获取电压信息
- Get Singles/Temperature : 获取探测器单计数/温度
- Get GB Local Time : 获取GB本地时间
## 使用方法
1. 配置连接 : 在"PDC IP"和"Port"字段输入PDC服务的地址（默认: localhost:8080）
2. 测试连接 : 点击"Test Connection"按钮验证服务是否可达
3. 执行操作 : 点击相应的按钮执行各种测试操作
4. 查看结果 : 所有操作结果会显示在底部的"Log Output"区域
## 技术实现
- 使用WCF BasicHttpBinding与PDC Service通信
- 实现了完整的WCF服务客户端代理
- 支持所有主要的PDC服务操作
- 异步执行操作，UI保持响应
- 详细的日志记录