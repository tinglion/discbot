import { InteractionResponseType, InteractionResponseFlags, MessageComponentTypes, ButtonStyleTypes } from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from '../utils.js';
import { getShuffledOptions, getResult } from '../game.js';

// 存储进行中的游戏
export const activeGames = {};

/**
 * 处理challenge命令
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Promise<void>}
 */
export async function handleChallengeCommand(req, res) {
  const { id, body } = req;
  const context = body.context;
  // 用户ID在DM中是user字段，在服务器中是member.user.id
  const userId = context === 0 ? body.member.user.id : body.user.id;
  // 用户选择的对象
  const objectName = body.data.options[0].value;

  // 使用消息ID作为游戏ID创建活动游戏
  activeGames[id] = {
    id: userId,
    objectName,
  };

  return res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: InteractionResponseFlags.IS_COMPONENTS_V2,
      components: [
        {
          type: MessageComponentTypes.TEXT_DISPLAY,
          content: `Rock papers scissors challenge from <@${userId}>`,
        },
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.BUTTON,
              // 附加游戏ID供以后使用
              custom_id: `accept_button_${id}`,
              label: 'Accept',
              style: ButtonStyleTypes.PRIMARY,
            },
          ],
        },
      ],
    },
  });
}

/**
 * 处理挑战相关的组件交互
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Promise<void>}
 */
export async function handleChallengeInteraction(req, res) {
  const { body } = req;
  const { type, id, data } = req.body;
  const componentId = data.custom_id;

  if (componentId.startsWith('accept_button_')) {
    // 获取关联的游戏ID
    const gameId = componentId.replace('accept_button_', '');
    // 删除消息的端点
    const endpoint = `webhooks/${process.env.APP_ID}/${body.token}/messages/${body.message.id}`;

    try {
      await res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // 表示这将是一条临时消息
          flags: InteractionResponseFlags.EPHEMERAL | InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: 'What is your object of choice?',
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.STRING_SELECT,
                  // 附加游戏ID
                  custom_id: `select_choice_${gameId}`,
                  options: getShuffledOptions(),
                },
              ],
            },
          ],
        },
      });
      // 删除之前的消息
      await DiscordRequest(endpoint, { method: 'DELETE' });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  } else if (componentId.startsWith('select_choice_')) {
    // 获取关联的游戏ID
    const gameId = componentId.replace('select_choice_', '');
    const context = body.context;
    // 获取响应用户的用户ID和对象选择
    const userId = context === 0 ? body.member.user.id : body.user.id;
    const objectName = data.values[0];

    if (activeGames[gameId]) {
      // 从辅助函数计算结果
      const resultStr = getResult(activeGames[gameId], {
        id: userId,
        objectName,
      });

      // 从存储中删除游戏
      delete activeGames[gameId];
      // 使用请求体中的token更新消息
      const endpoint = `webhooks/${process.env.APP_ID}/${body.token}/messages/${body.message.id}`;

      try {
        // 发送结果
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.IS_COMPONENTS_V2,
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: resultStr
              }
            ]
          },
        });
        // 更新临时消息
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            components: [
              {
                type: MessageComponentTypes.TEXT_DISPLAY,
                content: 'Nice choice ' + getRandomEmoji()
              }
            ],
          },
        });
      } catch (err) {
        console.error('Error sending message:', err);
      }
    }
  }
}