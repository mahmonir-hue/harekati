import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGame,
  render,
  resetGame,
  resizeGame,
  triggerBoost,
  triggerShield,
  update,
  updateAmbient,
  type GameState,
} from "./game/engine";
import { audio, type AudioState } from "./game/audio";
import { PoseController, POSE_THRESHOLD, type CameraStatus, type DebugInfo, type ModelStatus } from "./game/pose";

type Phase = "menu" | "playing" | "over";
type Lang = "fa" | "en" | "ar";

const LANG_KEY = "posepilot.lang";
const BEST_KEY = "posepilot.best";
const PHONE = "00971551544988";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/* ------------------------------ i18n ------------------------------ */

function faNum(value: string | number, lang: Lang): string {
  const s = String(value);
  if (lang === "en") return s;
  const digits = lang === "ar" ? AR_DIGITS : FA_DIGITS;
  return s.replace(/[0-9]/g, (d) => digits[Number(d)]);
}

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "en" || v === "ar" ? v : "fa";
  } catch {
    return "fa";
  }
}

interface Strings {
  tagline: string;
  score: string;
  lives: string;
  shield: string;
  shieldUp: string;
  noShield: string;
  boost: string;
  restart: string;
  camera: string;
  camOnBtn: string;
  camOffBtn: string;
  camOff: string;
  camOn: string;
  camStarting: string;
  camDenied: string;
  camInsecure: string;
  camError: string;
  modelReady: string;
  modelLoading: string;
  modelError: string;
  modelIdle: string;
  aiStatus: string;
  modelLbl: string;
  predictionLbl: string;
  currentAction: string;
  stateReady: string;
  stateError: string;
  statePending: string;
  stateLoading: string;
  stateRunning: string;
  stateStopped: string;
  shortCamOn: string;
  shortCamOff: string;
  detected: string;
  confidence: string;
  scanning: string;
  camHelp: string;
  camNote: string;
  badge: string;
  startGame: string;
  descA: string;
  stars: string;
  descB: string;
  meteors: string;
  descC: string;
  controlsTitle: string;
  kbdLabel: string;
  scoring: string;
  poseGuide: string;
  gameOver: string;
  hullBreach: string;
  finalScore: string;
  starsCaught: string;
  relaunchA: string;
  relaunchB: string;
  relaunchC: string;
  publish: string;
  publishCopied: string;
  publishShared: string;
  publishFailed: string;
  audioPanel: string;
  play: string;
  pause: string;
  stop: string;
  volumeDown: string;
  volumeUp: string;
  volumeLabel: string;
  about: string;
  aboutP1: string;
  creatorLineA: string;
  creatorName: string;
  creatorLineB: string;
  instructorLbl: string;
  instructorName: string;
  contactLbl: string;
  help: string;
  closeLbl: string;
  controlPanel: string;
  bestScore: string;
  landscapeHint: string;
  moveLeft: string;
  moveRight: string;
}

