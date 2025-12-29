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

const ROLE_CHANNEL_ID = "1455150392278257725";
const ROLE_ID = "1455179147839279215";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    for (const [, guild] of client.guilds.cache) {
      const channel = guild.channels.cache.get(ROLE_CHANNEL_ID);
      if (!channel || !channel.isTextBased()) continue;

      // 🔎 เช็คว่ามีข้อความรับยศอยู่แล้วไหม (50 ข้อความล่าสุด)
      const messages = await channel.messages.fetch({ limit: 50 });
      const alreadyExists = messages.some(
        (m) =>
          m.author.id === client.user.id &&
          m.components.length > 0 &&
          m.components[0].components.some(
            (c) => c.customId === "claim_role"
          )
      );

      if (alreadyExists) {
        console.log("ℹ️ พบข้อความรับยศแล้ว → ไม่ส่งซ้ำ");
        continue;
      }

      // ✨ ส่งข้อความรับยศ
      const embed = new EmbedBuilder()
        .setTitle("✅ รับยศสมาชิก")
        .setDescription(
          "กดปุ่มด้านล่างเพื่อรับยศเข้าใช้งานเซิร์ฟเวอร์\n\n" +
          "หากกดแล้วไม่ขึ้น โปรดแจ้งแอดมิน"
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
    console.log("❌ Auto role error:", e);
  }
});

// 👉 ตอนกดปุ่ม
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "claim_role") return;

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

  try {
    await interaction.member.roles.add(role, "Auto role button");
    await interaction.reply({
      content: `🎉 รับยศเรียบร้อย: ${role}`,
      ephemeral: true,
    });
  } catch (e) {
    await interaction.reply({
      content:
        "❌ บอทเพิ่มยศไม่ได้\n" +
        "ตรวจสอบ: Role บอทต้องสูงกว่า Role สมาชิก",
      ephemeral: true,
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
