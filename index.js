require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🛒 Dinobux Official Store")
    .setURL(process.env.FACEBOOK_URL) // ✅ กดหัวข้อแล้วไป Facebook
    .setDescription(
      `🦖 Welcome ${member} to Dinobux!\n\n` +
      `ร้านจำหน่าย Robux สำหรับเกม Roblox\n` +
      `✓ ราคาดี\n` +
      `✓ ปลอดภัย 100%\n` +
      `✓ ส่งไว / มีแอดมินดูแล\n\n` +
      `📌 กรุณาอ่านกฎก่อนสั่งซื้อ\n` +
      `📌 ติดต่อแอดมินได้ตลอด`
    )
    .setColor(0x22c55e)
    .setThumbnail(process.env.THUMBNAIL_URL)
    .setImage(process.env.IMAGE_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("เข้า Facebook ร้าน Dinobux")
      .setStyle(ButtonStyle.Link)
      .setURL(process.env.FACEBOOK_URL)
  );

  await channel.send({ embeds: [embed], components: [row] });
});

client.login(process.env.DISCORD_TOKEN);