const T: Record<Lang, Strings> = {
  fa: {
    tagline: "پرواز فضایی با کنترل بدن",
    score: "امتیاز",
    lives: "جان",
    shield: "سپر",
    shieldUp: "سپر فعال",
    noShield: "بدون سپر",
    boost: "شتاب",
    restart: "شروع دوباره",
    camera: "دوربین",
    camOnBtn: "روشن کردن دوربین",
    camOffBtn: "خاموش کردن دوربین",
    camOff: "دوربین خاموش است",
    camOn: "دوربین روشن است",
    camStarting: "در حال روشن کردن دوربین...",
    camDenied: "اجازه دسترسی به دوربین داده نشده است. لطفاً دسترسی دوربین را در تنظیمات مرورگر فعال کنید.",
    camInsecure: "وبکم نیاز به HTTPS یا localhost دارد.",
    camError: "خطای دوربین — جزئیات در کنسول مرورگر ثبت شد.",
    modelReady: "مدل حرکتی آماده است",
    modelLoading: "در حال بارگیری مدل حرکتی...",
    modelError: "خطای مدل حرکتی:",
    modelIdle: "مدل حرکتی پس از روشن شدن دوربین بارگیری می‌شود.",
    aiStatus: "وضعیت هوش مصنوعی",
    modelLbl: "مدل",
    predictionLbl: "پیش‌بینی",
    currentAction: "کنش جاری",
    stateReady: "آماده",
    stateError: "خطا",
    statePending: "در انتظار",
    stateLoading: "در حال بارگیری",
    stateRunning: "در حال اجرا",
    stateStopped: "متوقف",
    shortCamOn: "روشن",
    shortCamOff: "خاموش",
    detected: "حرکت تشخیص داده‌شده",
    confidence: "میزان اطمینان",
    scanning: "در حال جست‌وجوی ژست...",
    camHelp: "برای کنترل سفینه با حرکات بدن، دوربین را روشن کنید.",
    camNote: "دوربین فقط پس از کلیک روی دکمهٔ دوربین فعال می‌شود",
    badge: "TEACHABLE MACHINE · POSE MODEL",
    startGame: "شروع بازی",
    descA: "سفینهٔ کوچک را با بدن خود هدایت کنید؛ ",
    stars: "ستاره‌ها",
    descB: " را بگیرید و از ",
    meteors: "شهاب‌سنگ‌ها",
    descC: " دوری کنید.",
    controlsTitle: "کنترل‌ها — ژست بدن + کیبورد",
    kbdLabel: "کیبورد",
    scoring: "هر ستاره ۱۰+ امتیاز · هر شهاب‌سنگ ۱− جان · ۳ جان · سپر یک ضربه را دفع می‌کند",
    poseGuide: "راهنمای ژست‌ها",
    gameOver: "بازی تمام شد",
    hullBreach: "آسیب کامل به بدنه",
    finalScore: "امتیاز نهایی",
    starsCaught: "ستاره‌های گرفته‌شده",
    relaunchA: "برای پرواز دوباره",
    relaunchB: "یا",
    relaunchC: "را بزن",
    publish: "انتشار امتیاز",
    publishCopied: "کپی شد!",
    publishShared: "به‌اشتراک گذاشته شد",
    publishFailed: "کپی ناموفق بود",
    audioPanel: "صدا",
    play: "پخش",
    pause: "مکث",
    stop: "توقف",
    volumeDown: "کاهش صدا",
    volumeUp: "افزایش صدا",
    volumeLabel: "صدا",
    about: "👨‍💻 درباره سازنده",
    aboutP1: "این پروژه با هدف یادگیری، خلاقیت و تجربه عملی در برنامه‌نویسی و هوش مصنوعی ساخته شده است.",
    creatorLineA: "این بازی یکی از بازی‌های ساخته‌شده توسط",
    creatorName: "هانیه، ۱۷ ساله از دبی",
    creatorLineB: "است.",
    instructorLbl: "استاد:",
    instructorName: "دکتر ماه منیر آقایی",
    contactLbl: "📞 شماره تماس استاد:",
    help: "🎮 راهنمای بازی",
    closeLbl: "بستن",
    controlPanel: "پنل کنترل",
    bestScore: "بهترین امتیاز",
    landscapeHint: "برای تجربه بهتر، گوشی را افقی کنید",
    moveLeft: "حرکت به چپ",
    moveRight: "حرکت به راست",
  },
  en: {
    tagline: "body-controlled space run",
    score: "Score",
    lives: "Lives",
    shield: "Shield",
    shieldUp: "Shield up",
    noShield: "No shield",
    boost: "Boost",
    restart: "Restart",
    camera: "Camera",
    camOnBtn: "Turn Camera On",
    camOffBtn: "Turn Camera Off",
    camOff: "Camera Off",
    camOn: "Camera On",
    camStarting: "Starting Camera...",
    camDenied: "Camera permission denied. Please allow camera access in browser settings.",
    camInsecure: "Webcam requires HTTPS or localhost.",
    camError: "Camera error — details logged to browser console.",
    modelReady: "Pose Model Ready",
    modelLoading: "Loading motion model...",
    modelError: "Pose Model Error:",
    modelIdle: "Pose model loads after the camera is turned on.",
    aiStatus: "AI STATUS",
    modelLbl: "Model",
    predictionLbl: "Prediction",
    currentAction: "Current Action",
    stateReady: "READY",
    stateError: "ERROR",
    statePending: "PENDING",
    stateLoading: "LOADING",
    stateRunning: "RUNNING",
    stateStopped: "STOPPED",
    shortCamOn: "ON",
    shortCamOff: "OFF",
    detected: "Detected Pose",
    confidence: "Confidence",
    scanning: "Scanning for poses...",
    camHelp: "Turn on the camera to control the spaceship with your body.",
    camNote: "The camera turns on only when you click the camera button",
    badge: "TEACHABLE MACHINE · POSE MODEL",
    startGame: "Start Game",
    descA: "Steer a tiny spaceship with your body. Catch falling ",
    stars: "stars",
    descB: ", dodge ",
    meteors: "meteors",
    descC: ", survive the drift.",
    controlsTitle: "Controls — body poses + keyboard",
    kbdLabel: "Key",
    scoring: "+10 points per star · meteor −1 life · 3 lives · shield absorbs one hit",
    poseGuide: "Pose Guide",
    gameOver: "Game Over",
    hullBreach: "HULL BREACH",
    finalScore: "Final Score",
    starsCaught: "Stars caught",
    relaunchA: "PRESS",
    relaunchB: "OR",
    relaunchC: "TO RELAUNCH",
    publish: "Publish Score",
    publishCopied: "Copied!",
    publishShared: "Shared",
    publishFailed: "Copy failed",
    audioPanel: "Audio",
    play: "Play",
    pause: "Pause",
    stop: "Stop",
    volumeDown: "Volume Down",
    volumeUp: "Volume Up",
    volumeLabel: "Volume",
    about: "👨‍💻 About the Creator",
    aboutP1: "This project was created with the goal of learning, creativity, and gaining practical experience in programming and artificial intelligence.",
    creatorLineA: "This game is one of the games created by",
    creatorName: "Hanieh, a 17-year-old from Dubai",
    creatorLineB: ".",
    instructorLbl: "Instructor:",
    instructorName: "Dr. Mah Monir Aghaei",
    contactLbl: "📞 Instructor Contact:",
    help: "🎮 Game Guide",
    closeLbl: "Close",
    controlPanel: "Control Panel",
    bestScore: "Best Score",
    landscapeHint: "For a better experience, rotate your phone to landscape",
    moveLeft: "Move left",
    moveRight: "Move right",
  },
  ar: {
    tagline: "تحليق فضائي بالتحكم الجسدي",
    score: "النقاط",
    lives: "الأرواح",
    shield: "الدرع",
    shieldUp: "الدرع مفعّل",
    noShield: "بدون درع",
    boost: "الاندفاع",
    restart: "إعادة البدء",
    camera: "الكاميرا",
    camOnBtn: "تشغيل الكاميرا",
    camOffBtn: "إيقاف الكاميرا",
    camOff: "الكاميرا مطفأة",
    camOn: "الكاميرا تعمل",
    camStarting: "جارٍ تشغيل الكاميرا...",
    camDenied: "تم رفض الوصول إلى الكاميرا. يرجى السماح بالوصول من إعدادات المتصفح.",
    camInsecure: "تتطلب الكاميرا اتصال HTTPS أو localhost.",
    camError: "خطأ في الكاميرا — التفاصيل في وحدة تحكم المتصفح.",
    modelReady: "نموذج الحركة جاهز",
    modelLoading: "جارٍ تحميل نموذج الحركة...",
    modelError: "خطأ في نموذج الحركة:",
    modelIdle: "يُحمَّل نموذج الحركة بعد تشغيل الكاميرا.",
    aiStatus: "حالة الذكاء الاصطناعي",
    modelLbl: "النموذج",
    predictionLbl: "التنبؤ",
    currentAction: "الإجراء الحالي",
    stateReady: "جاهز",
    stateError: "خطأ",
    statePending: "بالانتظار",
    stateLoading: "جارٍ التحميل",
    stateRunning: "قيد التشغيل",
    stateStopped: "متوقف",
    shortCamOn: "تعمل",
    shortCamOff: "مطفأة",
    detected: "الوضعية المكتشفة",
    confidence: "نسبة الثقة",
    scanning: "جارٍ البحث عن وضعية...",
    camHelp: "شغّل الكاميرا للتحكم في السفينة بحركات جسمك.",
    camNote: "تعمل الكاميرا فقط عند الضغط على زر الكاميرا",
    badge: "TEACHABLE MACHINE · POSE MODEL",
    startGame: "ابدأ اللعبة",
    descA: "قُد سفينة فضائية صغيرة بجسمك. التقط ",
    stars: "النجوم",
    descB: " المتساقطة وتفادَ ",
    meteors: "النيازك",
    descC: " لتنجو.",
    controlsTitle: "التحكم — وضعيات الجسم + لوحة المفاتيح",
    kbdLabel: "المفتاح",
    scoring: "لكل نجم +١٠ نقاط · النيزك −١ روح · ٣ أرواح · الدرع يمتص ضربة واحدة",
    poseGuide: "دليل الوضعيات",
    gameOver: "انتهت اللعبة",
    hullBreach: "اختراق الهيكل",
    finalScore: "النتيجة النهائية",
    starsCaught: "النجوم الملتقطة",
    relaunchA: "اضغط",
    relaunchB: "أو",
    relaunchC: "للانطلاق من جديد",
    publish: "نشر النتيجة",
    publishCopied: "تم النسخ!",
    publishShared: "تمت المشاركة",
    publishFailed: "فشل النسخ",
    audioPanel: "الصوت",
    play: "تشغيل",
    pause: "إيقاف مؤقت",
    stop: "إيقاف",
    volumeDown: "خفض الصوت",
    volumeUp: "رفع الصوت",
    volumeLabel: "الصوت",
    about: "👨‍💻 حول مطوّر اللعبة",
    aboutP1: "تم إنشاء هذا المشروع بهدف التعلم والإبداع واكتساب الخبرة العملية في البرمجة والذكاء الاصطناعي.",
    creatorLineA: "هذه اللعبة هي إحدى الألعاب التي قامت بتطويرها",
    creatorName: "هانية، البالغة من العمر 17 عامًا من دبي",
    creatorLineB: ".",
    instructorLbl: "المدرّسة:",
    instructorName: "د. ماه منير آقايي",
    contactLbl: "📞 رقم التواصل مع المدرّسة:",
    help: "🎮 دليل اللعبة",
    closeLbl: "إغلاق",
    controlPanel: "لوحة التحكم",
    bestScore: "أفضل نتيجة",
    landscapeHint: "لتجربة أفضل، أدر هاتفك أفقياً",
    moveLeft: "التحرك يساراً",
    moveRight: "التحرك يميناً",
  },
};

/** Exact pose instructions (from the mission brief) for the help panel. */
const GUIDE: Record<Lang, Array<{ cls: string; pose: string; action: string }>> = {
  fa: [
    { cls: "Class 1", pose: "دست چپ را به سمت چپ باز کنید", action: "حرکت سفینه به چپ" },
    { cls: "Class 2", pose: "دست راست را به سمت راست باز کنید", action: "حرکت سفینه به راست" },
    { cls: "Class 3", pose: "هر دو دست را به دو طرف باز کنید", action: "فعال شدن سپر" },
    { cls: "Class 4", pose: "هر دو دست را بالا ببرید", action: "حرکت سفینه به بالا" },
  ],
  en: [
    { cls: "Class 1", pose: "Extend left arm to the left", action: "Move spaceship left" },
    { cls: "Class 2", pose: "Extend right arm to the right", action: "Move spaceship right" },
    { cls: "Class 3", pose: "Extend both arms sideways", action: "Activate shield" },
    { cls: "Class 4", pose: "Raise both hands", action: "Boost upward" },
  ],
  ar: [
    { cls: "Class 1", pose: "مدّ الذراع اليسرى نحو اليسار", action: "تحريك السفينة إلى اليسار" },
    { cls: "Class 2", pose: "مدّ الذراع اليمنى نحو اليمين", action: "تحريك السفينة إلى اليمين" },
    { cls: "Class 3", pose: "مدّ الذراعين إلى الجانبين", action: "تفعيل الدرع" },
    { cls: "Class 4", pose: "رفع اليدين إلى الأعلى", action: "الاندفاع نحو الأعلى" },
  ],
};

