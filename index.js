require("dotenv").config();
const crypto = require("crypto");
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

const ROLE_CHANNEL_ID = process.env.ROLE_CHANNEL_ID; // ห้องรับยศ
const ROLE_ID = process.env.ROLE_ID;                 // ยศที่จะให้

// ห้อง log
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ✅ โค้ดเปลี่ยนทุก 10 นาที: dinobux-#### (แนะนำให้ใช้)
const VERIFY_BASE = (process.env.VERIFY_BASE || "dinobux").trim();
const VERIFY_SECRET = (process.env.VERIFY_SECRET || "").trim();
const VERIFY_TZ = (process.env.VERIFY_TZ || "Asia/Bangkok").trim();

// ใส่ FORCE_POST=1 เฉพาะตอนอยาก “บังคับโพสต์ใหม่”
const FORCE_POST = String(process.env.FORCE_POST || "0") === "1";

const normalize = (s) => (s || "").trim().toLowerCase();

// กันบอทแก้ไขข้อความถี่เกินไป: ถ้าโค้ดยังไม่เปลี่ยนจะไม่ edit ซ้ำ
const lastVerifyCodeByGuild = new Map();

/**
 * คืนค่า slot key ทุก 10 นาที ตาม timezone
 * ตัวอย่าง: "2025-12-29 13:20"
 */
function getSlotKey10Min(timeZone, date = new Date()) {
  let y, mo, d, h, mi;

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    y = parts.find((p) => p.type === "year")?.value;
    mo = parts.find((p) => p.type === "month")?.value;
    d = parts.find((p) => p.type === "day")?.value;
    h = parts.find((p) => p.type === "hour")?.value;
    mi = parts.find((p) => p.type === "minute")?.value;
  } catch (_) {
    // fallback UTC+7 แบบง่าย
    const now = new Date(date.getTime());
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bkk = new Date(utc + 7 * 3600000);
    y = String(bkk.getUTCFullYear());
    mo = String(bkk.getUTCMonth() + 1).padStart(2, "0");
    d = String(bkk.getUTCDate()).padStart(2, "0");
    h = String(bkk.getUTCHours()).padStart(2, "0");
    mi = String(bkk.getUTCMinutes()).padStart(2, "0");
  }

  const minute = Number(mi);
  const slot = Math.floor(minute / 10) * 10; // 00,10,20,30,40,50
  const slotMin = String(slot).padStart(2, "0");

  return `${y}-${mo}-${d} ${h}:${slotMin}`;
}

function getVerifyPhraseForDate(date = new Date()) {
  // ถ้าไม่ตั้ง secret -> fallback เป็นคำตายตัว (ไม่แนะนำ)
  if (!VERIFY_SECRET) return VERIFY_BASE.toLowerCase();

  const slotKey = getSlotKey10Min(VERIFY_TZ, date);
  const h = crypto
    .createHmac("sha256", VERIFY_SECRET)
    .update(`${VERIFY_BASE}|${slotKey}`)
    .digest("hex");

  const num = parseInt(h.slice(0, 8), 16) % 10000;
  const code4 = String(num).padStart(4, "0");
  return `${VERIFY_BASE}-${code4}`.toLowerCase();
}

/**
 * เพื่อกันคนกรอกไม่ทันตอนโค้ดเปลี่ยน:
 * - ยอมรับโค้ด “ช่วงปัจจุบัน”
 * - และ “ช่วงก่อนหน้า 10 นาที”
 */
function getValidVerifyPhrases() {
  const now = new Date();
  const current = getVerifyPhraseForDate(now);
  const prev = getVerifyPhraseForDate(new Date(now.getTime() - 10 * 60 * 1000));
  // กันซ้ำกรณีเวลาพอดีเป๊ะ
  return current === prev ? [current] : [current, prev];
}

