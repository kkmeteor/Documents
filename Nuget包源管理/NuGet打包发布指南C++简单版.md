# C++ NuGet 包打包发布指南（简单版）

## 适用场景

将 C++ 依赖的文件（DLL、数据文件等）打包为 NuGet 包，安装后自动复制到消费方输出目录。  
**不涉及头文件路径配置、不涉及 `.lib` 链接**，是最简场景。

本地 NuGet 包源：

```
http://10.10.11.194:1001/v3/index.json
```

---

## 一、工具准备

| 工具 | 用途 | 获取方式 |
|------|------|----------|
| `nuget.exe` | 打包 / 推送 | [nuget.org/downloads](https://www.nuget.org/downloads) |

将 `nuget.exe` 放在工作目录，或加入 `PATH`。

---

## 二、需要哪些文件？

C++ 消费方（packages.config）只从 `build\native\` 目录自动导入 targets。  
因此**只需 1 份 targets 文件**，不需要为 PackageReference 消费方额外准备。

| 文件 | 是否必须 | 说明 |
|------|----------|------|
| `{包名}.nuspec` | ✅ 必须 | 包元数据 + 文件映射 |
| `{包名}.targets` | ✅ 必须 | 定义文件复制规则，放在包内 `build\native\` 下 |
| `build\native\` 下的业务文件 | ✅ 必须 | 需要分发的 DLL / 数据文件等 |

---

## 三、目录结构

以包名 `SV.MyPackage` 为例，打包工作目录结构如下：

```
nuget-pack/
├── files/                          # 待分发的文件，按实际组织
│   └── x64\
│       ├── mylib.dll
│       └── mylib2.dll
├── SV.MyPackage.nuspec             # 包描述文件
└── SV.MyPackage.targets            # 文件复制规则
```

---

## 四、编写 `.nuspec`

```xml
<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">
  <metadata>
    <id>SV.MyPackage</id>
    <version>1.0.0</version>
    <authors>Internal</authors>
    <description>My C++ native files package</description>
    <tags>native nativepackage</tags>
  </metadata>
  <files>
    <!-- targets 必须映射到 build\native\{包名}.targets，C++ 消费方才自动导入 -->
    <file src="SV.MyPackage.targets" target="build\native\SV.MyPackage.targets" />
    <!-- 待分发文件统一放入包内 build\native\files\ 下 -->
    <file src="files\**" target="build\native\files" />
  </files>
</package>
```

**要点说明：**

- `<tags>` 中包含 `nativepackage`，让 Visual Studio 正确识别为原生包。
- `target="build\native\SV.MyPackage.targets"` — 文件名**必须**与包 ID 完全一致，NuGet 才会自动导入。
- `files\**` 将本地 `files\` 目录下所有文件递归打入包内 `build\native\files\`。

---

## 五、编写 `.targets`

此文件将被打包到 `build\native\` 目录下，因此 `$(MSBuildThisFileDirectory)` 指向包内 `build\native\`，路径**不需要** `native\` 前缀。

```xml
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">

  <!-- 复制 DLL 到消费方输出目录 -->
  <ItemGroup Condition="'$(Platform)'=='x64'">
    <None Include="$(MSBuildThisFileDirectory)files\x64\mylib.dll">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
      <Link>mylib.dll</Link>
    </None>
    <None Include="$(MSBuildThisFileDirectory)files\x64\mylib2.dll">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
      <Link>mylib2.dll</Link>
    </None>
  </ItemGroup>

</Project>
```

**要点说明：**

- `$(MSBuildThisFileDirectory)` — NuGet 内置变量，运行时解析为该 targets 文件所在目录（即包内 `build\native\`）。
- `<Link>` — 控制文件复制到输出目录后的相对路径，不写则直接放在输出根目录。
- `Condition="'$(Platform)'=='x64'"` — 限定平台，按需调整或去掉。
- 如需复制整个目录，可用通配：
  ```xml
  <None Include="$(MSBuildThisFileDirectory)files\x64\**\*.*">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    <Link>myfiles\%(RecursiveDir)%(Filename)%(Extension)</Link>
  </None>
  ```

---

## 六、打包

```powershell
# 在 nuget-pack 目录下执行
nuget pack Image2DViewer.nuspec -OutputDirectory .\packages

# 或命令行指定版本号（覆盖 nuspec 中的 version）
nuget pack SV.MyPackage.nuspec -Version 1.0.1 -OutputDirectory \packages
```

成功后当前目录生成 `SV.MyPackage.1.0.0.nupkg`。

---

## 七、上传到本地包源

### 7.1 推送单个包

```powershell
nuget push SV.MyPackage.1.0.0.nupkg `
           -Source http://10.10.11.194:1001/v3/index.json `
           -ApiKey sinounion
```

> `-ApiKey` 取决于本地包源的认证配置。若无需认证，可填任意非空字符串或省略。

### 7.2 批量推送

```powershell
nuget push .\*.nupkg -Source http://10.10.11.194:1001/v3/index.json -ApiKey AzureArtifacts
```

### 7.3 验证上传成功

```powershell
nuget search SV.MyPackage -Source http://10.10.11.194:1001/v3/index.json
```

---

## 八、消费方使用

### 8.1 配置 NuGet 源

在消费方项目根目录创建或修改 `NuGet.config`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="InternalNuGet" value="http://10.10.11.194:1001/v3/index.json" />
  </packageSources>
</configuration>
```

### 8.2 安装包

```powershell
# 方式一：通过 nuget.exe
nuget install SV.MyPackage -Version 1.0.0 -OutputDirectory packages

# 方式二：Visual Studio 包管理器控制台
Install-Package SV.MyPackage -Version 1.0.0
```

### 8.3 packages.config 自动添加

```xml
<package id="SV.MyPackage" version="1.0.0" targetFramework="native" />
```

安装后 MSBuild 自动导入 `build\native\SV.MyPackage.targets`，编译时文件自动复制到输出目录。

---

## 九、完整发布流程速查

```
1. 准备文件
   将 DLL / 数据文件放入 files\ 目录

2. 编写配置（首次，后续只改版本号）
   ├── SV.MyPackage.nuspec     ← 更新 <version>
   └── SV.MyPackage.targets    ← 文件复制规则（通常不变）

3. 打包
   nuget pack SV.MyPackage.nuspec -OutputDirectory .

4. 推送
   nuget push SV.MyPackage.1.0.0.nupkg `
       -Source http://10.10.11.194:1001/v3/index.json `
       -ApiKey AzureArtifacts

5. 消费方安装 / 更新
   Update-Package SV.MyPackage -Version 1.0.1
```

---

## 十、常见问题

| 问题 | 现象 | 解决方法 |
|------|------|----------|
| targets 未生效 | 编译后输出目录没有目标文件 | 确认 nuspec 中 `target="build\native\SV.MyPackage.targets"`，文件名必须与包 ID 一致 |
| 文件路径解析错误 | 打包后找不到文件 | `$(MSBuildThisFileDirectory)` 在 `build\native\` 版 targets 中指向 `build\native\`，路径不加 `native\` 前缀 |
| 推送报 401 | `nuget push` 认证失败 | 确认包源是否需要 API Key，按需调整 `-ApiKey` 参数 |
| 包内文件结构不对 | 消费方路径异常 | 用 `nuget spec` 生成模板检查，或解压 `.nupkg`（本质是 zip）查看内部结构 |

---

## 十一、打包检查清单

- [ ] `.nuspec` 中 `<id>` 与 targets 文件名一致
- [ ] `.nuspec` 中 targets 的 `target` 属性为 `build\native\{包名}.targets`
- [ ] targets 中 `$(MSBuildThisFileDirectory)` 后的路径与包内实际文件结构一致（**不加** `native\` 前缀）
- [ ] `<tags>` 包含 `nativepackage`
- [ ] 版本号已更新
- [ ] 本地测试：安装包后编译，确认文件已复制到输出目录