const KBD_KEYS = ["←", "→", "SPACE", "↑"];

/** Full game guide — written from the actual engine logic, per language. */
interface GuideContent {
  objectiveT: string;
  objectiveB: string;
  howT: string;
  how: string[];
  flowT: string;
  flow: string[];
  resultT: string;
  resultB: string;
  tipsT: string;
  tips: string[];
}

const GUIDE_CONTENT: Record<Lang, GuideContent> = {
  fa: {
    objectiveT: "🎯 هدف بازی",
    objectiveB:
      "سفینه را در میدان فضایی هدایت کنید، ستاره‌های زردِ در حال سقوط را بگیرید و از شهاب‌سنگ‌ها جاخالی بدهید. هرچه ستاره‌های بیشتری جمع کنید و بیشتر دوام بیاورید، امتیاز بالاتری می‌گیرید.",
    howT: "🎮 روش بازی",
    how: [
      "برای شروع، دکمهٔ «شروع بازی» را بزنید (یا کلید Space یا Enter).",
      "حرکت به چپ و راست: با کیبورد ← و →، با دکمه‌های لمسی بزرگ روی موبایل، یا با ژست بدن پس از روشن کردن دوربین.",
      "سپر (کلید Space یا کلاس ۳ بدن): یک ضربهٔ شهاب‌سنگ را دفع می‌کند و پس از آن حدود ۱٫۲ ثانیه تا شارژ دوباره زمان لازم است.",
      "شتاب (کلید ↑ یا کلاس ۴ بدن): سفینه برای لحظه‌ای به سمت بالا می‌پرد.",
      "هر ستارهٔ زرد = ۱۰+ امتیاز. ستاره‌ها خیلی بیشتر از شهاب‌سنگ‌ها ظاهر می‌شوند.",
      "برخورد با شهاب‌سنگ = ۱− جان. شما ۳ جان دارید و بعد از هر برخورد، حدود ۱٫۸ ثانیه مصون هستید.",
    ],
    flowT: "🔄 روند بازی",
    flow: [
      "بازی از منوی اصلی شروع می‌شود؛ با «شروع بازی»، سفینه در نزدیکی پایینِ مرکز صفحه ظاهر می‌شود.",
      "ستاره‌ها و شهاب‌سنگ‌ها از بالای صفحه به‌آرامی پایین می‌آیند.",
      "با گرفتن ستاره‌ها امتیاز می‌گیرید و با جاخالی دادن از شهاب‌سنگ‌ها، جان‌هایتان را حفظ می‌کنید.",
      "امتیاز، جان‌ها و وضعیت سپر همیشه در نوار بالای صفحه نمایش داده می‌شوند.",
      "وقتی هر سه جان از دست برود، بازی تمام می‌شود.",
      "با «شروع دوباره» یا کلیدهای Space / R بلافاصله از نو شروع کنید.",
    ],
    resultT: "🏆 پایان بازی",
    resultB:
      "در پایان، صفحهٔ «بازی تمام شد» امتیاز نهایی، تعداد ستاره‌های گرفته‌شده و بهترین امتیاز شما را نشان می‌دهد. بهترین امتیاز روی همین دستگاه ذخیره می‌شود و با دکمهٔ «انتشار امتیاز» می‌توانید نتیجه را به اشتراک بگذارید.",
    tipsT: "💡 نکته‌ها",
    tips: [
      "حرکت سفینه نرم و پیوسته است؛ نیازی به حرکات تند و پشت‌سرهم نیست — نگه‌داشتن ژست، حرکت را ادامه می‌دهد.",
      "سپر فقط یک ضربه را دفع می‌کند؛ آن را برای لحظه‌های خطر نگه دارید.",
      "بعد از هر برخورد، سفینه برای مدت کوتاهی چشمک می‌زند و مصون است — از همین فرصت برای جابه‌جایی استفاده کنید.",
      "برای تشخیص بهتر ژست‌ها، نور اتاق کافی باشد و بالاتنهٔ شما کامل داخل کادر دوربین باشد.",
      "اگر دوربین خاموش باشد، کیبورد و دکمه‌های لمسی همیشه کار می‌کنند.",
    ],
  },
  en: {
    objectiveT: "🎯 Objective",
    objectiveB:
      "Steer the spaceship across the space field, catch the falling yellow stars and dodge the meteors. The more stars you collect and the longer you survive, the higher your score.",
    howT: "🎮 How to play",
    how: [
      "Press “Start Game” (or the Space / Enter key) to begin.",
      "Move left and right with the ← and → keys, the big on-screen touch buttons on mobile, or body poses after turning the camera on.",
      "Shield (Space key or body Class 3): absorbs exactly one meteor hit, then needs about 1.2 seconds to recharge.",
      "Boost (↑ key or body Class 4): the ship hops upward for a brief moment.",
      "Each yellow star = +10 points. Stars appear far more often than meteors.",
      "Hitting a meteor = −1 life. You have 3 lives, and about 1.8 seconds of invulnerability after each hit.",
    ],
    flowT: "🔄 Game flow",
    flow: [
      "The game starts from the main menu; after “Start Game” the ship appears near the bottom center of the screen.",
      "Stars and meteors drift down slowly from the top of the screen.",
      "Collect stars to score and dodge meteors to keep your lives.",
      "Score, lives and shield status are always visible in the top bar.",
      "When all three lives are lost, the game ends.",
      "Press “Restart” or the Space / R keys to instantly play again.",
    ],
    resultT: "🏆 Game results",
    resultB:
      "At the end, the “Game Over” screen shows your final score, the number of stars caught and your best score. The best score is saved on this device, and the “Publish Score” button lets you share your result.",
    tipsT: "💡 Tips",
    tips: [
      "Ship movement is smooth and continuous — no need for repeated quick gestures; holding a pose keeps the ship moving.",
      "The shield absorbs only one hit; save it for dangerous moments.",
      "After each hit the ship blinks and is invulnerable for a short time — use that moment to reposition.",
      "For better pose detection, keep the room well lit and your upper body fully inside the camera frame.",
      "If the camera is off, the keyboard and touch buttons always work.",
    ],
  },
  ar: {
    objectiveT: "🎯 هدف اللعبة",
    objectiveB:
      "قُد السفينة في الميدان الفضائي، والتقط النجوم الصفراء المتساقطة وتفادَ النيازك. كلما جمعت نجوماً أكثر وصمدت أطول، ارتفعت نقاطك.",
    howT: "🎮 طريقة اللعب",
    how: [
      "اضغط «ابدأ اللعبة» (أو مفتاح المسافة / Enter) للبدء.",
      "التحرك يميناً ويساراً: بمفتاحي ← و→، أو بأزرار اللمس الكبيرة على الجوال، أو بوضعيات الجسم بعد تشغيل الكاميرا.",
      "الدرع (مفتاح المسافة أو وضعية Class 3): يمتص ضربة نيزك واحدة فقط، ثم يحتاج نحو ١٫٢ ثانية لإعادة الشحن.",
      "الاندفاع (مفتاح ↑ أو وضعية Class 4): تقفز السفينة نحو الأعلى لحظة قصيرة.",
      "كل نجم أصفر = +١٠ نقاط. تظهر النجوم أكثر بكثير من النيازك.",
      "الاصطدام بنيزك = −١ روح. لديك ٣ أرواح، وتكون محمياً نحو ١٫٨ ثانية بعد كل اصطدام.",
    ],
    flowT: "🔄 سير اللعبة",
    flow: [
      "تبدأ اللعبة من القائمة الرئيسية؛ بعد «ابدأ اللعبة» تظهر السفينة قرب أسفل منتصف الشاشة.",
      "تهبط النجوم والنيازك ببطء من أعلى الشاشة.",
      "اجمع النجوم لتحصد النقاط وتفادَ النيازك للحفاظ على أرواحك.",
      "تظهر النقاط والأرواح وحالة الدرع دائماً في الشريط العلوي.",
      "عند خسارة الأرواح الثلاثة تنتهي اللعبة.",
      "اضغط «إعادة البدء» أو مفتاحي المسافة / R للبدء من جديد فوراً.",
    ],
    resultT: "🏆 نهاية اللعبة",
    resultB:
      "في النهاية تعرض شاشة «انتهت اللعبة» نتيجتك النهائية وعدد النجوم الملتقطة وأفضل نتيجة لك. تُحفظ أفضل نتيجة على هذا الجهاز، ويُمكّنك زر «نشر النتيجة» من مشاركة نتيجتك.",
    tipsT: "💡 نصائح",
    tips: [
      "حركة السفينة ناعمة ومستمرة — لا حاجة لحركات سريعة متكررة؛ إبقاء الوضعية يواصل التحريك.",
      "الدرع يمتص ضربة واحدة فقط؛ احتفظ به للحظات الخطر.",
      "بعد كل اصطدام تومض السفينة وتكون محمية لفترة قصيرة — استغلها لإعادة التموضع.",
      "لكشف أفضل للوضعيات، أبقِ الغرفة مضاءة جيداً واجعل الجزء العلوي من جسمك كاملاً داخل إطار الكاميرا.",
      "إذا كانت الكاميرا مطفأة، تعمل لوحة المفاتيح وأزرار اللمس دائماً.",
    ],
  },
};