function buildVerifyEmbed(verifyPhrase) {
  const embed = new EmbedBuilder()
    .setTitle("🦖 DINOBUX VERIFICATION")
    .setDescription(
      "กดปุ่มด้านล่างเพื่อ **ยืนยันตัวตน** และรับยศเข้าใช้งานเซิร์ฟเวอร์ ✅\n\n" +
        `📌 อย่าลืมอ่านวิธีการซื้อกันพวกDinosaur` +
        `⏱️Dinobux Store`
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

// ===== LOG เมื่อยืนยันสำเร็จ =====
async function sendVerifyLog(guild, member, typedText, role) {
  if (!LOG_CHANNEL_ID) return;

  const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel || !logChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("✅ VERIFICATION SUCCESSFUL !!")
    .setColor(0x22c55e)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      `✅ ยืนยันสำเร็จ : ${member}\n\n` +
        `📝 การยืนยันตัวตนที่พิมพ์เข้ามา : \`${typedText}\`\n\n` +
        `🔎 ยศที่ได้รับ : ${role}`
    )
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

// ===== ส่ง/แก้ไขข้อความ Verification อัตโนมัติ (ไม่สแปม) =====
async function upsertVerifyMessage(guild) {
  console.log(`➡️ [VerifyUpsert] Guild: ${guild.name}`);

  if (!ROLE_CHANNEL_ID || !ROLE_ID) {
    console.log("❌ [VerifyUpsert] Missing ROLE_CHANNEL_ID / ROLE_ID");
    return;
  }

  const channel = await guild.channels.fetch(ROLE_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.log("❌ [VerifyUpsert] ไม่เจอห้อง หรือบอทมองไม่เห็นห้อง:", ROLE_CHANNEL_ID);
    return;
  }
  if (!channel.isTextBased()) {
    console.log("❌ [VerifyUpsert] ROLE_CHANNEL_ID ไม่ใช่ text channel:", ROLE_CHANNEL_ID);
    return;
  }

  const verifyPhrase = getVerifyPhraseForDate(new Date()); // ✅ เปลี่ยนทุก 10 นาที
  console.log("🔐 [VerifyUpsert] Current code =", verifyPhrase);

  const embed = buildVerifyEmbed(verifyPhrase);
  const row = buildVerifyRow();

  // บังคับโพสต์ (ถ้าต้องการ)
  if (FORCE_POST) {
    await channel.send({ embeds: [embed], components: [row] });
    console.log("⚠️ [VerifyUpsert] FORCE_POST=1 → Posted new message");
    return;
  }

  // หาโพสต์เดิมของบอทแล้วแก้ไข
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) {
    console.log("❌ [VerifyUpsert] อ่านประวัติข้อความไม่ได้ (ขาด Read Message History?)");
    return;
  }

  const existing = messages.find(
    (m) =>
      m.author?.id === client.user.id &&
      m.components?.length > 0 &&
      m.components.some((r) =>
        r.components.some((c) => c.customId === "dinobux_verify_btn")
      )
  );

  // ถ้ามีโพสต์อยู่แล้ว และโค้ดยังไม่เปลี่ยน -> ไม่ต้อง edit ซ้ำ
  const last = lastVerifyCodeByGuild.get(guild.id);

  if (existing) {
    if (last === verifyPhrase) {
      // ไม่ทำอะไร ลด spam edit
      return;
    }
    await existing.edit({ embeds: [embed], components: [row] });
    lastVerifyCodeByGuild.set(guild.id, verifyPhrase);
    console.log("✅ [VerifyUpsert] Updated existing verify message");
  } else {
    await channel.send({ embeds: [embed], components: [row] });
    lastVerifyCodeByGuild.set(guild.id, verifyPhrase);
    console.log("✅ [VerifyUpsert] Posted new verify message");
  }
}

// ===== READY =====
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    for (const [, guild] of client.guilds.cache) {
      await upsertVerifyMessage(guild);
    }

    // ✅ เช็คทุก 1 นาที (โค้ดเปลี่ยนทุก 10 นาที)
    setInterval(async () => {
      for (const [, guild] of client.guilds.cache) {
        await upsertVerifyMessage(guild);
      }
    }, 60 * 1000);
  } catch (e) {
    console.log("❌ [VerifyUpsert] Error:", e);
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

// ===== INTERACTIONS: ปุ่ม → modal, modal → ตรวจคำ → ให้ role + log =====
client.on(Events.InteractionCreate, async (interaction) => {
  // กดปุ่ม → เปิด modal
  if (interaction.isButton() && interaction.customId === "dinobux_verify_btn") {
    const verifyPhrase = getVerifyPhraseForDate(new Date()); // ✅ โค้ดช่วงปัจจุบัน

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
    return interaction.showModal(modal);
  }

  // ส่ง modal → ตรวจคำ → ให้ role
  if (interaction.isModalSubmit() && interaction.customId === "dinobux_verify_modal") {
    const typed = interaction.fields.getTextInputValue("dinobux_verify_input");
    const userInput = normalize(typed);

    const valid = getValidVerifyPhrases().map(normalize);

    // ✅ รับได้ทั้งโค้ดช่วงปัจจุบัน + โค้ดช่วงก่อนหน้า 10 นาที
    if (!valid.includes(userInput)) {
      return interaction.reply({
        content: "❌ คำไม่ถูกต้อง (โค้ดเปลี่ยนทุก 10 นาที) ลองกดปุ่มยืนยันใหม่แล้วพิมพ์ตามอีกครั้ง",
        ephemeral: true,
      });
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

      // ✅ ส่ง log หลังเพิ่มยศสำเร็จ
      await sendVerifyLog(interaction.guild, interaction.member, typed, role);

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

