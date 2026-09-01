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
import { PoseController, POSE_THRESHOLD, type CameraStatus, type DebugInfo, type ModelStatus } from "./game/pose";
import { audio, type AudioState } from "./game/audio";

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
  const table = lang === "ar" ? AR_DIGITS : FA_DIGITS;
  return s.replace(/[0-9]/g, (d) => table[Number(d)]);
}

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "en" || v === "ar" ? v : "fa";
  } catch {
    return "fa";
  }
}

function initialBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
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
  creatorClass: string;
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
    controlsTitle: "کنترل‌ها — ژست بدن + کیبورد + لمس",
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
    creatorLineA: "این برنامه یکی از برنامه‌های ساخته‌شده توسط",
    creatorName: "سجاد محفوظی، ۱۵ ساله از دبی",
    creatorLineB: "است.",
    creatorClass: "از کلاس خانم آقایی",
    instructorLbl: "استاد:",
    instructorName: "خانم آقایی",
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
    controlsTitle: "Controls — body poses + keyboard + touch",
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
    creatorLineA: "This app is one of the apps created by",
    creatorName: "Sajjad Mahfouzi, a 15-year-old from Dubai",
    creatorLineB: ".",
    creatorClass: "from Ms. Aghaei's class",
    instructorLbl: "Instructor:",
    instructorName: "Ms. Aghaei",
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
    controlsTitle: "التحكم — وضعيات الجسم + لوحة المفاتيح + اللمس",
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
    about: "👨‍💻 حول مطوّر التطبيق",
    aboutP1: "تم إنشاء هذا المشروع بهدف التعلم والإبداع واكتساب الخبرة العملية في البرمجة والذكاء الاصطناعي.",
    creatorLineA: "هذا التطبيق هو أحد التطبيقات التي قام بتطويرها",
    creatorName: "سجّاد محفوظي، 15 عامًا من دبي",
    creatorLineB: ".",
    creatorClass: "من صف السيدة آقايي",
    instructorLbl: "المدرّسة:",
    instructorName: "السيدة آقايي",
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

/** Exact pose instructions for the help panel. */
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
    { cls: "Class 1", pose: "مدّ الذراع اليسرى نحو اليسار", action: "تحريك السفينة يساراً" },
    { cls: "Class 2", pose: "مدّ الذراع اليمنى نحو اليمين", action: "تحريك السفينة يميناً" },
    { cls: "Class 3", pose: "مدّ كلتا الذراعين إلى الجانبين", action: "تفعيل الدرع" },
    { cls: "Class 4", pose: "ارفع كلتا اليدين", action: "الاندفاع نحو الأعلى" },
  ],
};

const KBD_KEYS = ["←", "→", "SPACE", "↑"];

/* --------------------- full game guide (real logic) --------------------- */

interface HelpSection {
  title: string;
  items: string[];
}

