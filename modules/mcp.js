/**
 * MCP客户端模块
 * 封装了与MCP服务器的交互功能
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

/**
 * MCP客户端类，用于连接MCP服务器并调用工具
 */
class MCPClient {
  // 静态属性，用于跟踪客户端是否忙碌
  static isBusy = false;

  constructor() {
    // 从环境变量读取配置
    this.transportType = process.env.MCP_TRANSPORT || 'streamablehttp';
    this.clientName = process.env.MCP_CLIENT_NAME || 'discord-design-client';
    this.clientVersion = process.env.MCP_CLIENT_VERSION || '1.0.0';
    this.streamableHttpUrl = process.env.MCP_STREAMABLEHTTP_URL || 'http://127.0.0.1:12001/mcp';
    this.stdioCommand = process.env.MCP_STDIO_COMMAND || 'python';
    this.stdioArgs = process.env.MCP_STDIO_ARGS ? process.env.MCP_STDIO_ARGS.split(',') : ['e:\\projects\\ady\\aid\\resource_mcp\\main.py'];

    // 初始化MCP客户端
    this.mcp = new Client({
      name: this.clientName,
      version: this.clientVersion
    });

    this.transport = null;
    this.tools = [];
    this.connected = false;
  }

  /**
   * 创建并配置传输方式
   * @private
   * @returns {StdioClientTransport|StreamableHttpClientTransport} 配置好的传输实例
   */
  _createTransport() {
    if (this.transportType === 'stdio') {
      return new StdioClientTransport({
        command: this.stdioCommand,
        args: this.stdioArgs
      });
    } else {
      // 默认使用streamablehttp
      console.log("try to connect", this.streamableHttpUrl)
      // 创建StreamableHTTP传输实例，添加600秒超时设置
      // timeout: 连接超时时间
      // sse_read_timeout: SSE读取超时时间
      return new StreamableHTTPClientTransport(
        this.streamableHttpUrl,
        {
          timeout: 600000,  // 600秒
          sse_read_timeout: 600000  // 600秒
        }
      );
    }
  }

  /**
   * 连接到MCP服务器
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) return;

    try {
      this.transport = this._createTransport();
      await this.mcp.connect(this.transport);

      // 列出可用工具
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools;
      console.log('Connected to MCP server with tools:', this.tools.map(tool => tool.name));

      this.connected = true;
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw new Error(`连接MCP服务器失败: ${error.message}`);
    }
  }

  /**
   * 调用MCP工具
   * @param {string} toolName - 工具名称
   * @param {Object} args - 工具参数
   * @returns {Promise<any>} 工具调用结果
   */
  /**
   * 调用MCP工具
   * @param {string} toolName - 工具名称
   * @param {Object} args - 工具参数
   * @returns {Promise<any>} 工具调用结果
   * @throws {Error} 当服务器忙或调用失败时抛出错误
   */
  async callTool(toolName, args) {
    // 检查客户端是否忙碌
    if (MCPClient.isBusy) {
      throw new Error("服务器忙，请稍后重试");
    }

    if (!this.connected) {
      await this.connect();
    }

    try {
      // 设置为忙碌状态
      MCPClient.isBusy = true;

      const result = await this.mcp.callTool({
        name: toolName,
        arguments: args
      });
      return result.content;
    } catch (error) {
      console.error(`Failed to call tool ${toolName}:`, error);
      if (error.message.includes("服务器忙")) {
        throw error;
      } else {
        throw new Error(`调用工具${toolName}失败: ${error.message}`);
      }
    } finally {
      // 无论成功失败，都释放忙碌状态
      MCPClient.isBusy = false;
    }
  }

  /**
   * 断开与MCP服务器的连接
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.connected = false;
    }
  }
}

// 创建并导出MCP客户端实例
const mcpClient = new MCPClient();

export default mcpClient;