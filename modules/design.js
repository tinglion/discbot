import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import mcpClient from './mcp.js';
import { put } from 'axios';

/**
 * 处理design命令 - 实现分步响应
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Promise<void>}
 */
export async function handleDesignCommand(req, res) {
  const { body } = req;
  const userId = body.context === 0 ? body.member.user.id : body.user.id;
  const prompt = body.data.options[0].value;
  const interactionToken = body.token;
  const applicationId = body.application_id;

  try {
    console.log("design command:", prompt);

    // 1. 发送初步响应: 处理中
    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: InteractionResponseFlags.EPHEMERAL
      }
    });

    // 2. 异步处理设计请求
    const result = await mcpClient.callTool('gen_design', { prompt: prompt });
    console.log("design result:", result);

    // 解析MCP返回的结果
    const parsedResult = JSON.parse(result);
    const designUrl = parsedResult[0].text;

    // 3. 发送最终结果
    const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;
    await put(webhookUrl, {
      content: `设计请求已完成: ${prompt}\n\n结果: ${designUrl}`
    });
  } catch (error) {
    console.error('Error handling design command:', error.message, error);

    // 发送错误结果
    const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;
    try {
      await put(webhookUrl, {
        content: `设计请求处理失败: ${error.message || '系统故障，请联系管理员'}`
      });
    } catch (webhookError) {
      console.error('Error sending error response:', webhookError);
    }
  }
}