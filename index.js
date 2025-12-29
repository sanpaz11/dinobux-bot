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

const prefix = "!";

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ✅ Welcome
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
  if (!channel) return;

  const facebookUrl = process.env.FACEBOOK_URL || "https://discord.com";

  const embed = new EmbedBuilder()
    .setTitle("🛒 Dinobux Official Store")
    .setURL(facebookUrl) // กันพังถ้าไม่มีค่า
    .setDescription(
      `🦖 Welcome ${member} to Dinobux!\n\n` +
        `ร้านจำหน่าย Robux สำหรับเกม Roblox\n` +
        `✓ ราคาดี\n` +
        `✓ ปลอดภัย 100%\n` +
        `✓ ส่งไว / มีแอดมินดูแล\n\n` +
        `📌 ไปที่ห้อง <#${process.env.ROLE_CHANNEL_ID || process.env.WELCOME_CHANNEL_ID}> เพื่อกดรับยศ`
    )
    .setColor(0x22c55e)
    .setThumbnail(process.env.THUMBNAIL_URL || null)
    .setImage(process.env.IMAGE_URL || null);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("เข้า Facebook ร้าน Dinobux")
      .setStyle(ButtonStyle.Link)
      .setURL(facebookUrl)
  );

  await channel.send({ embeds: [embed], components: [row] });
});

// ✅ คำสั่งวางปุ่มรับยศในห้อง #รับยศ
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (message.content === `${prefix}setup-role`) {
    // จำกัดให้ใช้เฉพาะห้องที่กำหนด
    if (message.channel.id !== process.env.ROLE_CHANNEL_ID) {
      return message.reply("ไปพิมพ์คำสั่งนี้ในห้อง #รับยศ เท่านั้นนะ");
    }

    const embed = new EmbedBuilder()
      .setTitle("✅ กดรับยศเพื่อเข้าใช้งานเซิร์ฟเวอร์")
      .setDescription("กดปุ่มด้านล่างเพื่อรับยศสมาชิก")
      .setColor(0x22c55e);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("claim_role")
        .setLabel("รับยศ")
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    return message.reply("วางปุ่มรับยศเรียบร้อย ✅");
  }
});

// ✅ ตอนกดปุ่ม “รับยศ”
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "claim_role") return;

  const role = interaction.guild.roles.cache.get(process.env.ROLE_ID);
  if (!role) {
    return interaction.reply({ content: "หา Role ไม่เจอ (เช็ค ROLE_ID)", ephemeral: true });
  }

  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({ content: "คุณมียศนี้อยู่แล้ว ✅", ephemeral: true });
  }

  try {
    await interaction.member.roles.add(role, "User claimed role");
    return interaction.reply({ content: `รับยศเรียบร้อย! ได้ยศ: ${role}`, ephemeral: true });
  } catch (e) {
    return interaction.reply({
      content:
        "บอทเพิ่มยศไม่ได้ ❌\n" +
        "เช็ค: 1) บอทมีสิทธิ์ Manage Roles 2) ยศบอทอยู่สูงกว่า ROLE_ID",
      ephemeral: true,
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
