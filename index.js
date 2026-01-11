const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const crypto = require("crypto");

// ================== ENV ==================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

const ROLE_CHANNEL_ID = process.env.ROLE_CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID;

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const FACEBOOK_URL = process.env.FACEBOOK_URL || "https://facebook.com";
const THUMBNAIL_URL = process.env.THUMBNAIL_URL || null;
const IMAGE_URL = process.env.IMAGE_URL || null;

const VERIFY_BASE = process.env.VERIFY_BASE || "dinobux";
const VERIFY_SECRET = process.env.VERIFY_SECRET || ""; // ตั้งค่าให้เป็น string ยาวๆ เพื่อให้ได้ dinobux-#### แบบเดาไม่ได้
const VERIFY_TZ = process.env.VERIFY_TZ || "Asia/Bangkok";

// โหมดพิเศษ (ถ้าตั้ง FORCE_POST=1 จะโพสต์ใหม่ทุกครั้ง — ถ้าไม่อยากเด้งรัวๆ ให้ลบหรือใช้ 0)
const FORCE_POST = (process.env.FORCE_POST || "").trim() === "1";

// ================== CLIENT ==================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ================== HELPERS ==================
function normalize(str) {
  return String(str || "").trim().toLowerCase();
}

function getTimeSlot(date = new Date(), minutesPerSlot = 10) {
  // อิง timezone ที่กำหนด เพื่อให้เวลาไทยเสถียร
  // ใช้ Intl เพื่อให้ “วัน/เวลา” ตรงตามโซน
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: VERIFY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const y = Number(parts.year);
  const mo = Number(parts.month);
  const d = Number(parts.day);
  const h = Number(parts.hour);
  const mi = Number(parts.minute);

  const totalMinutes = h * 60 + mi;
  const slotIndex = Math.floor(totalMinutes / minutesPerSlot);

  // key แบบรายวัน + slot
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}-${slotIndex}`;
}

function make4DigitsFromHash(input) {
  // ดึงเลข 4 ตัวจาก hash แบบคงที่ใน slot นั้นๆ
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const num = parseInt(hash.slice(0, 8), 16) % 10000;
  return String(num).padStart(4, "0");
}

function getVerifyPhraseForDate(date = new Date()) {
  // ถ้าไม่ตั้ง SECRET จะได้แค่ VERIFY_BASE (เช่น "dinobux")
  if (!VERIFY_SECRET) return VERIFY_BASE;

  const slotKey = getTimeSlot(date, 10); // เปลี่ยนทุก 10 นาที
  const digits = make4DigitsFromHash(`${VERIFY_SECRET}|${VERIFY_BASE}|${slotKey}`);
  return `${VERIFY_BASE}-${digits}`;
}

function getValidVerifyPhrases() {
  // รับได้ทั้ง “โค้ดช่วงนี้” และ “โค้ดช่วงก่อนหน้า” กันคนพิมพ์ช้า
  const now = new Date();
  const cur = getVerifyPhraseForDate(now);

  const prev = new Date(now.getTime() - 10 * 60 * 1000);
  const prevCode = getVerifyPhraseForDate(prev);

  return [cur, prevCode];
}

function buildWelcomeEmbed(member) {
  const embed = new EmbedBuilder()
    .setTitle("🛒 Dinobux Official Store")
    .setURL(FACEBOOK_URL)
    .setDescription(
      `🦖 Welcome ${member} to Dinobux!\n\n` +
        `ร้านจำหน่าย Robux สำหรับเกม Roblox\n` +
        `✓ ราคาดี\n` +
        `✓ ปลอดภัย 100%\n` +
        `✓ ส่งไว / มีแอดมินดูแล\n\n` +
        `📌 ไปที่ห้องยืนยันตัวตนเพื่อรับยศเข้าใช้งานเซิร์ฟเวอร์`
    )
    .setColor(0x22c55e);

  if (THUMBNAIL_URL) embed.setThumbnail(THUMBNAIL_URL);
  if (IMAGE_URL) embed.setImage(IMAGE_URL);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("เข้า Facebook ร้าน Dinobux").setStyle(ButtonStyle.Link).setURL(FACEBOOK_URL)
  );

  return { embed, row };
}

function buildVerifyEmbed(verifyPhrase) {
  const embed = new EmbedBuilder()
    .setTitle("🦖 DINOBUX VERIFICATION")
    .setDescription(
      "กดปุ่มด้านล่างเพื่อ **ยืนยันตัวตน** และรับยศเข้าใช้งานเซิร์ฟเวอร์ ✅\n\n" +
        `📌 กรุณาพิมพ์คำว่า: \`${verifyPhrase}\`\n\n` +
        "🛒 สนใจเติม Robux / สอบถามโปรฯ ทักแอดมินได้เลย (ส่งไว ปลอดภัย)\n" +
        "📜 ก่อนสั่งซื้อ กรุณาอ่านกฎ/ประกาศเพื่อความชัวร์ ✅"
    )
    .setColor(0x22c55e);

  if (THUMBNAIL_URL) embed.setThumbnail(THUMBNAIL_URL);
  if (IMAGE_URL) embed.setImage(IMAGE_URL);

  return embed;
}

function buildVerifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("dinobux_verify_btn")
      .setLabel("กดยืนยันตัวตน")
      .setStyle(ButtonStyle.Success)
  );
}

async function sendVerifyLog(guild, member, typedRaw, role) {
  try {
    if (!LOG_CHANNEL_ID) return;
    const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!ch || !ch.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle("✅ VERIFICATION SUCCESSFUL !!")
      .setDescription(`✅ ยืนยันสำเร็จ : ${member}\n\n📝 คำที่พิมพ์ : \`${typedRaw}\`\n\n🎯 ยศที่ได้รับ : ${role}`)
      .setColor(0x22c55e)
      .setThumbnail(member.displayAvatarURL({ size: 256 }));

    await ch.send({ embeds: [embed] });
  } catch (e) {
    console.error("send log error:", e);
  }
}

// ================== VERIFY MESSAGE UPSERT ==================
const verifyMessageIdByGuild = new Map();
const lastVerifyCodeByGuild = new Map();

async function upsertVerifyMessageForGuild(guild) {
  if (!ROLE_CHANNEL_ID) return;

  const channel = guild.channels.cache.get(ROLE_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) return;

  const verifyPhrase = getVerifyPhraseForDate(new Date());

  // ถ้าโค้ดยังไม่เปลี่ยน และมี message id แล้ว → ไม่ต้องทำอะไร
  if (!FORCE_POST && verifyMessageIdByGuild.has(guild.id) && lastVerifyCodeByGuild.get(guild.id) === verifyPhrase) {
    return;
  }

  const embed = buildVerifyEmbed(verifyPhrase);
  const row = buildVerifyRow();

  // ลองใช้ message ที่เคยจำไว้ก่อน
  let message = null;
  const savedId = verifyMessageIdByGuild.get(guild.id);

  try {
    if (!FORCE_POST && savedId) {
      message = await channel.messages.fetch(savedId).catch(() => null);
    }

    // ถ้าไม่มี id หรือหาไม่เจอ ลองหา message เดิมใน 50 ข้อความล่าสุด (เพื่อไม่ให้โพสต์ซ้ำ)
    if (!FORCE_POST && !message) {
      const messages = await channel.messages.fetch({ limit: 50 });
      const found = messages.find(
        (m) =>
          m.author?.id === client.user.id &&
          m.components?.length &&
          m.components.some((r) => r.components?.some((c) => c.customId === "dinobux_verify_btn"))
      );
      if (found) message = found;
    }

    if (FORCE_POST || !message) {
      const sent = await channel.send({ embeds: [embed], components: [row] });
      verifyMessageIdByGuild.set(guild.id, sent.id);
      lastVerifyCodeByGuild.set(guild.id, verifyPhrase);
      return;
    }

    await message.edit({ embeds: [embed], components: [row] });
    verifyMessageIdByGuild.set(guild.id, message.id);
    lastVerifyCodeByGuild.set(guild.id, verifyPhrase);
  } catch (e) {
    console.error("upsert verify error:", e);
  }
}