/* --------------------------- tiny SVG icons --------------------------- */

function ShipIcon({ dim }: { dim?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-all duration-300 ${
        dim ? "opacity-20 saturate-0" : "opacity-100 drop-shadow-[0_0_6px_rgba(94,234,255,0.8)]"
      }`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2c3.2 2.8 4.4 6.6 4.4 10.6L19 17l-3.4-.6L12 21l-3.6-4.6L5 17l2.6-4.4C7.6 8.6 8.8 4.8 12 2z" />
    </svg>
  );
}

function ShieldIcon({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-all duration-300 ${
        on ? "text-ion drop-shadow-[0_0_8px_rgba(94,234,255,0.9)]" : "text-slate-600"
      }`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l8 3.5V11c0 5.2-3.4 8.6-8 11-4.6-2.4-8-5.8-8-11V5.5L12 2z" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M4 5v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6 10A8 8 0 1 1 4 14" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="17.5" cy="5.5" r="2.6" />
      <circle cx="17.5" cy="18.5" r="2.6" />
      <path d="M8.4 10.8l6.8-4M8.4 13.2l6.8 4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="anim-pop-in h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M4.5 12.5l5 5L19.5 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <path d="M2 8l4-3h12a2 2 0 0 1 2 2v2l2-1v8l-2-1v2a2 2 0 0 1-2 2H6l-4-3V8z" strokeLinejoin="round" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.9c-.7.3-1 .8-1 1.5" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ left }: { left?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-6 w-6 ${left ? "" : "rotate-180"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      aria-hidden
    >
      <path d="M14.5 5.5L8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BoostIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M12 20V5M6 10.5L12 4.5l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h13M20 17h0.5" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="19" cy="17" r="2" />
    </svg>
  );
}

/* ------------------------------ modal -------------------------------- */

