const { FastMCP } = require("fastmcp");
const { z } = require("zod");

// 初始化FastMCP服务器
const server = new FastMCP({
  name: "TFS Tools",
  version: "1.0.0",
});

// 目标URL
const HEALTH_CHECK_URL = "http://localhost:9000/api/tfs/health";
const CHANGESET_HISTORY_URL = "http://localhost:9000/api/changesethistory/query";

// SourcePath 代号映射表
const SOURCE_PATH_ALIAS = {
  // 项目名称代号
  "flight": "$/PET-CT Software Project/PET-CT flight",
  "flight plus": "$/PET-CT Software Project/PET-CT flight plus",
  "flightplus": "$/PET-CT Software Project/PET-CT flight plus",
  "flight-plus": "$/PET-CT Software Project/PET-CT flight plus",
  "nova": "$/PET-CT Software Project/S2 main",
  
  // 带"产品"后缀的名称
  "flight产品": "$/PET-CT Software Project/PET-CT flight",
  "flight plus产品": "$/PET-CT Software Project/PET-CT flight plus",
  "flightplus产品": "$/PET-CT Software Project/PET-CT flight plus",
  "flight-plus产品": "$/PET-CT Software Project/PET-CT flight plus",
  "nova产品": "$/PET-CT Software Project/S2 main",
  "s2产品": "$/PET-CT Software Project/S2 main",
  
  // 分支/版本名称映射
  // Flight 相关版本
  "2.0": "$/PET-CT Software Project/PET-CT flight",
  "2.0.x": "$/PET-CT Software Project/PET-CT flight",
  "v2.0": "$/PET-CT Software Project/PET-CT flight",
  "main": "$/PET-CT Software Project/PET-CT flight",
  "master": "$/PET-CT Software Project/PET-CT flight",
  "develop": "$/PET-CT Software Project/PET-CT flight",
  "dev": "$/PET-CT Software Project/PET-CT flight",
  
  // Flight Plus 相关版本
  "flight plus 2.0": "$/PET-CT Software Project/PET-CT flight plus",
  "flight plus 2.0.x": "$/PET-CT Software Project/PET-CT flight plus",
  "flight plus main": "$/PET-CT Software Project/PET-CT flight plus",
  "flight plus master": "$/PET-CT Software Project/PET-CT flight plus",
  
  // Nova 相关版本
  "nova main": "$/PET-CT Software Project/S2 main",
  "nova master": "$/PET-CT Software Project/S2 main",
  "s2 main": "$/PET-CT Software Project/S2 main",
  "s2": "$/PET-CT Software Project/S2 main",
};

/**
 * 解析sourcePath参数，支持代号和完整路径
 * @param {string} sourcePath - 用户输入的sourcePath(可以是代号或完整路径)
 * @returns {string} - 解析后的完整sourcePath
 */
function resolveSourcePath(sourcePath) {
  if (!sourcePath) {
    // 默认返回nova
    return SOURCE_PATH_ALIAS["nova"];
  }
  
  // 转换为小写进行匹配
  let lowerPath = sourcePath.toLowerCase().trim();
  
  // 移除常见的后缀词汇
  lowerPath = lowerPath.replace(/(产品|project|版本|version)$/i, '').trim();
  
  // 检查是否是代号
  if (SOURCE_PATH_ALIAS[lowerPath]) {
    return SOURCE_PATH_ALIAS[lowerPath];
  }
  
  // 如果不是代号，则认为是完整路径，直接返回
  return sourcePath;
}

// 工具1：检查TFS服务健康状态
server.addTool({
  name: "check_tfs_health",
  description: "检查TFS服务的健康状态，返回JSON格式的健康信息",
  parameters: z.object({}),
  execute: async () => {
    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const healthData = await response.json();

      // 返回JSON格式的结果
      return JSON.stringify(
        {
          Status: healthData.Status || "Unknown",
          Time: healthData.Time || "Unknown",
        },
        null,
        2
      );
    } catch (error) {
      const errorMessage = error.message || "未知错误";
      
      if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
        console.error("无法连接到TFS服务");
        return JSON.stringify({
          Status: "Unreachable",
          Time: "N/A",
          Error: "无法连接到服务",
        }, null, 2);
      } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
        console.error("连接TFS服务超时");
        return JSON.stringify({
          Status: "Timeout",
          Time: "N/A",
          Error: "连接超时",
        }, null, 2);
      } else {
        console.error(`检查健康状态时出错: ${errorMessage}`);
        return JSON.stringify({
          Status: "Error",
          Time: "N/A",
          Error: errorMessage,
        }, null, 2);
      }
    }
  },
});

// 工具2：查询TFS变更集历史
server.addTool({
  name: "query_changeset_history",
  description: "查询TFS变更集历史记录，可以根据日期范围和提交人筛选结果",
  parameters: z.object({
    startDate: z.string().describe("开始日期，格式：YYYY-MM-DD，例如：2026-01-01"),
    endDate: z.string().describe("结束日期，格式：YYYY-MM-DD，例如：2026-05-31"),
    submitter: z.string().optional().describe("可选，提交人姓名，用于筛选特定用户的提交记录"),
    tfsUrl: z.string().optional().describe("可选，TFS服务器URL，默认：http://10.10.10.63:8080/tfs/DefaultCollection"),
    sourcePath: z.string().optional().describe("可选，源码路径、项目代号、分支或版本名称。\n项目代号：flight、flight plus、nova\n版本/分支：2.0、v2.0、main、master、develop、nova main等\n默认：nova\n"),
  }),
  execute: async (args) => {
    try {
      // 构建请求体
      const requestBody = {
        TfsUrl: args.tfsUrl || "http://10.10.10.63:8080/tfs/DefaultCollection",
        SourcePath: resolveSourcePath(args.sourcePath),
        StartDate: args.startDate,
        EndDate: args.endDate,
      };

      console.error(`查询变更集历史: ${JSON.stringify(requestBody)}`);
      console.error(`使用的sourcePath: ${requestBody.SourcePath} (原始输入: ${args.sourcePath || "未指定，使用默认值"})`);

      // 发送POST请求
      const response = await fetch(CHANGESET_HISTORY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let changesets = await response.json();

      // 如果指定了提交人，进行筛选
      if (args.submitter) {
        changesets = changesets.filter(
          (item) => item.Submitter.toLowerCase() === args.submitter.toLowerCase()
        );
        console.error(`筛选提交人 "${args.submitter}" 的记录，共 ${changesets.length} 条`);
      }

      // 返回结果
      if (changesets.length === 0) {
        return JSON.stringify({
          message: "未找到符合条件的变更集记录",
          count: 0,
          data: [],
        }, null, 2);
      }

      return JSON.stringify({
        message: `找到 ${changesets.length} 条变更集记录`,
        count: changesets.length,
        data: changesets,
      }, null, 2);
    } catch (error) {
      const errorMessage = error.message || "未知错误";
      
      if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND")) {
        console.error("无法连接到TFS服务");
        return JSON.stringify({
          Status: "Unreachable",
          Error: "无法连接到服务",
        }, null, 2);
      } else if (errorMessage.includes("ETIMEDOUT") || errorMessage.includes("timeout")) {
        console.error("连接TFS服务超时");
        return JSON.stringify({
          Status: "Timeout",
          Error: "连接超时",
        }, null, 2);
      } else {
        console.error(`查询变更集历史时出错: ${errorMessage}`);
        return JSON.stringify({
          Status: "Error",
          Error: errorMessage,
        }, null, 2);
      }
    }
  },
});

// 启动服务器
server.start({
  transportType: "stdio",
});
