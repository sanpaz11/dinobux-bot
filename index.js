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

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // ส่งปุ่มรับยศไปที่ห้อง #รับยศ อัตโนมัติ (ครั้งแรกที่บอทออนไลน์)
  try {
    const guilds = await client.guilds.fetch();
    for (const [, g] of guilds) {
      const guild = await g.fetch();
      const roleChannel = guild.channels.cache.get(process.env.ROLE_CHANNEL_ID);
      if (!roleChannel || !roleChannel.isTextBased()) continue;

      const embed = new EmbedBuilder()
        .setTitle("✅ รับยศสมาชิก")
        .setDescription(
          "กดปุ่มด้านล่างเพื่อรับยศเข้าใช้งานเซิร์ฟเวอร์\n\n" +
          "ถ้ากดแล้วไม่ขึ้น ให้แจ้งแอดมิน (บอทอาจไม่มีสิทธิ์/ลำดับยศต่ำเกินไป)"
        )
        .setColor(0x22c55e);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("claim_role")
          .setLabel("รับยศ")
          .setStyle(ButtonStyle.Success)
      );

      // ส่ง 1 ครั้งพอ: ถ้าคุณไม่อยากให้ส่งซ้ำทุกครั้งที่รีสตาร์ท
      // แนะนำให้คอมเมนต์ 3 บรรทัดนี้หลังส่งครั้งแรกสำเร็จ
      await roleChannel.send({ embeds: [embed], components: [row] });
    }
  } catch (e) {
    console.log("❌ Auto role message error:", e);
  }
});

// welcome เดิมของคุณ (ปรับเล็กน้อยให้ไม่พังถ้า FACEBOOK_URL ไม่มี)
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("🛒 Dinobux Official Store")
    .setURL(process.env.FACEBOOK_URL || "https://discord.com")
    .setDescription(
      `🦖 Welcome ${member} to Dinobux!\n\n` +
      `ร้านจำหน่าย Robux สำหรับเกม Roblox\n` +
      `✓ ราคาดี\n` +
      `✓ ปลอดภัย 100%\n` +
      `✓ ส่งไว / มีแอดมินดูแล\n\n` +
      `📌 กรุณาอ่านกฎก่อนสั่งซื้อ\n` +
      `📌 ติดต่อแอดมินได้ตลอด\n\n` +
      `➡️ ไปที่ห้อง <#${process.env.ROLE_CHANNEL_ID}> เพื่อกดรับยศ`
    )
    .setColor(0x22c55e)
    .setThumbnail(process.env.THUMBNAIL_URL)
    .setImage(process.env.IMAGE_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("เข้า Facebook ร้าน Dinobux")
      .setStyle(ButtonStyle.Link)
      .setURL(process.env.FACEBOOK_URL || "https://discord.com")
  );

  await channel.send({ embeds: [embed], components: [row] });
});

// ตอนกดปุ่ม “รับยศ”
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "claim_role") return;

  const role = interaction.guild.roles.cache.get(process.env.ROLE_ID);
  if (!role) return interaction.reply({ content: "หา Role ไม่เจอ (เช็ค ROLE_ID)", ephemeral: true });

  // กันกดซ้ำ
  if (interaction.member.roles.cache.has(role.id)) {
    return interaction.reply({ content: "คุณมียศนี้อยู่แล้ว ✅", ephemeral: true });
  }

  try {
    await interaction.member.roles.add(role, "User claimed role");
    return interaction.reply({ content: `รับยศเรียบร้อย! ได้ยศ: ${role}`, ephemeral: true });
  } catch (err) {
    return interaction.reply({
      content:
        "บอทเพิ่มยศไม่ได้ ❌\n" +
        "เช็ค 1) บอทมีสิทธิ์ Manage Roles 2) ยศบอทต้องอยู่สูงกว่า ROLE_ID",
      ephemeral: true,
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
