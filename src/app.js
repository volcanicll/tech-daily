const wxBotService = require("./services/notification/wxBot/WxBotService");
const groupBotService = require("./services/notification/groupBot/GroupBotService");
const telegramBotService = require("./services/notification/telegram/TelegramBotService");
const dingTalkBotService = require("./services/notification/dingtalk/DingTalkBotService");
const dailyReportGenerator = require("./services/DailyReportGenerator");
const {
  notificationServices,
  getEnabledNotifications,
} = require("./config/modules");

async function run() {
  console.log("开始执行日报生成...");

  try {
    // 生成日报内容
    const messageContent = await dailyReportGenerator.generateDailyMessage();

    if (!messageContent || messageContent.includes("消息生成失败")) {
      process.exitCode = 1;
      console.error("日报生成失败，终止通知发送");
      return;
    }

    // 根据配置动态启用通知服务
    const enabledServices = getEnabledNotifications();
    console.log("启用的通知服务:", enabledServices.join(", ") || "无");

    // DRY_RUN：只走生成、落盘、发布流程，不真的发消息。
    // 用于验证改动，避免每验证一次就往群里发一条。
    if (process.env.DRY_RUN === "true") {
      console.log("🧪 DRY_RUN 已开启：跳过所有通知渠道的发送");
      console.log("执行完成！");
      return;
    }

    const notifications = [];
    let failedDeliveries = 0;

    if (notificationServices.telegram) {
      notifications.push(
        telegramBotService
          .sendMessage(messageContent)
          .then((ok) => {
            if (ok === false) failedDeliveries++;
            console.log("✅ Telegram 发送完成");
          })
          .catch((e) => {
            failedDeliveries++;
            console.error("❌ Telegram 发送失败:", e.message);
          })
      );
    }

    if (notificationServices.dingtalk) {
      notifications.push(
        dingTalkBotService
          .sendMarkdown("每日播报", messageContent)
          .then(() => console.log("✅ 钉钉 发送完成"))
          .catch((e) => {
            failedDeliveries++;
            console.error("❌ 钉钉 发送失败:", e.message);
          })
      );
    }

    if (notificationServices.wxBot) {
      notifications.push(
        groupBotService
          .sendMarkdown(messageContent)
          .then(() => console.log("✅ 企微群机器人 发送完成"))
          .catch((e) => {
            failedDeliveries++;
            console.error("❌ 企微群机器人 发送失败:", e.message);
          })
      );
    }

    if (notificationServices.wxApp) {
      notifications.push(
        wxBotService
          .sendMessage(messageContent)
          .then(() => console.log("✅ 企微应用 发送完成"))
          .catch((e) => {
            failedDeliveries++;
            console.error("❌ 企微应用 发送失败:", e.message);
          })
      );
    }

    if (notifications.length === 0) {
      console.warn("⚠️ 没有启用任何通知服务");
    } else {
      await Promise.all(notifications);
      if (failedDeliveries > 0) {
        process.exitCode = 1;
        console.error(`${failedDeliveries} 个通知渠道发送失败`);
      }
    }

    console.log("执行完成！");
  } catch (error) {
    console.error("执行出错：", error);
    process.exitCode = 1;
  }
}

// 运行主函数
run();
