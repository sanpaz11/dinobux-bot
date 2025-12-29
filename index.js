require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ===== ENV =====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const FACEBOOK_URL = process.env.FACEBOOK_URL || "https://discord.com";
const IMAGE_URL = process.env.IMAGE_URL || null;
const THUMBNAIL_URL = process.env.THUMBNAIL_URL || null;

const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

const ROLE_CHANNEL_ID = process.env.ROLE_CHANNEL_ID; // 1455150392278257725
const ROLE_ID = process.env.ROLE_ID;                 // 1455179147839279215

const VERIFY_CODE_RAW = process.env.VERIFY_CODE || "dinobux";
const VERIFY_CODE = VERIFY_CODE_RAW.trim().toLowerCase();

// ใส่ FORCE_POST=1 ใน Render ชั่วคราวเพื่อบังคับโพสต์
const FORCE_POST = String(process.env.FORCE_POST || "0") === "1";

const normalize = (s) => (s || "").trim().toLowerCase();

// ===== ส่งข้อความ Verification อัตโนมัติ (กันส่งซ้ำ/บังคับส่งได้) =====
async function postVerifyMessageIfNeeded(guild) {
  console.log(`➡️ [AutoPost] Guild: ${guild.name}`);

  if (!ROLE_CHANNEL_ID || !ROLE_ID) {
    console.log("❌ [AutoPost] Missing ROLE_CHANNEL_ID / ROLE_ID", {
      ROLE_CHANNEL_ID,
      ROLE_ID,
    });
    return;
  }

  // ✅ สำคัญ: ใช้ fetch เพื่อกันกรณี cache ไม่มี / บอทมองไม่เห็น
  const channel = await guild.channels.fetch(ROLE_CHANNEL_ID).catch(() => null);

  if (!channel) {
    console.log("❌ [AutoPost] ไม่เจอห้อง หรือบอทมองไม่เห็นห้อง:", ROLE_CHANNEL_ID);
    return;
  }

  if (!channel.isTextBased()) {
    console.log("❌ [AutoPost] ROLE_CHANNEL_ID ไม่ใช่ text channel:", ROLE_CHANNEL_ID);
    return;
  }

  console.log("✅ [AutoPost] Found role channel:", channel.name);

  // กันส่งซ้ำ (ยกเว้น FORCE_POST=1)
  if (!FORCE_POST) {
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);

    if (!messages) {
      console.log("❌ [AutoPost] อ่านประวัติข้อความไม่ได้ (ขาด Read Message History?)");
      return;
    }

    const alreadyExists = messages.some(
      (m) =>
        m.author?.id === client.user.id &&
        m.components?.length > 0 &&
        m.components.some((row) =>
          row.components.some((c) => c.customId === "dinobux_verify_btn")
        )
    );

    console.log("ℹ️ [AutoPost] alreadyExists =", alreadyExists);

    if (alreadyExists) {
      console.log("✅ [AutoPost] Skip (มีข้อความ verify อยู่แล้ว)");
      return;
    }
  } else {
    console.log("⚠️ [AutoPost] FORCE_POST=1 → จะโพสต์ใหม่ทุกครั้งที่รีสตาร์ท");
  }

  const embed = new EmbedBuilder()
    .setTitle("🦖 DINOBUX VERIFICATION")
    .setDescription(
      "กดปุ่มด้านล่างเพื่อ **ยืนยันตัวตน** และรับยศเข้าใช้งานเซิร์ฟเวอร์ ✅\n\n" +
        `📌 กรุณาพิมพ์คำว่า: **${VERIFY_CODE_RAW}**`
    )
    .setColor(0x22c55e);

  if (THUMBNAIL_URL) embed.setThumbnail(THUMBNAIL_URL);
  if (IMAGE_URL) embed.setImage(IMAGE_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dinobux_verify_btn")
      .setLabel("กดยืนยันตัวตน")
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [row] });
  console.log("✅ [AutoPost] Posted verification message!");
}

// ===== READY =====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // โพสต์ verify อัตโนมัติทุก guild ที่บอทอยู่
  try {
    for (const [, guild] of client.guilds.cache) {
      await postVerifyMessageIfNeeded(guild);
    }
  } catch (e) {
    console.log("❌ [AutoPost] Error:", e);
  }
});

// ===== WELCOME =====
client.on("guildMemberAdd", async (member) => {
  try {
    if (!WELCOME_CHANNEL_ID) return;

    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle("🛒 Dinobux Official Store")
      .setURL(FACEBOOK_URL)
      .setDescription(
        `🦖 Welcome ${member} to Dinobux!\n\n` +
          `ร้านจำหน่าย Robux สำหรับเกม Roblox\n` +
          `✓ ราคาดี\n` +
          `✓ ปลอดภัย 100%\n` +
          `✓ ส่งไว / มีแอดมินดูแล\n\n` +
          `➡️ ไปที่ห้อง <#${ROLE_CHANNEL_ID || WELCOME_CHANNEL_ID}> เพื่อกด “ยืนยันตัวตน” และรับยศ`
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

// ===== INTERACTIONS: ปุ่ม → modal, modal → ตรวจคำ → ให้ role =====
client.on(Events.InteractionCreate, async (interaction) => {
  // กดปุ่ม → เปิด modal
  if (interaction.isButton() && interaction.customId === "dinobux_verify_btn") {
    const modal = new ModalBuilder()
      .setCustomId("dinobux_verify_modal")
      .setTitle("กรอกข้อมูลให้ถูกต้อง");

    const input = new TextInputBuilder()
      .setCustomId("dinobux_verify_input")
      .setLabel(`พิมพ์คำว่า: ${VERIFY_CODE_RAW}`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(VERIFY_CODE_RAW);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  // ส่ง modal → ตรวจคำ → ให้ role
  if (interaction.isModalSubmit() && interaction.customId === "dinobux_verify_modal") {
    const text = interaction.fields.getTextInputValue("dinobux_verify_input");
    const userInput = normalize(text);

    if (userInput !== VERIFY_CODE) {
      return interaction.reply({ content: "❌ คำไม่ถูกต้อง ลองใหม่อีกครั้ง", ephemeral: true });
    }

    const role = interaction.guild.roles.cache.get(ROLE_ID);
    if (!role) {
      return interaction.reply({ content: "❌ ไม่พบยศในเซิร์ฟเวอร์ (ติดต่อแอดมิน)", ephemeral: true });
    }

    if (interaction.member.roles.cache.has(ROLE_ID)) {
      return interaction.reply({ content: "คุณยืนยันแล้ว ✅ (มียศอยู่แล้ว)", ephemeral: true });
    }

    try {
      await interaction.member.roles.add(role, "Dinobux verification passed");
      return interaction.reply({ content: `✅ ยืนยันสำเร็จ! ได้รับยศ: ${role}`, ephemeral: true });
    } catch (e) {
      return interaction.reply({
        content:
          "❌ บอทเพิ่มยศไม่ได้\n" +
          "เช็ค: 1) บอทมี Manage Roles 2) Role บอทต้องอยู่สูงกว่า Role ที่จะแจก",
        ephemeral: true,
      });
    }
  }
});

client.login(DISCORD_TOKEN);
