import { NextFunction } from "grammy";
import { BotContext } from "../index";

export async function forceJoinMiddleware(ctx: BotContext, next: NextFunction) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const CHANNEL_ID = "@your_channel_username"; // Replace with your actual channel username or ID

  try {
    const member = await ctx.api.getChatMember(CHANNEL_ID, userId);
    
    // Check if user is member, administrator, or creator
    const isMember = ["member", "administrator", "creator"].includes(member.status);

    if (!isMember) {
      await ctx.reply(
        "⚠️ **Access Denied!**\n\nYou must join our official channel to unlock the 45 USDC Referral Program.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📢 Join Channel", url: `https://t.me/${CHANNEL_ID.replace('@', '')}` }],
              [{ text: "🔄 Check Membership Status", callback_data: "check_membership" }]
            ]
          },
          parse_mode: "Markdown"
        }
      );
      return; // Short-circuit the request
    }

    // If joined, proceed to the next handler/command
    await next();
  } catch (error) {
    console.error("Error checking channel membership:", error);
    // Fallback if bot is not admin in channel yet
    await next();
  }
}