// ================== EVENTS ==================
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // อัปเดต verify message ครั้งแรกทุกกิลด์
  for (const [, guild] of client.guilds.cache) {
    await upsertVerifyMessageForGuild(guild);
  }

  // เช็คทุก 1 นาที (แต่จะ edit เฉพาะตอนโค้ดเปลี่ยน)
  setInterval(async () => {
    for (const [, guild] of client.guilds.cache) {
      await upsertVerifyMessageForGuild(guild);
    }
  }, 60 * 1000);
});

// Welcome เมื่อคนเข้าเซิร์ฟ
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (!WELCOME_CHANNEL_ID) return;
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    const { embed, row } = buildWelcomeEmbed(member);
    await channel.send({ embeds: [embed], components: [row] });
  } catch (e) {
    console.error("welcome error:", e);
  }
});

// Interaction: ปุ่ม + ฟอร์ม
client.on(Events.InteractionCreate, async (interaction) => {
  // กดปุ่มเปิดฟอร์ม
  if (interaction.isButton() && interaction.customId === "dinobux_verify_btn") {
    const verifyPhrase = getVerifyPhraseForDate(new Date());

    const modal = new ModalBuilder()
      .setCustomId("dinobux_verify_modal")
      .setTitle("กรอกข้อมูลให้ถูกต้อง");

    const input = new TextInputBuilder()
      .setCustomId("dinobux_verify_input")
      .setLabel(`พิมพ์คำว่า: ${verifyPhrase}`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(verifyPhrase);

    modal.addComponents(new ActionRowBuilder().addComponents(input));

    try {
      return await interaction.showModal(modal);
    } catch (e) {
      console.error("showModal error:", e);
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ content: "❌ เปิดฟอร์มไม่สำเร็จ ลองใหม่อีกครั้ง", ephemeral: true });
      }
    }
    return;
  }

  // ส่งฟอร์มยืนยัน
  if (interaction.isModalSubmit() && interaction.customId === "dinobux_verify_modal") {
    await interaction.deferReply({ ephemeral: true });
    const typed = interaction.fields.getTextInputValue("dinobux_verify_input");
    const userInput = normalize(typed);

    const valid = getValidVerifyPhrases().map(normalize);

    // ✅ รับได้ทั้งโค้ดช่วงปัจจุบัน + โค้ดช่วงก่อนหน้า
    if (!valid.includes(userInput)) {
      return interaction.editReply({
        content: "❌ คำไม่ถูกต้อง ลองกดปุ่มยืนยันใหม่แล้วพิมพ์ตามอีกครั้ง",
      });
    }

    const role = interaction.guild?.roles?.cache?.get(ROLE_ID);
    if (!role) {
      return interaction.editReply({ content: "❌ ไม่พบยศในเซิร์ฟเวอร์ (ติดต่อแอดมิน)" });
    }

    if (interaction.member?.roles?.cache?.has(ROLE_ID)) {
      return interaction.editReply({ content: "คุณยืนยันแล้ว ✅ (มียศอยู่แล้ว)" });
    }

    try {
      await interaction.member.roles.add(role, "Dinobux verification passed");

      // ✅ ส่ง log หลังเพิ่มยศสำเร็จ
      await sendVerifyLog(interaction.guild, interaction.member, typed, role);

      return interaction.editReply({ content: `✅ ยืนยันสำเร็จ! ได้รับยศ: ${role}` });
    } catch (e) {
      console.error("add role error:", e);
      return interaction.editReply({
        content:
          "❌ บอทเพิ่มยศไม่ได้\n" +
          "เช็ค: 1) บอทมี Manage Roles 2) Role บอทต้องอยู่สูงกว่า Role ที่จะแจก",
      });
    }
  }
});

// ================== LOGIN ==================
client.login(DISCORD_TOKEN);
