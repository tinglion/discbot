import { InteractionResponseType, InteractionResponseFlags } from "discord-interactions";
import jewelAssistClient from "./mcp.js";
import axios from "axios";

function parse_result(result) {
  // 解析MCP返回的结果
  try {
    const designText = result.content[0].text || "{}";
    const parsedResult = JSON.parse(designText);
    return parsedResult["rendered_image"];
  } catch (e) {
    console.error("Error parsing design result:", e);
    return JSON.stringify(result);
  }
}
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

  // 记录开始时间
  const startTime = Date.now();

  try {
    console.log("design command:", prompt);

    // 1. 发送初步响应: 处理中
    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });

    // 2. 异步处理设计请求
    const result = await jewelAssistClient.callTool("gen_design", { prompt: prompt }, (progress) => {
      if (progress) {
        console.log(`[实时结果] gen_design (${(Date.now() - startTime) / 1000}秒):`, progress);
      }
    });
    console.log(`design result (${(Date.now() - startTime) / 1000}秒):`, result);

    // 解析MCP返回的结果
    const parsedResult = parse_result(result);

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: InteractionResponseFlags.IS_COMPONENTS_V2,
        components: [
          {
            type: MessageComponentTypes.TEXT_DISPLAY,
            content: `设计请求已处理: ${prompt}\n\n结果：${parsedResult}`,
          },
        ],
      },
    });

    // 3. 发送最终结果
    const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;
    await axios.post(webhookUrl, {
      content: `设计请求已完成: ${prompt}\n\n结果: ${parsedResult["rendered_image"]}`,
    });
  } catch (error) {
    console.error("Error handling design command:", error);
  } finally {
    // 计算并记录已用时间
    console.log(`设计请求处理完成，用户${userId}，用时：${(Date.now() - startTime) / 1000}秒`);
  }
}