function Modal({
  title,
  closeLabel,
  rtl,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  rtl: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(3,5,20,0.72)] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        dir={rtl ? "rtl" : "ltr"}
        onClick={(e) => e.stopPropagation()}
        className="bracket-panel modal-scroll anim-rise relative max-h-[92dvh] w-full overflow-y-auto px-5 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-lg sm:px-8 sm:py-6"
      >
        <span className="corner-b" />
        <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between gap-3 border-b border-indigo-400/20 bg-[#0b1035]/95 px-5 pb-2.5 pt-1 backdrop-blur-sm sm:-mx-8 sm:px-8">
          <h3 className="font-display text-base font-black text-white sm:text-lg">{title}</h3>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            title={closeLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-indigo-400/40 bg-[#10163a] text-indigo-200 transition-colors duration-150 hover:bg-[#151d4c] hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------- app -------------------------------- */

const DEFAULT_DEBUG: DebugInfo = {
  tf: "pending",
  model: "idle",
  prediction: "stopped",
  probs: [0, 0, 0, 0],
  action: "NONE",
  error: "",
  labels: [],
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const gsRef = useRef<GameState>(
    createGame(typeof window !== "undefined" ? window.innerWidth : 800, typeof window !== "undefined" ? window.innerHeight : 600)
  );
  const kbRef = useRef({ left: false, right: false });
  const poseDirRef = useRef<"left" | "right" | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const poseRef = useRef<PoseController | null>(null);
  const hudRef = useRef({ score: -1, lives: -1, shield: false });

  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [shieldOn, setShieldOn] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [camStatus, setCamStatus] = useState<CameraStatus>("off");
  const [dbg, setDbg] = useState<DebugInfo>(DEFAULT_DEBUG);
  const [modelErr, setModelErr] = useState("");
  const [lang, setLang] = useState<Lang>(initialLang);
  const [guideOpen, setGuideOpen] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth >= 640
  );
  const [publishState, setPublishState] = useState<"idle" | "copied" | "shared" | "failed">("idle");
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [audioState, setAudioState] = useState<AudioState>("stopped");
  const [vol, setVol] = useState(audio.volume);
  const [modal, setModal] = useState<null | "about" | "guide">(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  });
  const [narrow, setNarrow] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );
  const [showTouch, setShowTouch] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768)
  );
  const [portraitPhone, setPortraitPhone] = useState<boolean>(
    () =>
      typeof window !== "undefined" && window.innerHeight > window.innerWidth && window.innerWidth < 768
  );
  const [hintGone, setHintGone] = useState(false);

  const t = T[lang];
  const rtl = lang !== "en";
  const gc = GUIDE_CONTENT[lang];

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const restart = useCallback(() => {
    resetGame(gsRef.current);
    hudRef.current = { score: -1, lives: -1, shield: false };
    setScore(0);
    setLives(3);
    setShieldOn(false);
    changePhase("playing");
    // background music starts only here — always a user gesture (button or key)
    void audio.play().then(() => {
      setAudioState(audio.state);
    });
  }, [changePhase]);

  /** Start / restart the run. Camera is controlled separately by its button. */
  const startGame = useCallback(() => {
    if (phaseRef.current === "playing") return;
    restart();
  }, [restart]);

  /** Explicit camera on/off — webcam permission is only requested here. */
  const toggleCamera = useCallback(async () => {
    const pc = poseRef.current;
    if (!pc) return;
    if (pc.cameraStatus === "on" || pc.cameraStatus === "starting") {
      pc.turnOff();
      return;
    }
    if (previewRef.current) await pc.turnOn(previewRef.current);
  }, []);

  /* ------------------- audio controls (Web Audio only) ------------------- */
  const syncAudio = useCallback(() => {
    setAudioState(audio.state);
    setVol(audio.volume);
  }, []);
  const handleAudioPlay = useCallback(() => {
    void audio.play().then(syncAudio);
  }, [syncAudio]);
  const handleAudioPause = useCallback(() => {
    audio.pause();
    syncAudio();
  }, [syncAudio]);
  const handleAudioStop = useCallback(() => {
    audio.stop();
    syncAudio();
  }, [syncAudio]);
  const handleVolDown = useCallback(() => {
    audio.volumeDown();
    syncAudio();
  }, [syncAudio]);
  const handleVolUp = useCallback(() => {
    audio.volumeUp();
    syncAudio();
  }, [syncAudio]);

  /** Publish the run result: native share sheet, then clipboard, then legacy copy. */
  const publishScore = useCallback(async () => {
    const gs = gsRef.current;
    const url = `${window.location.origin}${window.location.pathname}`;
    const msg =
      lang === "fa"
        ? `در بازی «خلبان کیهان» ${faNum(score, "fa")} امتیاز گرفتم و ${faNum(gs.collected, "fa")} ستاره گرفتم! 🚀`
        : `I scored ${score} points and caught ${gs.collected} stars in Pose Pilot! 🚀`;
    const fullText = `${msg}\n${url}`;

    const done = (s: "copied" | "shared" | "failed") => {
      setPublishState(s);
      if (publishTimer.current) clearTimeout(publishTimer.current);
      publishTimer.current = setTimeout(() => setPublishState("idle"), 2400);
    };

    const legacyCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = fullText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      done(ok ? "copied" : "failed");
    };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "خلبان کیهان | Pose Pilot", text: msg, url });
        done("shared");
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // user dismissed the sheet
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
        done("copied");
        return;
      }
    } catch {
      /* fall through to legacy copy */
    }
    legacyCopy();
  }, [lang, score]);

  /* ------------------ language: dir, lang attr, storage ------------------ */
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private mode — ignore */
    }
  }, [lang, rtl]);

  /* ------------------- responsive layout state (fluid) ------------------- */
  useEffect(() => {
    const onResize = () => {
      setNarrow(window.innerWidth < 640);
      setShowTouch(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);
      setPortraitPhone(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* close the mobile control panel with Escape */
  useEffect(() => {
    if (!panelOpen) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [panelOpen]);

  /* auto-hide the rotate hint after a few seconds */
  useEffect(() => {
    if (portraitPhone && phase === "playing" && !hintGone) {
      const id = setTimeout(() => setHintGone(true), 7000);
      return () => clearTimeout(id);
    }
  }, [portraitPhone, phase, hintGone]);

  /* ----------------------- touch gameplay handlers ----------------------- */
  const holdStart = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      kbRef.current[side] = true;
    },
    []
  );
  const holdEnd = useCallback(() => {
    kbRef.current.left = false;
    kbRef.current.right = false;
  }, []);
  const tapShield = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (phaseRef.current === "playing") {
        triggerShield(gsRef.current);
        audio.shield();
      }
    },
    []
  );
  const tapBoost = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (phaseRef.current === "playing") {
        triggerBoost(gsRef.current);
        audio.boost();
      }
    },
    []
  );

  /* ------------------------- mount: loop + input ------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resizeGame(gsRef.current, w, h);
    };
    fit();
    window.addEventListener("resize", fit);

    // Pose controller: webcam permission is requested ONLY on button click;
    // the TM model is loaded only after the webcam video is ready.
    const pc = new PoseController({
      onModelStatus: (s, err) => {
        setModelStatus(s);
        setModelErr(err);
      },
      onCameraStatus: (s) => setCamStatus(s),
      onDebug: (d) => setDbg(d),
      onMove: (dir) => {
        poseDirRef.current = dir;
      },
      onAction: (a) => {
        if (phaseRef.current !== "playing") return;
        if (a === "shield") {
          triggerShield(gsRef.current);
          audio.shield();
        } else {
          triggerBoost(gsRef.current);
          audio.boost();
        }
      },
    });
    poseRef.current = pc;

    // Keyboard fallback (always works, even with the camera off)
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          kbRef.current.left = down;
          e.preventDefault();
          break;
        case "ArrowRight":
          kbRef.current.right = down;
          e.preventDefault();
          break;
        case "ArrowUp":
          if (down && !e.repeat && phaseRef.current === "playing") {
            triggerBoost(gsRef.current);
            audio.boost();
          }
          e.preventDefault();
          break;
        case " ":
          e.preventDefault();
          if (!down) break;
          if (phaseRef.current === "menu") startGame();
          else if (phaseRef.current === "over" && !e.repeat) restart();
          else if (phaseRef.current === "playing" && !e.repeat) {
            triggerShield(gsRef.current);
            audio.shield();
          }
          break;
        case "Enter":
          if (down && !e.repeat) {
            if (phaseRef.current === "menu") startGame();
            else if (phaseRef.current === "over") restart();
          }
          break;
        case "r":
        case "R":
          if (down && !e.repeat && phaseRef.current !== "menu") restart();
          break;
      }
    };
    const kd = onKey(true);
    const ku = onKey(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    // Main loop
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const gs = gsRef.current;

      if (phaseRef.current === "playing") {
        const dir = poseDirRef.current;
        update(
          gs,
          { left: kbRef.current.left || dir === "left", right: kbRef.current.right || dir === "right" },
          dt
        );
        const hud = hudRef.current;
        if (gs.score !== hud.score) {
          if (hud.score >= 0 && gs.score > hud.score) audio.star(); // star collected
          hud.score = gs.score;
          setScore(gs.score);
        }
        if (gs.lives !== hud.lives) {
          if (hud.lives >= 0 && gs.lives < hud.lives) audio.hit(); // meteor collision
          hud.lives = gs.lives;
          setLives(gs.lives);
        }
        if (gs.ship.shield !== hud.shield) {
          hud.shield = gs.ship.shield;
          setShieldOn(gs.ship.shield);
        }
        if (gs.over) {
          const finalScore = gs.score;
          setBestScore((b) => {
            if (finalScore > b) {
              try {
                localStorage.setItem(BEST_KEY, String(finalScore));
              } catch {
                /* ignore */
              }
              return finalScore;
            }
            return b;
          });
          changePhase("over");
        }
      } else {
        updateAmbient(gs, dt);
      }

      render(ctx, gs, now / 1000);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      pc.dispose();
      poseRef.current = null;
      audio.dispose();
    };
  }, [changePhase, restart, startGame]);

  /* ------------------------------ UI pieces ------------------------------ */

  const camLine =
    camStatus === "off"
      ? t.camOff
      : camStatus === "starting"
        ? t.camStarting
        : camStatus === "denied"
          ? t.camDenied
          : camStatus === "insecure"
            ? t.camInsecure
            : camStatus === "error"
              ? t.camError
              : t.camOn;

  const modelLine =
    modelStatus === "idle"
      ? t.modelIdle
      : modelStatus === "loading"
        ? t.modelLoading
        : modelStatus === "error"
          ? `${t.modelError} ${modelErr || "unknown error"}`
          : t.modelReady;

  /* short state labels for the AI STATUS debug panel */
  const stateColor = (s: string) =>
    s === "ready" || s === "running" || s === "on"
      ? "text-emerald-300"
      : s === "error"
        ? "text-alert"
        : s === "loading"
          ? "text-star"
          : "text-indigo-300/70";
  const tfText = dbg.tf === "ready" ? t.stateReady : dbg.tf === "error" ? t.stateError : t.statePending;
  const modelText =
    dbg.model === "ready"
      ? t.stateReady
      : dbg.model === "error"
        ? t.stateError
        : dbg.model === "loading"
          ? t.stateLoading
          : t.statePending;
  const camText = camStatus === "on" ? t.shortCamOn : camStatus === "starting" ? "…" : t.shortCamOff;
  const predText = dbg.prediction === "running" ? t.stateRunning : t.stateStopped;

  const dotClass =
    camStatus === "on"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
      : camStatus === "starting"
        ? "bg-star anim-pulse-glow"
        : camStatus === "denied" || camStatus === "insecure" || camStatus === "error"
          ? "bg-alert shadow-[0_0_8px_rgba(255,93,115,0.8)]"
          : "bg-slate-600";

  const titleNode =
    lang === "en" ? (
      <>
        POSE<span className="text-ion glow-cyan">PILOT</span>
      </>
    ) : lang === "ar" ? (
      <>
        طيّار <span className="text-ion glow-cyan">الكون</span>
      </>
    ) : (
      <>
        خلبان <span className="text-ion glow-cyan">کیهان</span>
      </>
    );

  const guideRows = GUIDE[lang].map((g, i) => (
    <div key={g.cls} className={i > 0 ? "mt-2 border-t border-indigo-400/15 pt-2" : ""}>
      <p className="font-display text-[9px] font-bold tracking-[0.18em] text-ion/85">{g.cls}</p>
      <p className="mt-0.5 text-[10.5px] font-medium leading-snug text-indigo-100/90">{g.pose}</p>
      <p className="text-[10.5px] font-bold leading-snug text-star">→ {g.action}</p>
    </div>
  ));

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="relative h-full w-full touch-manipulation select-none overflow-hidden font-body">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 touch-none" />

      {/* verification version badge (top-left corner) */}
      <div
        dir="ltr"
        className="pointer-events-none absolute left-2 top-2 z-30 border border-ion/50 bg-[#0a0f2e]/95 px-2 py-0.5 font-display text-[9px] font-bold tracking-[0.14em] text-ion shadow-[0_0_10px_rgba(94,234,255,0.25)]"
      >
        VERSION: POSE-FIX-3
      </div>

      <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-50" />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(2,3,14,0.6) 100%)" }}
      />

      {/* ------------------------------ top HUD ------------------------------ */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-wrap items-start gap-y-2 px-3 pb-2 pt-8 sm:p-5 sm:pt-8">
        <div className="anim-rise w-full min-w-0 sm:w-auto">
          <h1 className="font-display text-lg font-extrabold text-white sm:text-2xl">{titleNode}</h1>
          <p className="mt-0.5 hidden text-[11px] font-medium text-indigo-300/70 sm:block">{t.tagline}</p>
          <div className="pointer-events-auto mt-1.5 inline-flex items-center rounded-full border border-indigo-400/30 bg-[#0d1340]/85 p-0.5 text-[10px] font-bold">
            {(["fa", "ar", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-full px-2 py-0.5 transition-colors duration-150 sm:px-2.5 sm:py-1 ${
                  lang === l ? "bg-ion/20 text-ion" : "text-indigo-300/70 hover:text-indigo-100"
                }`}
              >
                {l === "fa" ? "فارسی" : l === "ar" ? "العربية" : "English"}
              </button>
            ))}
          </div>
        </div>

        <div className="ms-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-3">
          <div className="hud-chip">
            <span className="hud-label">{t.score}</span>
            <span className="font-display text-base font-bold tabular-nums leading-none text-star glow-gold sm:text-xl">
              {faNum(String(score).padStart(4, "0"), lang)}
            </span>
          </div>

          <div className="hud-chip" title={t.lives}>
            <span className="hud-label">{t.lives}</span>
            <span className="flex items-center gap-1 text-ion">
              {[0, 1, 2].map((i) => (
                <ShipIcon key={i} dim={i >= lives} />
              ))}
            </span>
          </div>

          <div className={`hud-chip ${shieldOn ? "hud-chip--active" : ""}`} title={t.shield}>
            <ShieldIcon on={shieldOn} />
            <span className="hud-label hidden sm:inline">{shieldOn ? t.shieldUp : t.noShield}</span>
          </div>

          {phase !== "menu" && (
            <button
              onClick={restart}
              aria-label={t.restart}
              title={t.restart}
              className="btn-ghost pointer-events-auto flex min-h-9 items-center gap-2 px-2.5 py-2 text-[11px] font-bold sm:px-3.5"
            >
              <RestartIcon />
              <span className="hidden sm:inline">{t.restart}</span>
            </button>
          )}
        </div>
      </header>

      {/* --------------------------- pose guide panel (desktop) --------------------------- */}
      {!narrow && (
      <div className="absolute bottom-4 left-4 z-20 flex w-44 flex-col-reverse items-start gap-2 sm:w-64">
        <button
          onClick={() => setGuideOpen((o) => !o)}
          className="btn-ghost pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold"
        >
          <GuideIcon />
          {t.poseGuide}
          <span className="text-ion">{guideOpen ? "−" : "+"}</span>
        </button>

        {guideOpen && <div className="cam-panel w-full">{guideRows}</div>}
      </div>
      )}

      {/* mobile: floating control-panel opener */}
      {narrow && phase !== "menu" && (
        <button
          onClick={() => setPanelOpen(true)}
          aria-label={t.controlPanel}
          title={t.controlPanel}
          className="mini-btn absolute right-2.5 z-30 bottom-[max(6rem,calc(env(safe-area-inset-bottom)+5.5rem))]"
        >
          <SlidersIcon />
        </button>
      )}

      {/* mobile: backdrop for the bottom-sheet panel */}
      {narrow && panelOpen && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(3,5,20,0.55)]"
          onClick={() => setPanelOpen(false)}
          aria-hidden
        />
      )}

      {/* touch gameplay controls (phones & tablets with coarse pointers) */}
      {showTouch && phase === "playing" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-2 px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex gap-2.5">
            <button
              className="touch-btn"
              aria-label={t.moveLeft}
              onPointerDown={holdStart("left")}
              onPointerUp={holdEnd}
              onPointerCancel={holdEnd}
              onPointerLeave={holdEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              <ChevronIcon left />
            </button>
            <button
              className="touch-btn"
              aria-label={t.moveRight}
              onPointerDown={holdStart("right")}
              onPointerUp={holdEnd}
              onPointerCancel={holdEnd}
              onPointerLeave={holdEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              <ChevronIcon />
            </button>
          </div>
          <div className="pointer-events-auto flex gap-2.5">
            <button
              className="touch-btn text-star"
              aria-label={t.boost}
              onPointerDown={tapBoost}
              onContextMenu={(e) => e.preventDefault()}
            >
              <BoostIcon />
            </button>
            <button
              className="touch-btn text-ion"
              aria-label={t.shield}
              onPointerDown={tapShield}
              onContextMenu={(e) => e.preventDefault()}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
                <path d="M12 2l8 3.5V11c0 5.2-3.4 8.6-8 11-4.6-2.4-8-5.8-8-11V5.5L12 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* soft, non-blocking rotate hint for portrait phones */}
      {portraitPhone && phase === "playing" && !hintGone && (
        <div className="anim-rise absolute left-1/2 top-[4.4rem] z-20 flex -translate-x-1/2 items-center gap-2 border border-indigo-400/30 bg-[#0d1340]/90 py-1.5 pe-1.5 ps-3 text-[10px] font-bold text-indigo-200 shadow-[0_6px_20px_rgba(0,0,0,0.4)]">
          <span>📱 {t.landscapeHint}</span>
          <button
            onClick={() => setHintGone(true)}
            aria-label={t.closeLbl}
            className="flex h-6 w-6 items-center justify-center text-indigo-300/80 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {/* -------- audio + camera column: fixed panel on desktop, bottom sheet on phones -------- */}
      <aside
        className={
          narrow
            ? `anim-sheet-in fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col gap-2 overflow-y-auto modal-scroll border-t border-indigo-400/40 bg-[#0b1035] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 ${
                panelOpen ? "" : "hidden"
              }`
            : "absolute bottom-4 right-4 z-20 flex w-40 flex-col gap-2 sm:w-56"
        }
      >
        {narrow && (
          <div className="sticky top-0 z-10 -mx-3 flex items-center justify-between border-b border-indigo-400/20 bg-[#0b1035]/95 px-3 pb-2 backdrop-blur-sm">
            <span className="hud-label">{t.controlPanel}</span>
            <button
              onClick={() => setPanelOpen(false)}
              aria-label={t.closeLbl}
              title={t.closeLbl}
              className="flex h-9 w-9 items-center justify-center border border-indigo-400/40 bg-[#10163a] text-indigo-200"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        {narrow && <div className="cam-panel">{guideRows}</div>}
        {/* audio controls — Web Audio only, no files */}
        <div className="cam-panel">
          <div className="flex items-center justify-between">
            <span className="hud-label">{t.audioPanel}</span>
            <span className="text-[9px] font-bold tabular-nums text-ion/90">
              {t.volumeLabel}: {faNum(Math.round(vol * 100), lang)}
              {lang === "en" ? "%" : "٪"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <button
              onClick={handleAudioPlay}
              title={t.play}
              aria-label={t.play}
              className={`audio-btn ${audioState === "playing" ? "audio-btn--active" : ""}`}
            >
              <PlayIcon />
            </button>
            <button
              onClick={handleAudioPause}
              title={t.pause}
              aria-label={t.pause}
              className={`audio-btn ${audioState === "paused" ? "audio-btn--active" : ""}`}
            >
              <PauseIcon />
            </button>
            <button onClick={handleAudioStop} title={t.stop} aria-label={t.stop} className="audio-btn">
              <StopIcon />
            </button>
            <span className="mx-0.5 h-5 w-px shrink-0 bg-indigo-400/25" />
            <button onClick={handleVolDown} title={t.volumeDown} aria-label={t.volumeDown} className="audio-btn">
              <MinusIcon />
            </button>
            <button onClick={handleVolUp} title={t.volumeUp} aria-label={t.volumeUp} className="audio-btn">
              <PlusIcon />
            </button>
          </div>
        </div>

        {/* --------------------------- camera panel --------------------------- */}
        <div className="cam-panel">
          <div className="flex items-center justify-between">
            <span className="hud-label">{t.camera}</span>
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          </div>

          {/* verification status line */}
          <p className="text-[9.5px] font-bold leading-snug text-emerald-300/90">
            {lang === "fa" ? "نسخه جدید کنترل حرکتی بارگذاری شد" : "New Pose Fix Loaded"}
          </p>

          <div className="cam-frame relative aspect-[4/3] overflow-hidden">
            <div ref={previewRef} className="absolute inset-0" />
            {camStatus !== "on" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                {camStatus === "starting" ? (
                  <span className="font-display text-[9px] font-bold tracking-[0.18em] text-indigo-300 anim-pulse-glow">
                    ...
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" className={`h-8 w-8 ${camStatus === "off" ? "text-slate-700" : "text-slate-600"}`} fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 8l4-3h12a2 2 0 0 1 2 2v2l2-1v8l-2-1v2a2 2 0 0 1-2 2H6l-4-3V8z" strokeLinejoin="round" />
                    {(camStatus === "denied" || camStatus === "insecure" || camStatus === "error") && (
                      <path d="M4 4l16 16" strokeLinecap="round" />
                    )}
                  </svg>
                )}
              </div>
            )}
          </div>

          <div className="min-h-[2.4rem]">
            <p className="font-display text-[10px] font-bold text-indigo-100">{camLine}</p>
            {camStatus !== "on" && (
              <p className="mt-0.5 text-[10px] font-medium leading-snug text-indigo-300/85">{modelLine}</p>
            )}
          </div>

          {/* temporary AI STATUS debug panel — verifies the pose pipeline in the live browser */}
          <div className="border border-indigo-400/20 bg-[#0a0f30]/80 px-2.5 py-2">
            <p className="font-display text-[9px] font-bold tracking-[0.18em] text-star">{t.aiStatus}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9.5px] font-semibold text-indigo-200/85">
              <p>
                TensorFlow: <b className={stateColor(dbg.tf)}>{tfText}</b>
              </p>
              <p>
                {t.modelLbl}: <b className={stateColor(dbg.model)}>{modelText}</b>
              </p>
              <p>
                {t.camera}: <b className={stateColor(camStatus === "on" ? "on" : "")}>{camText}</b>
              </p>
              <p>
                {t.predictionLbl}: <b className={stateColor(dbg.prediction)}>{predText}</b>
              </p>
            </div>
            <div className="mt-1.5 space-y-0.5 text-[9.5px] font-semibold tabular-nums text-indigo-200/85">
              {dbg.probs.map((p, i) => (
                <p key={i} dir="ltr" className="flex justify-between">
                  <span>{dbg.labels[i] ?? `Class ${i + 1}`}</span>
                  <span className={p >= POSE_THRESHOLD ? "font-bold text-ion" : ""}>
                    {faNum(Math.round(p * 100), lang)}
                    {lang === "en" ? "%" : "٪"}
                  </span>
                </p>
              ))}
            </div>
            <p className="mt-1.5 text-[9.5px] font-semibold text-indigo-200/85">
              {t.currentAction}:{" "}
              <b className={dbg.action !== "NONE" ? "text-star" : "text-indigo-300/70"}>{dbg.action}</b>
            </p>
            {dbg.error && <p className="mt-1 text-[9.5px] font-bold leading-snug text-alert">{dbg.error}</p>}
          </div>

          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => {
              const active = camStatus === "on" && dbg.probs[i] >= POSE_THRESHOLD;
              return (
                <span
                  key={i}
                  className={`flex-1 py-1 text-center font-display text-[9px] font-bold tracking-widest transition-all duration-150 ${
                    active
                      ? i === 2
                        ? "bg-ion/25 text-ion shadow-[0_0_10px_rgba(94,234,255,0.5)]"
                        : i === 3
                          ? "bg-star/25 text-star shadow-[0_0_10px_rgba(255,215,94,0.5)]"
                          : "bg-nebula/30 text-indigo-100 shadow-[0_0_10px_rgba(124,92,255,0.5)]"
                      : "bg-[#111741] text-indigo-400/60"
                  }`}
                >
                  {faNum(i + 1, lang)}
                </span>
              );
            })}
          </div>

          <button
            onClick={() => void toggleCamera()}
            disabled={camStatus === "starting"}
            className={`pointer-events-auto flex w-full items-center justify-center gap-2 px-3 py-2 font-display text-[11px] font-bold transition-all duration-150 disabled:opacity-60 ${
              camStatus === "on" || camStatus === "starting"
                ? "border border-indigo-400/40 bg-[#10163a] text-indigo-200 hover:bg-[#151d4c]"
                : "border border-ion/60 bg-ion/10 text-ion shadow-[0_0_14px_rgba(94,234,255,0.25)] hover:bg-ion/20 hover:shadow-[0_0_20px_rgba(94,234,255,0.4)]"
            }`}
          >
            <CameraIcon />
            {camStatus === "on" || camStatus === "starting" ? t.camOffBtn : t.camOnBtn}
          </button>
          <p className="text-[9.5px] font-medium leading-relaxed text-indigo-300/70">{t.camHelp}</p>
        </div>
      </aside>

      {/* ------------------------------ start screen ------------------------------ */}
      {phase === "menu" && (
        <div className="modal-scroll absolute inset-0 z-30 overflow-y-auto bg-[rgba(3,5,20,0.62)]">
          <div className="flex min-h-full items-center justify-center px-3 pb-8 pt-28 sm:p-4 sm:pt-10">
          <div className="bracket-panel anim-rise w-full max-w-xl px-4 py-6 sm:px-10 sm:py-9">
            <span className="corner-b" />
            <div className="flex items-center gap-2">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ion/50" />
              <p className="font-display text-[9px] font-bold tracking-[0.3em] text-ion/80">{t.badge}</p>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ion/50" />
            </div>

            <div className="mt-5 text-center">
              <h2 className="font-display text-3xl font-black text-white glow-soft sm:text-5xl">{titleNode}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-indigo-200/90">
                {t.descA}
                <span className="text-star">{t.stars}</span>
                {t.descB}
                <span className="text-ember">{t.meteors}</span>
                {t.descC}
              </p>
            </div>

            <p className="mt-5 text-center font-display text-[10px] font-bold text-indigo-300/80">{t.controlsTitle}</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {GUIDE[lang].map((g, i) => (
                <div
                  key={g.cls}
                  className="flex items-start justify-between gap-3 border border-indigo-400/15 bg-[#0d1340]/70 px-3.5 py-2.5 transition-colors duration-150 hover:border-ion/40 hover:bg-[#101a52]"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display text-[9px] font-bold tracking-[0.18em] text-ion/85">{g.cls}</span>
                      <span className="text-[9px] font-bold text-indigo-400/70">
                        · {t.kbdLabel} <span className="kbd">{KBD_KEYS[i]}</span>
                      </span>
                    </p>
                    <p className="mt-1 text-xs font-medium leading-snug text-indigo-100/90">{g.pose}</p>
                    <p className="text-xs font-bold leading-snug text-star">→ {g.action}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-indigo-300/75">
              {t.scoring}
            </p>

            {bestScore > 0 && (
              <p className="mt-4 text-center font-display text-[11px] font-bold text-star/90">
                🏆 {t.bestScore}: {faNum(bestScore, lang)}
              </p>
            )}

            <div className="mt-6 flex flex-col items-center gap-3">
              <button onClick={startGame} className="btn-primary anim-floaty px-10 py-3.5 text-base font-black sm:px-12">
                {t.startGame}
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setModal("about")}
                  className="btn-ghost flex min-h-10 items-center gap-2 px-4 py-2.5 text-[11px] font-bold sm:text-xs"
                >
                  {t.about}
                </button>
                <button
                  onClick={() => setModal("guide")}
                  className="btn-ghost flex min-h-10 items-center gap-2 px-4 py-2.5 text-[11px] font-bold sm:text-xs"
                >
                  {t.help}
                </button>
              </div>
              <p className="flex items-center gap-2 text-[10px] font-medium text-indigo-300/70">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    modelStatus === "loading" ? "bg-star anim-pulse-glow" : modelStatus === "error" ? "bg-alert" : "bg-ion"
                  }`}
                />
                {modelStatus === "loading" ? t.modelLoading : modelStatus === "error" ? t.modelError : t.camNote}
              </p>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ------------------------------ game over ------------------------------ */}
      {phase === "over" && (
        <div className="modal-scroll absolute inset-0 z-30 overflow-y-auto bg-[rgba(3,5,20,0.6)]">
          <div className="flex min-h-full items-center justify-center px-3 pb-8 pt-28 sm:p-4 sm:pt-10">
          <div className="bracket-panel anim-rise w-full max-w-md px-5 py-7 text-center sm:px-8 sm:py-9">
            <span className="corner-b" />
            <p className={`font-display text-[10px] font-bold text-alert ${rtl ? "" : "tracking-[0.34em]"}`}>
              {t.hullBreach}
            </p>
            <h2
              className="mt-2 font-display text-4xl font-black text-white"
              style={{ textShadow: "0 0 26px rgba(255,93,115,0.45)" }}
            >
              {t.gameOver}
            </h2>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-4 sm:gap-x-8">
              <div>
                <p className="hud-label">{t.finalScore}</p>
                <p className="mt-1 font-display text-3xl font-black tabular-nums text-star glow-gold sm:text-4xl">
                  {faNum(String(score).padStart(4, "0"), lang)}
                </p>
              </div>
              <div className="hidden h-12 w-px bg-indigo-400/25 sm:block" />
              <div>
                <p className="hud-label">{t.starsCaught}</p>
                <p className="mt-1 font-display text-3xl font-black tabular-nums text-ion glow-cyan sm:text-4xl">
                  {faNum(gsRef.current.collected, lang)}
                </p>
              </div>
              <div className="hidden h-12 w-px bg-indigo-400/25 sm:block" />
              <div>
                <p className="hud-label">🏆 {t.bestScore}</p>
                <p className="mt-1 font-display text-3xl font-black tabular-nums text-nebula drop-shadow-[0_0_14px_rgba(124,92,255,0.55)] sm:text-4xl">
                  {faNum(Math.max(bestScore, score), lang)}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button onClick={restart} className="btn-primary px-10 py-3.5 text-base font-black">
                {t.restart}
              </button>
              <button
                onClick={() => void publishScore()}
                className={`btn-gold flex items-center gap-2 px-6 py-3.5 text-sm font-black ${
                  publishState === "copied" || publishState === "shared" ? "text-emerald-300" : ""
                }`}
              >
                {publishState === "copied" || publishState === "shared" ? <CheckIcon /> : <ShareIcon />}
                <span className={publishState === "failed" ? "text-alert" : ""}>
                  {publishState === "copied"
                    ? t.publishCopied
                    : publishState === "shared"
                      ? t.publishShared
                      : publishState === "failed"
                        ? t.publishFailed
                        : t.publish}
                </span>
              </button>
            </div>
            <p className="mt-3 text-[10px] font-medium text-indigo-300/70">
              {t.relaunchA} <span className="kbd mx-1">SPACE</span> {t.relaunchB} <span className="kbd mx-1">R</span>{" "}
              {t.relaunchC}
            </p>
          </div>
          </div>
        </div>
      )}

      {/* ------------------------------ about the creator ------------------------------ */}
      {modal === "about" && (
        <Modal title={t.about} closeLabel={t.closeLbl} rtl={rtl} onClose={() => setModal(null)}>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-ion/40 bg-ion/10 text-2xl shadow-[0_0_18px_rgba(94,234,255,0.2)]">
                👨‍💻
              </span>
              <p className="text-sm font-semibold leading-relaxed text-indigo-100/90">{t.aboutP1}</p>
            </div>

            <div className="border border-star/30 bg-star/5 px-4 py-3">
              <p className="text-sm leading-relaxed text-indigo-100/90">
                {t.creatorLineA}{" "}
                <b className="font-display text-base text-star glow-gold">{t.creatorName}</b> {t.creatorLineB}
              </p>
            </div>

            <div className="border border-indigo-400/25 bg-[#0d1340]/70 px-4 py-3">
              <p className="text-sm text-indigo-100/90">
                <span className="hud-label">{t.instructorLbl}</span>{" "}
                <b className="font-display text-base text-ion">{t.instructorName}</b>
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-indigo-100/90">
                <span className="hud-label">{t.contactLbl}</span>
                <a
                  href={`tel:${PHONE}`}
                  dir="ltr"
                  className="font-display text-lg font-bold tracking-wider text-ion underline-offset-4 hover:underline"
                >
                  {PHONE}
                </a>
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------ game guide & help ------------------------------ */}
      {modal === "guide" && (
        <Modal title={t.help} closeLabel={t.closeLbl} rtl={rtl} onClose={() => setModal(null)}>
          <div className="mt-4 space-y-5">
            <section>
              <h4 className="guide-h">{gc.objectiveT}</h4>
              <p className="mt-1.5 text-[13px] leading-relaxed text-indigo-100/85">{gc.objectiveB}</p>
            </section>

            <section>
              <h4 className="guide-h">{gc.howT}</h4>
              <ol className="mt-2 space-y-2">
                {gc.how.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-indigo-100/85">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-ion/50 bg-ion/10 font-display text-[10px] font-bold text-ion">
                      {faNum(i + 1, lang)}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h4 className="guide-h">{gc.flowT}</h4>
              <ol className="mt-2 space-y-2">
                {gc.flow.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-indigo-100/85">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-star/50 bg-star/10 font-display text-[10px] font-bold text-star">
                      {faNum(i + 1, lang)}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h4 className="guide-h">{gc.resultT}</h4>
              <p className="mt-1.5 text-[13px] leading-relaxed text-indigo-100/85">{gc.resultB}</p>
            </section>

            <section className="border border-indigo-400/20 bg-[#0d1340]/60 px-4 py-3">
              <h4 className="guide-h">{gc.tipsT}</h4>
              <ul className="mt-2 space-y-1.5">
                {gc.tips.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-indigo-100/85">
                    <span className="mt-0.5 text-star">✦</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