const HELP_GUIDE: Record<Lang, { objectiveT: string; sections: HelpSection[] }> = {
  fa: {
    objectiveT: "🎯 هدف بازی",
    sections: [
      {
        title: "🎮 روش بازی",
        items: [
          "۱) دکمهٔ «شروع بازی» را بزن تا پرواز آغاز شود و موسیقی فضایی پخش شود.",
          "۲) کنترل با بدن: دکمهٔ «روشن کردن دوربین» را بزن و ژست بگیر — کلاس ۱ (دست چپ به چپ) حرکت به چپ، کلاس ۲ (دست راست به راست) حرکت به راست، کلاس ۳ (هر دو دست به دو طرف) سپر، کلاس ۴ (هر دو دست بالا) شتاب به بالا.",
          "۳) کنترل با کیبورد: ← و → برای حرکت، Space سپر، ↑ شتاب، R شروع دوباره.",
          "۴) کنترل لمسی در موبایل: دکمه‌های ◀ و ▶ را نگه دار؛ 🛡 سپر و ⬆ شتاب.",
          "۵) ستاره‌ها هر ۰٫۷ تا ۱٫۳ ثانیه و شهاب‌سنگ‌ها هر ۲٫۳ تا ۴ ثانیه ظاهر می‌شوند — ستاره‌ها بیشترند و فرصت کافی داری.",
        ],
      },
      {
        title: "🔄 روند بازی",
        items: [
          "بازی از منوی شروع آغاز می‌شود؛ دوربین فقط با کلیک خودت روشن می‌شود و هیچ دسترسی خودکاری وجود ندارد.",
          "سفینه نزدیک پایین صفحه شروع می‌کند و به‌آرامی پایین می‌آید؛ شتاب آن را برای مدتی کوتاه بالا می‌برد.",
          "سپر دقیقاً یک برخورد را جذب می‌کند و بعد ۱٫۲ ثانیه طول می‌کشد تا دوباره آماده شود.",
          "بعد از هر برخورد، ۱٫۸ ثانیه مصونیت داری تا پشت‌سرهم جان از دست ندهی.",
          "امتیاز، جان‌ها و وضعیت سپر همیشه در نوار بالای صفحه نمایش داده می‌شوند.",
        ],
      },
      {
        title: "🏆 پایان بازی",
        items: [
          "وقتی هر ۳ جان تمام شود، صفحهٔ پایان بازی ظاهر می‌شود.",
          "امتیاز نهایی، تعداد ستاره‌های گرفته‌شده و بهترین امتیاز (ذخیره‌شده در مرورگر) نمایش داده می‌شود.",
          "با «شروع دوباره» یا کلیدهای Space و R دوباره پرواز کن.",
          "با «انتشار امتیاز» نتیجه را به‌اشتراک بگذار یا کپی کن.",
        ],
      },
      {
        title: "💡 نکته‌ها",
        items: [
          "سپر را برای لحظه‌های شلوغ نگه دار — فقط یک ضربه را دفع می‌کند.",
          "شتاب کوتاه است؛ برای رد شدن از بین شهاب‌سنگ‌ها زمان‌بندی کن.",
          "اگر مدل، ژست‌ها را خوب تشخیص نمی‌دهد، نور اتاق را بیشتر کن و کامل داخل کادر دوربین بایست.",
          "کنترل کیبوردی و لمسی همیشه فعال است — حتی وقتی دوربین خاموش است.",
          "در موبایل برای تجربهٔ بهتر گوشی را افقی کن.",
        ],
      },
    ],
  },
  en: {
    objectiveT: "🎯 Objective",
    sections: [
      {
        title: "🎮 How to Play",
        items: [
          "1) Press “Start Game” to begin the run — space music starts with it.",
          "2) Body control: press “Turn Camera On”, then pose — Class 1 (left arm to the left) moves left, Class 2 (right arm to the right) moves right, Class 3 (both arms sideways) activates the shield, Class 4 (both hands up) boosts upward.",
          "3) Keyboard: ← and → to move, Space for shield, ↑ to boost, R to restart.",
          "4) Touch controls on mobile: hold ◀ and ▶ to steer; tap 🛡 for shield and ⬆ to boost.",
          "5) Stars appear every 0.7–1.3 s and meteors every 2.3–4 s — stars are more frequent, so you always have a chance.",
        ],
      },
      {
        title: "🔄 Game Flow",
        items: [
          "The game starts from the menu; the camera turns on only when you click its button — nothing is accessed automatically.",
          "The ship starts near the bottom and slowly sinks; boost lifts it up for a short moment.",
          "The shield absorbs exactly one hit, then needs 1.2 s to recharge.",
          "After each hit you get 1.8 s of invulnerability, so you never lose lives back-to-back.",
          "Score, lives and shield status are always visible in the top HUD.",
        ],
      },
      {
        title: "🏆 Game Over",
        items: [
          "When all 3 lives are lost, the game-over screen appears.",
          "It shows your final score, stars caught and best score (saved in your browser).",
          "Press “Restart” or the Space / R keys to fly again.",
          "Use “Publish Score” to share or copy your result.",
        ],
      },
      {
        title: "💡 Tips",
        items: [
          "Save the shield for crowded moments — it blocks only one hit.",
          "Boost is short; time it to slip between meteors.",
          "If the model struggles with your poses, add more light and stand fully inside the camera frame.",
          "Keyboard and touch controls always work — even with the camera off.",
          "On phones, landscape mode gives the best experience.",
        ],
      },
    ],
  },
  ar: {
    objectiveT: "🎯 هدف اللعبة",
    sections: [
      {
        title: "🎮 طريقة اللعب",
        items: [
          "١) اضغط «ابدأ اللعبة» لبدء الجولة — تبدأ الموسيقى الفضائية معها.",
          "٢) التحكم بالجسم: اضغط «تشغيل الكاميرا» ثم اتّخذ الوضعية — الوضعية ١ (الذراع اليسرى يساراً) للتحرك يساراً، الوضعية ٢ (الذراع اليمنى يميناً) للتحرك يميناً، الوضعية ٣ (الذراعان إلى الجانبين) لتفعيل الدرع، الوضعية ٤ (رفع اليدين) للاندفاع نحو الأعلى.",
          "٣) لوحة المفاتيح: ← و → للتحرك، المسافة للدرع، ↑ للاندفاع، R لإعادة البدء.",
          "٤) التحكم باللمس على الجوال: استمر بالضغط على ◀ و ▶ للتوجيه؛ 🛡 للدرع و ⬆ للاندفاع.",
          "٥) تظهر النجوم كل ٠٫٧–١٫٣ ثانية والنيازك كل ٢٫٣–٤ ثوانٍ — النجوم أكثر، فلديك دائماً فرصة.",
        ],
      },
      {
        title: "🔄 سير اللعبة",
        items: [
          "تبدأ اللعبة من القائمة؛ تعمل الكاميرا فقط عند الضغط على زرها — لا يوجد وصول تلقائي.",
          "تبدأ السفينة قرب الأسفل وتهبط ببطء؛ يرفعها الاندفاع لفترة قصيرة.",
          "يمتص الدرع ضربة واحدة فقط، ثم يحتاج ١٫٢ ثانية لإعادة الشحن.",
          "بعد كل إصابة تحصل على ١٫٨ ثانية من الحصانة حتى لا تخسر الأرواح تباعاً.",
          "النقاط والأرواح وحالة الدرع ظاهرة دائماً في الشريط العلوي.",
        ],
      },
      {
        title: "🏆 نهاية اللعبة",
        items: [
          "عند فقدان الأرواح الثلاثة تظهر شاشة نهاية اللعبة.",
          "تُعرض النتيجة النهائية وعدد النجوم الملتقطة وأفضل نتيجة (محفوظة في متصفحك).",
          "اضغط «إعادة البدء» أو مفتاحي المسافة و R للطيران من جديد.",
          "استخدم «نشر النتيجة» لمشاركة نتيجتك أو نسخها.",
        ],
      },
      {
        title: "💡 نصائح",
        items: [
          "احتفظ بالدرع للحظات المزدحمة — فهو يصد ضربة واحدة فقط.",
          "الاندفاع قصير؛ وقّته للمرور بين النيازك.",
          "إذا لم يتعرف النموذج على وضعياتك جيداً، زد إضاءة الغرفة وقف بالكامل داخل إطار الكاميرا.",
          "التحكم بلوحة المفاتيح واللمس يعمل دائماً — حتى مع إطفاء الكاميرا.",
          "على الجوال، الوضع الأفقي يمنحك أفضل تجربة.",
        ],
      },
    ],
  },
};

