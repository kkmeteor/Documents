# 本地 C++/C# 类库打包 NuGet 包并上传本地包源指南

## 概述

本文档说明如何将本地 C++ 原生库和 C# 类库打包为 NuGet 包（`.nupkg`），并上传至内部 NuGet 包源：

```
http://10.10.11.194:1001/v3/index.json
```

---

## 一、工具准备

| 工具 | 用途 | 获取方式 |
|------|------|----------|
| `nuget.exe` | 打包 / 推送 | 从 [nuget.org/downloads](https://www.nuget.org/downloads) 下载 |
| MSBuild / Visual Studio | 编译 C++ 和 C# 项目 | VS Installer |

将 `nuget.exe` 所在目录加入 `PATH`，或在工作目录直接使用相对路径调用。

---

## 二、C# 类库打包（简单场景）

### 2.1 项目文件配置（SDK 风格 .csproj）

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net6.0</TargetFramework>
    <PackageId>SV.MyLibrary</PackageId>
    <Version>1.0.0</Version>
    <Authors>Internal</Authors>
    <Description>My C# library</Description>
    <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
  </PropertyGroup>
</Project>
```

### 2.2 打包命令

```powershell
# 方式一：直接通过 dotnet 打包
dotnet pack -c Release -o .\output

# 方式二：先编译再打包
dotnet build -c Release
dotnet pack -c Release -o .\output
```

生成的 `SV.MyLibrary.1.0.0.nupkg` 位于 `output` 目录。

---

## 三、C++ 原生库打包（重点）

C++ 库打包 NuGet 与 C# 有本质区别：**C++ 没有标准的 SDK 式打包约定**，需要手动编写 `.nuspec` 和 `.targets` 文件来告诉消费方如何找到头文件、`.lib` 和 `.dll`。

### 3.1 包目录结构规划

在打包前，先把所有需要分发的文件整理到统一目录结构：

```
nuget-pack/
├── build/
│   └── native/
│       ├── include/          # 头文件（按库名分子目录）
│       │   └── SV.CT.facade/
│       │       ├── GramStruct.h
│       │       ├── GramEvent.h
│       │       └── ...
│       ├── bin/              # 运行时 DLL
│       │   └── x64-windows/
│       │       └── Release/
│       │           └── SV.BL.Serialization.dll
│       └── lib/              # 链接时 .lib
│           └── x64-windows/
│               └── Release/
│                   └── SV.BL.Serialization.lib
├── SV.BL.Serialization.nuspec
├── SV.BL.Serialization.targets          # PackageReference 消费方用
└── SV.BL.Serialization.native.targets   # packages.config 消费方用
```

> **关键原则**：`include/`、`bin/`、`lib/` 的相对路径结构决定了 `.targets` 文件中如何引用它们。

### 3.2 编写 .nuspec 文件

`.nuspec` 描述包的元数据以及文件映射关系：

```xml
<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">
  <metadata>
    <id>SV.BL.Serialization</id>
    <version>1.1.3</version>
    <authors>Internal</authors>
    <description>SV BL Serialization C++ native library (x64 Windows)</description>
    <tags>native C++ nativepackage windows x64 serialization</tags>
  </metadata>
  <files>
    <!-- 
      ★ targets 文件必须放在 build\ 目录下，NuGet 才会自动导入 ★
      
      消费方式说明：
      - PackageReference 消费方（C# / C++ SDK 项目）
        → 自动导入 build\SV.BL.Serialization.targets
      
      - packages.config 消费方（传统 C++ / C++/CLI 项目）
        → 自动导入 build\native\SV.BL.Serialization.targets
    -->
    <file src="SV.BL.Serialization.targets"
          target="build" />
    <file src="SV.BL.Serialization.native.targets"
          target="build\native\SV.BL.Serialization.targets" />

    <!-- 头文件、DLL、LIB 打包到 build\native\ 下 -->
    <file src="build\native\include\**" target="build\native\include" />
    <file src="build\native\bin\**"     target="build\native\bin" />
    <file src="build\native\lib\**"     target="build\native\lib" />
  </files>
</package>
```

> **易错点**：`<tags>` 中包含 `nativepackage` 可让 Visual Studio 包管理器正确识别为原生包。

### 3.3 编写 targets 文件（核心难点）

NuGet 包被消费时，MSBuild 会自动导入 `build\{包名}.targets`（PackageReference）或 `build\native\{包名}.targets`（packages.config）。  
**在这两个 targets 文件中配置头文件路径、库路径和 DLL 复制规则。**

#### 3.3.1 `SV.BL.Serialization.targets`（PackageReference 消费方）

此文件被打包到 `build\` 目录，因此 `$(MSBuildThisFileDirectory)` 指向包内 `build\`，访问 native 资源需要加 `native\` 前缀。

```xml
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">

  <!-- C++ 项目：配置头文件路径、库路径、附加依赖项 -->
  <ItemDefinitionGroup Condition="'$(Platform)'=='x64' Or '$(PlatformTarget)'=='x64'">
    <ClCompile>
      <!-- 头文件路径（注意 SV.CT.facade 子目录） -->
      <AdditionalIncludeDirectories>
        $(MSBuildThisFileDirectory)native\include\SV.CT.facade;
        %(AdditionalIncludeDirectories)
      </AdditionalIncludeDirectories>
    </ClCompile>
    <Link>
      <!-- .lib 库路径 -->
      <AdditionalLibraryDirectories>
        $(MSBuildThisFileDirectory)native\lib\x64-windows\Release;
        %(AdditionalLibraryDirectories)
      </AdditionalLibraryDirectories>
      <!-- 需要链接的 .lib 文件名 -->
      <AdditionalDependencies>
        SV.BL.Serialization.lib;%(AdditionalDependencies)
      </AdditionalDependencies>
    </Link>
  </ItemDefinitionGroup>

  <!-- 所有项目（C# / C++）：复制 DLL 到输出目录 -->
  <ItemGroup Condition="'$(Platform)'=='x64' Or '$(PlatformTarget)'=='x64' Or '$(PlatformTarget)'=='AnyCPU' Or ('$(Language)'!='C++' And '$(PlatformTarget)'=='')">
    <None Include="$(MSBuildThisFileDirectory)native\bin\x64-windows\Release\SV.BL.Serialization.dll">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
      <Visible>false</Visible>
    </None>
  </ItemGroup>

</Project>
```

#### 3.3.2 `SV.BL.Serialization.native.targets`（packages.config 消费方）

此文件被打包到 `build\native\` 目录，因此 `$(MSBuildThisFileDirectory)` 直接指向 `build\native\`，路径**不需要** `native\` 前缀。

```xml
<Project ToolsVersion="4.0" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">

  <!-- C++ 项目：配置头文件路径、库路径、附加依赖项 -->
  <ItemDefinitionGroup Condition="'$(Platform)'=='x64'">
    <ClCompile>
      <AdditionalIncludeDirectories>
        $(MSBuildThisFileDirectory)include\SV.CT.facade;
        %(AdditionalIncludeDirectories)
      </AdditionalIncludeDirectories>
    </ClCompile>
    <Link>
      <AdditionalLibraryDirectories>
        $(MSBuildThisFileDirectory)lib\x64-windows\Release;
        %(AdditionalLibraryDirectories)
      </AdditionalLibraryDirectories>
      <AdditionalDependencies>
        SV.BL.Serialization.lib;%(AdditionalDependencies)
      </AdditionalDependencies>
    </Link>
  </ItemDefinitionGroup>

  <!-- 复制 DLL 到输出目录 -->
  <ItemGroup Condition="'$(Platform)'=='x64'">
    <None Include="$(MSBuildThisFileDirectory)bin\x64-windows\Release\SV.BL.Serialization.dll">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
      <Visible>false</Visible>
    </None>
  </ItemGroup>

</Project>
```

> **两份 targets 的核心区别**：`$(MSBuildThisFileDirectory)` 指向不同目录，导致资源路径前缀不同。`build\` 版需要 `native\` 前缀，`build\native\` 版直接写 `include\`、`lib\`、`bin\`。

### 3.4 C++ targets 常见错误汇总

| 错误 | 现象 | 原因 |
|------|------|------|
| targets 放在包根目录 | 消费方编译时 targets 未生效，链接错误 | NuGet 只自动导入 `build\{包名}.targets` 或 `build\native\{包名}.targets` |
| 头文件路径缺少子目录 | `C1083: 无法打开头文件` | `include\` 下还有 `SV.CT.facade\` 子层，targets 中路径必须写到实际目录 |
| C++/CLI 项目 `array` 关键字报错 | `error C3699: 'array': 语法错误` | `System::Array` 被 `std::array` 遮蔽，需在包含库头文件前 `#undef array` 或调整 include 顺序 |
| 只准备一份 targets | packages.config 的 C++ 项目不生效 | packages.config 消费方只导入 `build\native\` 下的 targets |

### 3.5 打包命令

```powershell
# 在 nuget-pack 目录下执行
nuget pack SV.BL.Serialization.nuspec -OutputDirectory .

# 指定版本号覆盖 nuspec 中的版本
nuget pack SV.BL.Serialization.nuspec -Version 1.1.3 -OutputDirectory .
```

成功后生成 `SV.BL.Serialization.1.1.3.nupkg`。

---

## 四、消费方项目配置

### 4.1 C# 项目（PackageReference 风格）

```xml
<!-- .csproj 中添加 -->
<ItemGroup>
  <PackageReference Include="SV.BL.Serialization" Version="1.1.3" />
</ItemGroup>
```

DLL 会通过 targets 自动复制到输出目录，无需手动引用。

### 4.2 C++ 项目（packages.config 风格）

```powershell
# 通过 nuget.exe 安装包
nuget install SV.BL.Serialization -Version 1.1.3 -OutputDirectory packages
```

```xml
<!-- packages.config 中添加 -->
<package id="SV.BL.Serialization" version="1.1.3" targetFramework="native" />
```

安装后 MSBuild 自动导入 `build\native\SV.BL.Serialization.targets`，头文件和库路径自动配置。

### 4.3 C++/CLI 项目（packages.config 风格）

同 4.2，但需注意 `array` 关键字冲突问题（见 3.4 节错误表）。

### 4.4 配置本地 NuGet 源

在项目根目录创建 `NuGet.config`（或修改全局配置）：

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <!-- 本地内部包源 -->
    <add key="InternalNuGet" value="http://10.10.11.194:1001/v3/index.json" />
    <!-- 如需同时使用官方源，取消下行注释 -->
    <!-- <add key="nuget.org" value="https://api.nuget.org/v3/index.json" /> -->
  </packageSources>
</configuration>
```

---

## 五、上传 NuGet 包到本地包源

### 5.1 推送单个包

```powershell
nuget push SV.BL.Serialization.1.1.3.nupkg `
           -Source http://10.10.11.194:1001/v3/index.json `
           -ApiKey AzureArtifacts
```

> **说明**：`-ApiKey` 的值取决于本地包源的认证配置。若包源无需认证，可填任意非空字符串（如 `AzureArtifacts`）或省略该参数。

### 5.2 批量推送目录下所有包

```powershell
nuget push .\*.nupkg -Source http://10.10.11.194:1001/v3/index.json -ApiKey AzureArtifacts
```

### 5.3 使用 dotnet CLI 推送（可选）

```powershell
dotnet nuget push SV.BL.Serialization.1.1.3.nupkg `
    --source http://10.10.11.194:1001/v3/index.json `
    --api-key AzureArtifacts
```

### 5.4 验证上传成功

```powershell
# 搜索包是否存在
nuget list SV.BL.Serialization -Source http://10.10.11.194:1001/v3/index.json
```

或在 Visual Studio 包管理器中切换到 `InternalNuGet` 源搜索。

---

## 六、完整打包发布流程（C++ 库）

```
1. 编译 C++ 项目
   → 生成 .dll 和 .lib

2. 整理包目录（build/native/...）
   ├── include/  ← 复制公开头文件
   ├── bin/      ← 复制 .dll
   └── lib/      ← 复制 .lib

3. 更新 .nuspec 中的 <version>

4. 执行打包
   nuget pack SV.BL.Serialization.nuspec -OutputDirectory .

5. 推送包到本地源
   nuget push SV.BL.Serialization.x.x.x.nupkg `
       -Source http://10.10.11.194:1001/v3/index.json `
       -ApiKey AzureArtifacts

6. 消费方更新包版本
   Update-Package SV.BL.Serialization -Version x.x.x

7. 从服务器上删除某个特定的包版本，例如删除

  nuget delete SV.BL.Serialization 1.1.3 `
    -Source http://10.10.11.194:1001/v3/index.json `
    -ApiKey sinounion `
    -NonInteractive

  执行成功后：1.1.3 版本被删除,1.1.2 自动成为最新版本,已安装 1.1.3 的项目更新时会回退到 1.1.2
  
```

---

## 七、C++ 打包检查清单

在打包前逐项确认：

- [ ] `build/native/include/` 下包含所有公开头文件，目录层级与 `#include` 路径一致
- [ ] `build/native/bin/` 下包含所有运行时 `.dll`
- [ ] `build/native/lib/` 下包含所有链接时 `.lib`
- [ ] `.nuspec` 的 `<files>` 节点正确映射了所有文件
- [ ] 两份 `.targets` 文件中的路径与包内实际目录结构一致
- [ ] `build\` 版 targets 路径带 `native\` 前缀，`build\native\` 版不带
- [ ] `<tags>` 包含 `nativepackage`
- [ ] 版本号已更新
