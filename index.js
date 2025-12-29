require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// อ่านค่าจาก Environment (Render/ENV)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

const ROLE_CHANNEL_ID = process.env.ROLE_CHANNEL_ID; // 1455150392278257725
const ROLE_ID = process.env.ROLE_ID;                 // 1455179147839279215

const FACEBOOK_URL = process.env.FACEBOOK_URL || "https://discord.com";
const IMAGE_URL = process.env.IMAGE_URL || null;
const THUMBNAIL_URL = process.env.THUMBNAIL_URL || null;

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // ✅ ส่งปุ่มรับยศอัตโนมัติ (กันส่งซ้ำ)
  try {
    if (!ROLE_CHANNEL_ID || !ROLE_ID) {
      console.log("⚠️ ROLE_CHANNEL_ID / ROLE_ID ยังไม่ตั้งค่าใน Environment");
      return;
    }

    for (const [, guild] of client.guilds.cache) {
      const channel = guild.channels.cache.get(ROLE_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) continue;

      // เช็ค 50 ข้อความล่าสุด ว่ามีปุ่ม claim_role ของบอทแล้วหรือยัง
      const messages = await channel.messages.fetch({ limit: 50 });
      const alreadyExists = messages.some(
        (m) =>
          m.author?.id === client.user.id &&
          m.components?.length > 0 &&
          m.components.some((row) =>
            row.components.some((c) => c.customId === "claim_role")
          )
      );

      if (alreadyExists) {
        console.log("ℹ️ พบข้อความรับยศแล้ว → ไม่ส่งซ้ำ");
        continue;
      }

      const embed = new EmbedBuilder()
        .setTitle("✅ รับยศสมาชิก")
        .setDescription(
          "กดปุ่มด้านล่างเพื่อรับยศเข้าใช้งานเซิร์ฟเวอร์\n\n" +
          "ถ้ากดแล้วไม่ขึ้น โปรดแจ้งแอดมิน"
        )
        .setColor(0x22c55e);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim_role")
          .setLabel("รับยศ")
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [embed], components: [row] });
      console.log("✅ ส่งปุ่มรับยศอัตโนมัติเรียบร้อย");
    }
  } catch (e) {
    console.log("❌ Auto role message error:", e);
  }
});

// ✅ Welcome
client.on("guildMemberAdd", async (member) => {
  try {
    if (!WELCOME_CHANNEL_ID) return;

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle("🛒 Dinobux Official Store")
      .setURL(FACEBOOK_URL) // กันพังด้วย fallback
      .setDescription(
        `🦖 Welcome ${member} to Dinobux!\n\n` +
          `ร้านจำหน่าย Robux สำหรับเกม Roblox\n` +
          `✓ ราคาดี\n` +
          `✓ ปลอดภัย 100%\n` +
          `✓ ส่งไว / มีแอดมินดูแล\n\n` +
          `📌 ไปที่ห้อง <#${ROLE_CHANNEL_ID || WELCOME_CHANNEL_ID}> เพื่อกดรับยศ`
      )
      .setColor(0x22c55e);

    if (THUMBNAIL_URL) embed.setThumbnail(THUMBNAIL_URL);
    if (IMAGE_URL) embed.setImage(IMAGE_URL);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("เข้า Facebook ร้าน Dinobux")
        .setStyle(ButtonStyle.Link)
        .setURL(FACEBOOK_URL)
    );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (e) {
    console.log("❌ Welcome error:", e);
  }
});

// ✅ กดปุ่มรับยศ
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "claim_role") return;

  try {
    const role = interaction.guild.roles.cache.get(ROLE_ID);
    if (!role) {
      return interaction.reply({
        content: "❌ ไม่พบ Role (ติดต่อแอดมิน)",
        ephemeral: true,
      });
    }

    if (interaction.member.roles.cache.has(ROLE_ID)) {
      return interaction.reply({
        content: "คุณมียศนี้อยู่แล้ว ✅",
        ephemeral: true,
      });
    }

    await interaction.member.roles.add(role, "User claimed role via button");
    return interaction.reply({
      content: `🎉 รับยศเรียบร้อย: ${role}`,
      ephemeral: true,
    });
  } catch (e) {
    return interaction.reply({
      content:
        "❌ บอทเพิ่มยศไม่ได้\n" +
        "เช็ค: 1) บอทมี Manage Roles 2) Role บอทต้องสูงกว่า Role นี้",
      ephemeral: true,
    });
  }
});

client.login(DISCORD_TOKEN);