const OBJECTIVE: Record<Lang, string[]> = {
  fa: [
    "سفینهٔ کوچک را در میدان فضایی هدایت کن؛ ستاره‌های طلایی را بگیر و از شهاب‌سنگ‌ها دوری کن تا زنده بمانی.",
    "هر ستاره ۱۰+ امتیاز دارد و هر برخورد با شهاب‌سنگ ۱− جان. با ۳ جان شروع می‌کنی و با تمام‌شدن آن‌ها بازی پایان می‌یابد.",
  ],
  en: [
    "Steer a tiny spaceship through space: catch golden stars and dodge meteors to survive.",
    "Each star is worth +10 points and every meteor hit costs 1 life. You start with 3 lives — lose them all and the run ends.",
  ],
  ar: [
    "قُد سفينة فضائية صغيرة في الفضاء: التقط النجوم الذهبية وتفادَ النيازك لتنجو.",
    "كل نجم يساوي +١٠ نقاط وكل إصابة بنيزك تكلّفك روحاً واحداً. تبدأ بـ٣ أرواح — عند فقدانها تنتهي الجولة.",
  ],
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

function GuideIcon({ big }: { big?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${big ? "h-5 w-5" : "h-3.5 w-3.5"} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
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
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 10h16M10 10v10" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" | "up" }) {
  const rot = dir === "left" ? 90 : dir === "right" ? -90 : 0;
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      style={{ transform: `rotate(${rot}deg)` }}
      aria-hidden
    >
      <path d="M6 14.5L12 8.5l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------ modal shell ------------------------------ */

function HelpModal({
  title,
  onClose,
  closeLbl,
  rtl,
  children,
}: {
  title: string;
  onClose: () => void;
  closeLbl: string;
  rtl: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      className="absolute inset-0 z-50 flex items-center justify-center bg-[rgba(3,5,20,0.72)] p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bracket-panel anim-rise flex max-h-[90dvh] w-full max-w-lg flex-col px-5 py-5 sm:px-8 sm:py-7"
      >
        <span className="corner-b" />
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl font-black text-white glow-soft sm:text-2xl">{title}</h3>
          <button
            onClick={onClose}
            aria-label={closeLbl}
            title={closeLbl}
            className="btn-ghost flex h-9 w-9 shrink-0 items-center justify-center"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal-scroll mt-4 flex-1 overflow-y-auto pe-1">{children}</div>
        <button onClick={onClose} className="btn-primary mt-5 w-full px-8 py-3 text-sm font-black">
          {closeLbl}
        </button>
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
  const [bestScore, setBestScore] = useState<number>(initialBest);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
  );
  const [hintVisible, setHintVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches && window.innerHeight > window.innerWidth;
  });
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);

  const t = T[lang];
  const rtl = lang !== "en";
  const narrow = isNarrow;

  const titleNode =
    lang === "fa" ? (
      <>
        خلبان <span className="text-ion glow-cyan">کیهان</span>
      </>
    ) : lang === "ar" ? (
      <>
        طيّار <span className="text-ion glow-cyan">الكون</span>
      </>
    ) : (
      <>
        POSE<span className="text-ion glow-cyan">PILOT</span>
      </>
    );

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
    void audio.play().then(() => setAudioState(audio.state));
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

  /* ---------------------- touch control handlers ---------------------- */
  const pressDir = useCallback((dir: "left" | "right", down: boolean) => {
    kbRef.current[dir] = down;
  }, []);
  const tapShield = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    triggerShield(gsRef.current);
    audio.shield();
  }, []);
  const tapBoost = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    triggerBoost(gsRef.current);
    audio.boost();
  }, []);

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

  /* ------------------ responsive: narrow / landscape hint ------------------ */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setIsNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!hintDismissed && hintVisible) {
      hintTimer.current = setTimeout(() => setHintVisible(false), 7000);
      return () => {
        if (hintTimer.current) clearTimeout(hintTimer.current);
      };
    }
  }, [hintVisible, hintDismissed]);

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
        setModelErr(err ?? "");
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

  const guideRows = GUIDE[lang].map((g, i) => (
    <div key={g.cls} className={i > 0 ? "mt-2 border-t border-indigo-400/15 pt-2" : ""}>
      <p className={`font-display text-[9px] font-bold text-ion/85 ${lang === "en" ? "tracking-[0.18em]" : ""}`}>
        {g.cls}
      </p>
      <p className="mt-0.5 text-[10.5px] font-medium leading-snug text-indigo-100/90">{g.pose}</p>
      <p className="text-[10.5px] font-bold leading-snug text-star">→ {g.action}</p>
    </div>
  ));

  const volumeText = `${t.volumeLabel}: ${faNum(Math.round(vol * 100), lang)}${lang === "en" ? "%" : "٪"}`;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="relative h-full w-full touch-manipulation select-none overflow-hidden font-body">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 touch-none" />

      {/* version badge (top corner, opposite the header) */}
      <div
        dir="ltr"
        className="pointer-events-none absolute left-2 top-2 z-50 border border-ion/50 bg-[#0a0f2e]/95 px-2 py-0.5 font-display text-[9px] font-bold tracking-[0.14em] text-ion shadow-[0_0_10px_rgba(94,234,255,0.25)]"
      >
        VERSION: UI-FIX-2
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

          {/* standalone game-guide icon — opens the full guide from anywhere */}
          <button
            onClick={() => setShowHelp(true)}
            aria-label={t.help}
            title={t.help}
            className="btn-ghost pointer-events-auto flex min-h-9 items-center px-2.5 py-2 sm:px-3"
          >
            <GuideIcon />
          </button>

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

      {/* ----------------------- mobile floating buttons ----------------------- */}
      {narrow && panelOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/30"
          onClick={() => setPanelOpen(false)}
          aria-hidden
        />
      )}

      {narrow && (
        <div className="absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 z-40 flex items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            aria-label={t.help}
            title={t.help}
            className="mini-btn"
          >
            <GuideIcon big />
          </button>
          <button
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={t.controlPanel}
            title={t.controlPanel}
            className="mini-btn"
          >
            <PanelIcon />
          </button>
        </div>
      )}

      {/* ----------------------- touch controls (mobile) ----------------------- */}
      {narrow && phase === "playing" && (
        <>
          <div
            dir="ltr"
            className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-3 z-40 flex items-end gap-3"
          >
            <button
              className="touch-btn"
              aria-label={t.moveLeft}
              onPointerDown={(e) => {
                e.preventDefault();
                pressDir("left", true);
              }}
              onPointerUp={() => pressDir("left", false)}
              onPointerLeave={() => pressDir("left", false)}
              onPointerCancel={() => pressDir("left", false)}
            >
              <Chevron dir="left" />
            </button>
            <button
              className="touch-btn"
              aria-label={t.moveRight}
              onPointerDown={(e) => {
                e.preventDefault();
                pressDir("right", true);
              }}
              onPointerUp={() => pressDir("right", false)}
              onPointerLeave={() => pressDir("right", false)}
              onPointerCancel={() => pressDir("right", false)}
            >
              <Chevron dir="right" />
            </button>
          </div>
          <div
            dir="ltr"
            className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-3 z-40 flex items-end gap-3"
          >
            <button className="touch-btn" aria-label={t.boost} onPointerDown={(e) => { e.preventDefault(); tapBoost(); }}>
              <Chevron dir="up" />
            </button>
            <button className="touch-btn" aria-label={t.shield} onPointerDown={(e) => { e.preventDefault(); tapShield(); }}>
              <ShieldIcon on />
            </button>
          </div>
        </>
      )}

      {/* --------------------------- landscape hint --------------------------- */}
      {hintVisible && !hintDismissed && (
        <div className="absolute left-1/2 top-[calc(4.6rem+env(safe-area-inset-top))] z-40 w-max max-w-[92vw] -translate-x-1/2">
          <div className="anim-rise flex items-center gap-2 border border-indigo-400/40 bg-[#0d1340]/95 px-3.5 py-2 text-[11px] font-bold text-indigo-100 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <span>📱↔️ {t.landscapeHint}</span>
            <button
              onClick={() => {
                setHintDismissed(true);
                setHintVisible(false);
              }}
              aria-label={t.closeLbl}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-indigo-300/80 hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

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

      {/* -------- audio + camera column: fixed panel on desktop, bottom sheet on phones -------- */}
      <aside
        className={
          narrow
            ? `anim-sheet-in fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col gap-2 overflow-y-auto modal-scroll border-t border-indigo-400/40 bg-[#0b1035] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 ${
                panelOpen ? "" : "hidden"
              }`
            : "modal-scroll absolute bottom-4 right-4 z-20 flex max-h-[calc(100dvh-9.5rem)] w-40 flex-col gap-2 overflow-y-auto sm:w-56"
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
            <span className="text-[9px] font-bold tabular-nums text-ion/90">{volumeText}</span>
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

          <div className="cam-frame relative aspect-[4/3] overflow-hidden">
            <div ref={previewRef} className="absolute inset-0" />
            {camStatus !== "on" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                {camStatus === "starting" ? (
                  <span className="anim-pulse-glow font-display text-[9px] font-bold tracking-[0.18em] text-indigo-300">
                    ...
                  </span>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-8 w-8 ${camStatus === "off" ? "text-slate-700" : "text-slate-600"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
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

          {/* AI STATUS debug panel — verifies the pose pipeline in the live browser */}
          <div className="border border-indigo-400/20 bg-[#0a0f30]/80 px-2.5 py-2">
            <p className={`font-display text-[9px] font-bold text-star ${lang === "en" ? "tracking-[0.18em]" : ""}`}>
              {t.aiStatus}
            </p>
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
          <div className="flex min-h-full items-center justify-center px-3 pb-8 pt-28 sm:px-4 sm:pb-8 sm:pt-36">
            <div className="bracket-panel anim-rise w-full max-w-xl px-4 py-6 sm:px-10 sm:py-9">
              <span className="corner-b" />
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ion/50" />
                <p className={`font-display text-[9px] font-bold text-ion/80 ${lang === "en" ? "tracking-[0.3em]" : ""}`}>
                  {t.badge}
                </p>
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
                        <span className={`font-display text-[9px] font-bold text-ion/85 ${lang === "en" ? "tracking-[0.18em]" : ""}`}>
                          {g.cls}
                        </span>
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

              <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-indigo-300/75">{t.scoring}</p>

              <div className="mt-6 flex flex-col items-center gap-3">
                <button onClick={startGame} className="btn-primary anim-floaty w-full max-w-xs px-12 py-3.5 text-base font-black sm:w-auto">
                  {t.startGame}
                </button>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setShowHelp(true)}
                    className="btn-ghost pointer-events-auto px-5 py-2.5 text-xs font-bold"
                  >
                    {t.help}
                  </button>
                  <button
                    onClick={() => setShowAbout(true)}
                    className="btn-ghost pointer-events-auto px-5 py-2.5 text-xs font-bold"
                  >
                    {t.about}
                  </button>
                </div>
                {bestScore > 0 && (
                  <p className="text-[11px] font-bold text-nebula">
                    🏆 {t.bestScore}: {faNum(bestScore, lang)}
                  </p>
                )}
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
          <div className="flex min-h-full items-center justify-center px-3 pb-8 pt-28 sm:px-4 sm:pb-8 sm:pt-36">
            <div className="bracket-panel anim-rise w-full max-w-md px-5 py-7 text-center sm:px-8 sm:py-9">
              <span className="corner-b" />
              <p className={`font-display text-[10px] font-bold text-alert ${lang === "en" ? "tracking-[0.34em]" : ""}`}>
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

      {/* ------------------------------ game guide modal ------------------------------ */}
      {showHelp && (
        <HelpModal title={t.help} onClose={() => setShowHelp(false)} closeLbl={t.closeLbl} rtl={rtl}>
          <p className="guide-h">{HELP_GUIDE[lang].objectiveT}</p>
          <ul className="mt-2 space-y-2">
            {OBJECTIVE[lang].map((line, i) => (
              <li key={i} className="text-sm leading-relaxed text-indigo-100/90">
                {line}
              </li>
            ))}
          </ul>
          {HELP_GUIDE[lang].sections.map((sec) => (
            <div key={sec.title} className="mt-5">
              <p className="guide-h">{sec.title}</p>
              <ul className="mt-2 space-y-2">
                {sec.items.map((item, i) => (
                  <li key={i} className="text-sm leading-relaxed text-indigo-100/90">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="mt-6 border border-star/40 bg-star/10 px-4 py-3 text-center">
            <button onClick={() => setShowAbout(true)} className="font-display text-sm font-black text-star hover:text-white">
              {t.about}
            </button>
          </div>
        </HelpModal>
      )}

      {/* ------------------------------ about modal ------------------------------ */}
      {showAbout && (
        <HelpModal title={t.about} onClose={() => setShowAbout(false)} closeLbl={t.closeLbl} rtl={rtl}>
          <div className="text-center">
            <span className="text-5xl">👨‍💻</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-indigo-100/90">{t.aboutP1}</p>
          <p className="mt-4 text-sm leading-relaxed text-indigo-100/90">
            {t.creatorLineA}{" "}
            <span className="font-bold text-ion">{t.creatorName}</span>
            {t.creatorLineB}
          </p>
          <p className="mt-1 text-sm font-bold text-star">{t.creatorClass}</p>
          <div className="mt-5 space-y-2 border border-indigo-400/25 bg-[#0d1340]/70 px-4 py-3.5">
            <p className="text-sm text-indigo-100/90">
              <span className="hud-label">{t.instructorLbl}</span>{" "}
              <span className="font-bold text-indigo-100">{t.instructorName}</span>
            </p>
            <p className="text-sm text-indigo-100/90">
              {t.contactLbl}{" "}
              <a dir="ltr" href={`tel:${PHONE}`} className="font-bold tabular-nums text-star underline-offset-4 hover:underline">
                {faNum(PHONE, lang)}
              </a>
            </p>
          </div>
        </HelpModal>
      )}
    </div>
  );
}
