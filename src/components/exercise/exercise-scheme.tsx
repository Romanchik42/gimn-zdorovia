import type { ExerciseType } from "@/lib/supabase/types";

/**
 * Схемы движения (GIMN-013).
 *
 * На каждое упражнение без живой картинки — рисованная схема: фигурка в нужном
 * положении плюс стрелки направления, как в инструкции к тренажёру. Рисуем
 * кодом, а не файлами: один стиль на все схемы, вес нулевой, цвета берутся
 * из темы (фигурка — currentColor, стрелки — брендовый акцент).
 *
 * Поза — это набор отрезков в системе 160×120; пол всегда на y = 112.
 * Стрелки описываются тем же языком координат, поэтому новую схему добавить
 * можно, не рисуя её в редакторе.
 */

const W = 160;
const H = 120;
const FLOOR = 112;

type Segment = [number, number, number, number];
type Figure = {
  /** Голова: центр и радиус. */
  head: [number, number, number];
  segments: Segment[];
};

/* ----------------------------- позы фигурки ----------------------------- */

/**
 * У каждой позы есть голова и обе конечности с изгибом в локте и колене:
 * без изгибов фигурка читается как палки, а не как человек. В видах сбоку
 * дальняя рука и нога смещены на пару пикселей — так видно объём.
 */

/** Стоя лицом к нам. */
const STANDING_FRONT: Figure = {
  head: [80, 22, 8.5],
  segments: [
    [80, 30, 80, 38],
    [63, 42, 97, 42],
    [80, 38, 80, 72],
    [63, 42, 58, 58], [58, 58, 55, 74],
    [97, 42, 102, 58], [102, 58, 105, 74],
    [69, 72, 91, 72],
    [69, 72, 67, 92], [67, 92, 67, FLOOR], [67, FLOOR, 58, FLOOR],
    [91, 72, 93, 92], [93, 92, 93, FLOOR], [93, FLOOR, 102, FLOOR],
  ],
};

/** Стоя боком, лицом вправо. */
const STANDING_SIDE: Figure = {
  head: [84, 22, 8.5],
  segments: [
    [82, 30, 80, 38],
    [80, 38, 78, 72],
    [81, 43, 84, 58], [84, 58, 83, 74],
    [78, 72, 76, 92], [76, 92, 76, FLOOR], [76, FLOOR, 90, FLOOR],
  ],
};

/** Сидя на стуле лицом к нам. */
const SITTING_FRONT: Figure = {
  head: [80, 24, 8.5],
  segments: [
    [80, 32, 80, 40],
    [63, 44, 97, 44],
    [80, 40, 80, 74],
    [63, 44, 59, 60], [59, 60, 57, 76],
    [97, 44, 101, 60], [101, 60, 103, 76],
    [69, 74, 91, 74],
    [69, 74, 68, 94], [68, 94, 68, FLOOR],
    [91, 74, 92, 94], [92, 94, 92, FLOOR],
  ],
};

/** Сидя на стуле боком, лицом вправо. */
const SITTING_SIDE: Figure = {
  head: [86, 28, 8.5],
  segments: [
    [84, 36, 82, 44],
    [82, 44, 78, 82],
    [82, 48, 87, 62], [87, 62, 93, 74],
    [78, 82, 102, 84],
    [102, 84, 102, FLOOR], [102, FLOOR, 113, FLOOR],
  ],
};

/** Лёжа на спине, голова слева, ноги прямые. */
const SUPINE: Figure = {
  head: [34, 103, 8.5],
  segments: [
    [42, 103, 84, 103],
    [46, 106, 62, 110], [62, 110, 76, 109],
    [46, 99, 62, 96], [62, 96, 76, 98],
    [84, 103, 106, 104], [106, 104, 126, 105], [126, 105, 130, 97],
    [84, 106, 106, 107], [106, 107, 124, 108],
  ],
};

/** Лёжа на спине, колени согнуты. */
const SUPINE_BENT: Figure = {
  head: [30, 103, 8.5],
  segments: [
    [38, 103, 80, 103],
    [42, 106, 58, 110], [58, 110, 72, 109],
    [80, 103, 96, 80], [96, 80, 104, FLOOR],
    [80, 106, 100, 83], [100, 83, 108, FLOOR],
  ],
};

/** Лёжа на животе с опорой на предплечья, голова слева. */
const PRONE: Figure = {
  head: [40, 88, 8.5],
  segments: [
    [48, 92, 92, 105],
    [48, 94, 44, 106], [44, 106, 58, 107],
    [51, 97, 47, 108], [47, 108, 60, 109],
    [92, 105, 114, 107], [114, 107, 134, 108],
    [92, 107, 114, 109], [114, 109, 132, 110],
  ],
};

/** На четвереньках: ладони и колени на полу, голова слева. */
const QUADRUPED: Figure = {
  head: [44, 68, 8.5],
  segments: [
    [50, 72, 53, 76],
    [53, 76, 108, 78],
    [53, 76, 53, FLOOR],
    [57, 76, 57, FLOOR],
    [108, 78, 110, 95], [110, 95, 110, FLOOR],
    [104, 78, 106, 95], [106, 95, 106, FLOOR],
  ],
};

/** Планка на предплечьях: тело одной линией, опора на локти. */
const PLANK_FOREARM: Figure = {
  head: [44, 80, 8.5],
  segments: [
    [51, 84, 56, 86],
    [56, 86, 122, 106],
    [56, 86, 52, FLOOR], [52, FLOOR, 66, FLOOR],
    [122, 106, 130, FLOOR], [126, FLOOR, 134, FLOOR],
  ],
};

/** Упор лёжа на прямых руках — отжимания. */
const PLANK_HANDS: Figure = {
  head: [44, 78, 8.5],
  segments: [
    [51, 82, 56, 84],
    [56, 84, 122, 104],
    [56, 84, 54, FLOOR],
    [60, 85, 58, FLOOR],
    [122, 104, 130, FLOOR], [126, FLOOR, 134, FLOOR],
  ],
};

/** Боковая планка: опора на предплечье, тело наклонной линией. */
const SIDE_PLANK: Figure = {
  head: [40, 66, 8.5],
  segments: [
    [47, 70, 54, 74],
    [54, 74, 124, 106],
    [54, 74, 48, FLOOR], [42, FLOOR, 58, FLOOR],
    [56, 72, 62, 48],
    [124, 106, 134, FLOOR],
  ],
};

/** Птица-собака: рука вперёд, противоположная нога назад. */
const BIRD_DOG: Figure = {
  head: [50, 66, 8.5],
  segments: [
    [56, 70, 60, 74],
    [60, 74, 108, 76],
    [60, 74, 60, FLOOR],
    [62, 73, 34, 62],
    [108, 76, 110, 95], [110, 95, 110, FLOOR],
    [108, 74, 134, 66],
  ],
};

/** Жук: лёжа на спине, руки вверх, колени над тазом. */
const DEAD_BUG: Figure = {
  head: [34, 103, 8.5],
  segments: [
    [42, 103, 88, 103],
    [48, 100, 46, 76],
    [54, 100, 58, 76],
    [88, 103, 90, 80], [90, 80, 108, 78],
    [88, 105, 106, 96], [106, 96, 124, 98],
  ],
};

/** Лёжа на спине с поднятой прямой ногой — растяжка задней поверхности. */
const SUPINE_LEG_UP: Figure = {
  head: [30, 103, 8.5],
  segments: [
    [38, 103, 84, 104],
    [84, 104, 106, 106], [106, 106, 126, 107],
    [84, 102, 92, 76], [92, 76, 96, 54],
    [56, 100, 78, 82], [78, 82, 92, 70],
  ],
};

/** Сидя на стуле с вытянутой вперёд ногой. */
const SITTING_LEG_OUT: Figure = {
  head: [76, 28, 8.5],
  segments: [
    [74, 36, 72, 44],
    [72, 44, 68, 82],
    [72, 48, 77, 62], [77, 62, 83, 74],
    [68, 82, 92, 84],
    [92, 84, 130, 104], [130, 104, 138, 98],
    [92, 86, 92, FLOOR],
  ],
};

/** Лёжа на боку, голова слева; верхняя нога чуть приподнята. */
const SIDE_LYING: Figure = {
  head: [34, 98, 8.5],
  segments: [
    [42, 99, 86, 101],
    [44, 103, 58, 109],
    [46, 95, 60, 92], [60, 92, 72, 95],
    [86, 101, 108, 104], [108, 104, 128, 106],
    [86, 98, 108, 95], [108, 95, 128, 93],
  ],
};

/** Выпад: одно колено на полу, лицом вправо. */
const KNEELING_LUNGE: Figure = {
  head: [78, 36, 8.5],
  segments: [
    [77, 44, 76, 52],
    [76, 52, 78, 78],
    [77, 56, 82, 70], [82, 70, 88, 78],
    [78, 78, 104, 80], [104, 80, 104, FLOOR],
    [78, 78, 58, 98], [58, 98, 54, FLOOR], [46, FLOOR, 58, FLOOR],
  ],
};

/** Сидя на пятках, корпус сложен вперёд, руки вытянуты — поза ребёнка. */
const CHILD_FOLD: Figure = {
  head: [58, 100, 8],
  segments: [
    [66, 99, 104, 84],
    [104, 84, 112, 104], [112, 104, 92, 108],
    [104, 88, 88, 108], [88, 108, 110, 109],
    [64, 103, 34, 108],
    [66, 96, 36, 101],
  ],
};

/**
 * Вис на турнике лицом к нам, хват на ширине плеч.
 *
 * Вид спереди, а не сбоку: сбоку руки, корпус и ноги вытягиваются в одну
 * вертикаль и фигурка читается как палка с головой посередине.
 */
const HANG_FRONT: Figure = {
  head: [80, 40, 8.5],
  segments: [
    [80, 48, 80, 55],
    [67, 57, 93, 57],
    [80, 55, 80, 84],
    [67, 57, 70, 38], [70, 38, 71, 17],
    [93, 57, 90, 38], [90, 38, 89, 17],
    [71, 84, 89, 84],
    [71, 84, 70, 97], [70, 97, 70, 108], [70, 108, 62, 110],
    [89, 84, 90, 97], [90, 97, 90, 108], [90, 108, 98, 110],
  ],
};

/** Вис лицом к нам, хват заметно шире плеч. */
const HANG_WIDE: Figure = {
  head: [80, 40, 8.5],
  segments: [
    [80, 48, 80, 55],
    [66, 57, 94, 57],
    [80, 55, 80, 84],
    [66, 57, 56, 38], [56, 38, 50, 17],
    [94, 57, 104, 38], [104, 38, 110, 17],
    [70, 84, 90, 84],
    [70, 84, 70, 97], [70, 97, 70, 108], [70, 108, 62, 110],
    [90, 84, 90, 97], [90, 97, 90, 108], [90, 108, 98, 110],
  ],
};

/**
 * Вис боком с подтянутыми коленями. Здесь вид сбоку обязателен — спереди
 * колени «к груди» не видно. Голова вынесена вперёд от линии рук, иначе
 * круг головы ложится прямо на руку.
 */
const HANG_KNEES: Figure = {
  head: [92, 42, 8.5],
  segments: [
    [86, 46, 79, 52],
    [80, 17, 79, 34], [79, 34, 78, 52],
    [78, 52, 76, 80],
    [76, 80, 82, 82],
    [79, 81, 100, 72], [100, 72, 103, 90], [103, 90, 111, 92],
  ],
};

/** Вис боком с прямыми ногами вперёд — L-сидение. */
const HANG_L: Figure = {
  head: [92, 42, 8.5],
  segments: [
    [86, 46, 79, 52],
    [80, 17, 79, 34], [79, 34, 78, 52],
    [78, 52, 76, 80],
    [76, 80, 82, 80],
    [80, 80, 104, 79], [104, 79, 128, 78], [128, 78, 132, 71],
  ],
};

/** Вис лицом к нам, колени подтянуты и уведены вбок — маятник. */
const HANG_TWIST: Figure = {
  head: [80, 40, 8.5],
  segments: [
    [80, 48, 80, 55],
    [69, 57, 91, 57],
    [80, 55, 80, 82],
    [69, 57, 71, 38], [71, 38, 72, 17],
    [91, 57, 89, 38], [89, 38, 88, 17],
    [73, 82, 87, 82],
    [85, 82, 108, 72], [108, 72, 113, 90], [113, 90, 121, 92],
    [85, 86, 110, 76], [110, 76, 115, 94],
  ],
};

/** Наклонный вис под низкой перекладиной — австралийские подтягивания. */
const INCLINE_HANG: Figure = {
  head: [42, 82, 8.5],
  segments: [
    [48, 80, 56, 77],
    [58, 77, 96, 96],
    [58, 54, 58, 66], [58, 66, 58, 77],
    [96, 96, 102, 98],
    [102, 98, 120, 106], [120, 106, 130, 110],
  ],
};

/**
 * Упор на прямых руках между брусьями, вид спереди: видно, что руки по бокам
 * и ноги оторваны от пола. Сбоку жерди сливаются, и выходит человек у забора.
 */
const DIP_SUPPORT: Figure = {
  head: [80, 28, 8.5],
  segments: [
    [80, 36, 80, 43],
    [68, 45, 92, 45],
    [80, 43, 80, 74],
    [68, 45, 64, 56], [64, 56, 62, 68],
    [92, 45, 96, 56], [96, 56, 98, 68],
    [72, 74, 88, 74],
    [72, 74, 68, 86], [68, 86, 74, 96],
    [88, 74, 92, 86], [92, 86, 86, 96],
  ],
};

const POSES = {
  standing_front: STANDING_FRONT,
  standing_side: STANDING_SIDE,
  sitting_front: SITTING_FRONT,
  sitting_side: SITTING_SIDE,
  supine: SUPINE,
  supine_bent: SUPINE_BENT,
  prone: PRONE,
  quadruped: QUADRUPED,
  plank_forearm: PLANK_FOREARM,
  plank_hands: PLANK_HANDS,
  side_lying: SIDE_LYING,
  side_plank: SIDE_PLANK,
  bird_dog: BIRD_DOG,
  dead_bug: DEAD_BUG,
  supine_leg_up: SUPINE_LEG_UP,
  sitting_leg_out: SITTING_LEG_OUT,
  kneeling_lunge: KNEELING_LUNGE,
  child_fold: CHILD_FOLD,
  hang_front: HANG_FRONT,
  hang_knees: HANG_KNEES,
  hang_l: HANG_L,
  hang_wide: HANG_WIDE,
  hang_twist: HANG_TWIST,
  incline_hang: INCLINE_HANG,
  dip_support: DIP_SUPPORT,
} as const;

type PoseName = keyof typeof POSES;

/* -------------------------------- реквизит ------------------------------- */

/** Опоры и предметы: стул, стена, дверной проём, пол, поручень. */
const PROPS = {
  floor: [[8, FLOOR, 152, FLOOR]] as Segment[],
  chair_side: [
    [74, 84, 106, 84],
    [74, 84, 71, 48],
    [78, 84, 78, FLOOR],
    [104, 84, 104, FLOOR],
  ] as Segment[],
  chair_front: [
    [62, 76, 98, 76],
    [64, 76, 64, FLOOR],
    [96, 76, 96, FLOOR],
  ] as Segment[],
  wall_left: [[16, 8, 16, FLOOR]] as Segment[],
  wall_right: [[140, 8, 140, FLOOR]] as Segment[],
  /** Стена за спиной: фигура стоит лицом вправо, значит спина слева. */
  wall_back: [[68, 8, 68, FLOOR]] as Segment[],
  /** Стена сбоку на расстоянии вытянутой руки. */
  wall_side: [[106, 8, 106, FLOOR]] as Segment[],
  ball: [] as Segment[],
  doorway: [
    [34, 10, 34, FLOOR],
    [126, 10, 126, FLOOR],
    [34, 10, 126, 10],
  ] as Segment[],
  support_bar: [
    [100, 62, 100, FLOOR],
    [90, 62, 110, 62],
  ] as Segment[],
  /** Турник: перекладина под потолком на двух стойках (GIMN-014). */
  pullup_bar: [
    [24, 16, 136, 16],
    [28, 16, 28, FLOOR],
    [132, 16, 132, FLOOR],
  ] as Segment[],
  /** Низкая перекладина по пояс — для австралийских подтягиваний. */
  low_bar: [
    [40, 52, 76, 52],
    [70, 52, 70, FLOOR],
  ] as Segment[],
  /** Брусья спереди: две жерди по бокам, каждая на своей стойке. */
  dip_bars: [
    [46, 68, 68, 68],
    [92, 68, 114, 68],
    [52, 68, 52, FLOOR],
    [108, 68, 108, FLOOR],
  ] as Segment[],
};

type PropName = keyof typeof PROPS;

/* -------------------------------- стрелки -------------------------------- */

type Arrow =
  /** Прямая стрелка: откуда и куда. */
  | ["line", number, number, number, number]
  /** Двусторонняя — движение туда-обратно. Короче 30 единиц не делать:
   *  наконечники сойдутся и стрелка превратится в пятно. */
  | ["both", number, number, number, number]
  /**
   * Дуга: центр, радиус, углы в градусах (0° — вправо, против часовой).
   * Углы задаются сквозной шкалой и могут быть отрицательными: пара вроде
   * 350 → 20 означает не «короткая дуга через ноль», а ход назад на 330°,
   * и вместо стрелки выходит круг. Пишите -10 → 20.
   */
  | ["arc", number, number, number, number, number]
  /** Круг со стрелкой — вращение на месте. */
  | ["circle", number, number, number]
  /** Нажим: короткая толстая стрелка (изометрия — давим, но не двигаемся). */
  | ["press", number, number, number, number]
  /** Удержание: пунктир вдоль тела — «держим линию», движения нет. */
  | ["hold", number, number, number, number];

const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => [
  cx + r * Math.cos((deg * Math.PI) / 180),
  cy - r * Math.sin((deg * Math.PI) / 180),
];

function arcPath(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const [x1, y1] = pt(cx, cy, r, a1);
  const [x2, y2] = pt(cx, cy, r, a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  const sweep = a2 > a1 ? 0 : 1;
  return `M${x1} ${y1} A${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

/* -------------------------------- схемы ---------------------------------- */

type Scheme = {
  pose: PoseName;
  props?: PropName[];
  arrows: Arrow[];
  /** Ладонь-опора: изометрия — это «давим в руку», и руку надо показать. */
  hands?: [number, number][];
  /** Отразить по горизонтали — когда движение удобнее показать в другую сторону. */
  flip?: boolean;
};

const SCHEMES: Record<string, Scheme> = {
  /* ---------- турник и брусья (GIMN-014) ---------- */
  "bar-dead-hang": {
    pose: "hang_front",
    props: ["pullup_bar", "floor"],
    // Вис — это вытяжение вниз под своим весом, а не движение.
    arrows: [["line", 46, 56, 46, 100]],
  },
  "bar-hang-posture": {
    pose: "hang_front",
    props: ["pullup_bar", "floor"],
    arrows: [["hold", 46, 42, 46, 104]],
  },
  "bar-active-hang": {
    pose: "hang_front",
    props: ["pullup_bar", "floor"],
    // Плечи опускаются — тело чуть поднимается.
    arrows: [["line", 46, 78, 46, 54]],
  },
  "bar-shrug": {
    pose: "hang_front",
    props: ["pullup_bar", "floor"],
    arrows: [["both", 46, 46, 46, 78]],
  },
  "bar-australian-row": {
    pose: "incline_hang",
    props: ["low_bar", "floor"],
    arrows: [["both", 88, 58, 88, 88]],
  },
  "bar-negative-pullup": {
    pose: "hang_front",
    props: ["pullup_bar", "floor"],
    // Только спуск: подъём в этом упражнении делается ногами с опоры.
    arrows: [["line", 46, 44, 46, 86]],
  },
  "bar-pullup-overhand": {
    pose: "hang_front",
    props: ["pullup_bar", "floor"],
    arrows: [["both", 46, 86, 46, 44]],
  },
  "bar-pullup-underhand": {
    pose: "hang_front",
    props: ["pullup_bar", "floor"],
    arrows: [["both", 48, 86, 48, 46]],
  },
  "bar-pullup-wide": {
    pose: "hang_wide",
    props: ["pullup_bar", "floor"],
    arrows: [["both", 38, 86, 38, 44]],
  },
  "bar-knee-raise": {
    pose: "hang_knees",
    props: ["pullup_bar", "floor"],
    arrows: [["both", 104, 102, 108, 68]],
  },
  "bar-leg-raise": {
    pose: "hang_l",
    props: ["pullup_bar", "floor"],
    arrows: [["both", 116, 104, 116, 72]],
  },
  "bar-l-hang": {
    pose: "hang_l",
    props: ["pullup_bar", "floor"],
    arrows: [["hold", 84, 86, 130, 84]],
  },
  "bar-hang-twist": {
    pose: "hang_twist",
    props: ["pullup_bar", "floor"],
    arrows: [["arc", 80, 82, 34, 300, 352]],
  },
  "dip-support-hold": {
    pose: "dip_support",
    props: ["dip_bars", "floor"],
    arrows: [["hold", 126, 40, 126, 92]],
  },
  "dip-pushup": {
    pose: "dip_support",
    props: ["dip_bars", "floor"],
    arrows: [["both", 126, 42, 126, 86]],
  },

  /* ---------- дыхание ---------- */
  "breath-square": {
    pose: "sitting_front",
    props: ["chair_front"],
    // Квадрат дыхания: вдох — задержка — выдох — пауза.
    arrows: [
      ["line", 118, 66, 118, 34],
      ["line", 124, 28, 146, 28],
      ["line", 150, 34, 150, 66],
      ["line", 146, 72, 124, 72],
    ],
  },
  "breath-cooldown": {
    pose: "supine",
    props: ["floor"],
    arrows: [
      ["line", 60, 76, 60, 62],
      ["line", 84, 62, 84, 82],
    ],
  },
  "breath-chest-expand": {
    pose: "sitting_front",
    props: ["chair_front"],
    arrows: [
      ["both", 74, 56, 42, 56],
      ["both", 86, 56, 118, 56],
    ],
  },

  /* ---------- шея ---------- */
  "neck-micro-nods": {
    pose: "sitting_side",
    props: ["chair_side"],
    arrows: [["arc", 84, 30, 20, 60, 30]],
  },
  "neck-micro-turns": {
    pose: "sitting_front",
    props: ["chair_front"],
    arrows: [["arc", 80, 22, 22, 150, 30]],
  },
  "warmup-neck-turns": {
    pose: "standing_front",
    arrows: [["arc", 80, 22, 24, 160, 20]],
  },
  "warmup-neck-tilts": {
    pose: "standing_front",
    arrows: [
      ["arc", 80, 34, 20, 110, 60],
      ["line", 100, 44, 104, 56],
    ],
  },
  "neck-chin-tuck": {
    pose: "sitting_side",
    props: ["chair_side"],
    arrows: [["line", 98, 30, 84, 30]],
  },
  "neck-iso-front": {
    pose: "sitting_side",
    props: ["chair_side"],
    arrows: [["press", 116, 26, 106, 26]],
    hands: [[104, 26]],
  },
  "neck-iso-side": {
    pose: "sitting_front",
    props: ["chair_front"],
    arrows: [["press", 112, 22, 103, 22]],
    hands: [[100, 22]],
  },
  "neck-iso-rotation": {
    pose: "sitting_front",
    props: ["chair_front"],
    arrows: [["press", 112, 30, 103, 27]],
    hands: [[100, 27]],
  },
  "massage-suboccipital": {
    pose: "sitting_side",
    props: ["chair_side"],
    arrows: [["circle", 76, 26, 9]],
  },

  /* ---------- плечи и руки ---------- */
  "warmup-shoulder-rolls": {
    pose: "standing_front",
    arrows: [
      ["circle", 62, 44, 10],
      ["circle", 98, 44, 10],
    ],
  },
  "gen-arm-swings": {
    pose: "standing_front",
    arrows: [
      ["both", 44, 43, 76, 51],
      ["both", 116, 43, 84, 51],
    ],
  },
  "main-arm-circles": {
    pose: "standing_front",
    arrows: [
      ["circle", 44, 44, 11],
      ["circle", 116, 44, 11],
    ],
  },
  "main-scapula-squeeze": {
    pose: "standing_front",
    // Сведение лопаток — движение в одну сторону, поэтому «нажим», а не
    // двусторонняя: между лопатками 16 единиц, два наконечника там слипаются.
    arrows: [["press", 50, 52, 72, 52], ["press", 110, 52, 88, 52]],
  },
  "main-shoulder-external": {
    pose: "standing_front",
    arrows: [
      ["arc", 62, 60, 18, 250, 200],
      ["arc", 98, 60, 18, 290, 340],
    ],
  },
  "main-shoulder-wall-slide": {
    pose: "standing_side",
    props: ["wall_back", "floor"],
    arrows: [["line", 88, 58, 88, 28]],
  },
  "shoulder-iso-wall": {
    pose: "standing_side",
    props: ["wall_side", "floor"],
    arrows: [["press", 92, 56, 103, 56]],
    hands: [[88, 56]],
  },
  "main-chest-opener-doorway": {
    pose: "standing_front",
    props: ["doorway"],
    arrows: [
      ["line", 54, 44, 44, 40],
      ["line", 106, 44, 116, 40],
    ],
  },
  "gen-row-band": {
    pose: "standing_side",
    arrows: [["line", 104, 60, 84, 58]],
  },
  "gen-pushup": {
    pose: "plank_hands",
    props: ["floor"],
    arrows: [["both", 80, 58, 80, 90]],
  },

  /* ---------- позвоночник ---------- */
  "main-cat-cow": {
    pose: "quadruped",
    props: ["floor"],
    arrows: [["both", 80, 56, 80, 86]],
  },
  "main-thoracic-rotation": {
    pose: "quadruped",
    props: ["floor"],
    // Локоть раскрывается ВВЕРХ. Углы пишем сквозной шкалой (-40, а не 320):
    // через 0° дуга уходила длинным путём и рисовала круг под животом.
    arrows: [["arc", 64, 62, 22, -40, 60]],
  },
  "main-side-bend-standing": {
    pose: "standing_front",
    arrows: [["arc", 80, 46, 30, 250, 300]],
  },
  "main-prone-extension": {
    pose: "prone",
    props: ["floor"],
    arrows: [["arc", 52, 92, 24, 170, 120]],
  },
  "main-swimmer": {
    pose: "prone",
    props: ["floor"],
    arrows: [
      ["line", 36, 96, 28, 84],
      ["line", 122, 100, 132, 90],
    ],
  },
  "main-knee-to-chest": {
    pose: "supine_bent",
    props: ["floor"],
    arrows: [["line", 110, 70, 76, 62]],
  },
  "main-wall-posture": {
    pose: "standing_side",
    props: ["wall_back", "floor"],
    arrows: [["line", 84, 12, 84, 2], ["press", 88, 44, 72, 44]],
  },
  "spine-iso-chair": {
    pose: "sitting_side",
    props: ["chair_side"],
    // Спина давит НАЗАД, в спинку стула: фигура сидит лицом вправо,
    // значит стрелка идёт влево. Раньше она показывала ровно наоборот.
    arrows: [["press", 94, 58, 80, 58]],
  },
  "spine-micro-rotation": {
    pose: "sitting_front",
    props: ["chair_front"],
    arrows: [["arc", 80, 58, 26, 150, 40]],
  },
  "massage-paravertebral": {
    pose: "standing_side",
    props: ["wall_right"],
    arrows: [["both", 128, 88, 128, 44]],
  },
  "stretch-child-pose": {
    pose: "child_fold",
    props: ["floor"],
    arrows: [["line", 30, 104, 12, 100]],
  },
  "stretch-supine-twist": {
    pose: "supine_bent",
    props: ["floor"],
    arrows: [
      ["arc", 92, 92, 24, 60, 0],
      ["arc", 30, 92, 18, 120, 180],
    ],
  },
  "stretch-full-body": {
    pose: "supine",
    props: ["floor"],
    arrows: [
      ["line", 24, 84, 8, 80],
      ["line", 132, 94, 150, 98],
    ],
  },
  "gen-stretch-full": {
    pose: "standing_side",
    arrows: [["arc", 79, 44, 28, 250, 320]],
  },

  /* ---------- корпус ---------- */
  "gen-plank": {
    pose: "plank_forearm",
    props: ["floor"],
    // Планку держат, а не двигают: пунктир показывает линию тела.
    arrows: [["hold", 48, 78, 136, 108]],
  },
  "gen-side-plank": {
    pose: "side_plank",
    props: ["floor"],
    arrows: [["hold", 44, 64, 138, 108]],
  },
  "main-bird-dog": {
    pose: "bird_dog",
    props: ["floor"],
    arrows: [["line", 40, 56, 22, 50], ["line", 130, 60, 148, 54]],
  },
  "main-dead-bug": {
    pose: "dead_bug",
    props: ["floor"],
    arrows: [["line", 48, 74, 26, 62], ["line", 110, 76, 136, 64]],
  },
  "gen-mountain-climbers": {
    pose: "plank_hands",
    props: ["floor"],
    arrows: [["both", 124, 104, 86, 92]],
  },

  /* ---------- таз и ноги ---------- */
  "gen-glute-bridge": {
    pose: "supine_bent",
    props: ["floor"],
    arrows: [["line", 72, 106, 72, 84]],
  },
  "main-bridge": {
    pose: "supine_bent",
    props: ["floor"],
    arrows: [["line", 72, 106, 72, 84]],
  },
  "main-hip-abduction": {
    pose: "side_lying",
    props: ["floor"],
    // Нога поднимается на 30-40 см — короткая дуга вверх, не круг (см. выше).
    arrows: [["arc", 88, 92, 34, -10, 20]],
  },
  "hips-iso-squeeze": {
    pose: "sitting_front",
    props: ["chair_front"],
    arrows: [["press", 56, 86, 70, 86], ["press", 104, 86, 90, 86]],
  },
  "main-hip-flexor-stretch": {
    pose: "kneeling_lunge",
    props: ["floor"],
    arrows: [["line", 62, 74, 78, 70]],
  },
  "stretch-piriformis": {
    pose: "supine_bent",
    props: ["floor"],
    arrows: [["line", 112, 78, 84, 68]],
  },
  "main-hamstring-stretch": {
    pose: "supine_leg_up",
    props: ["floor"],
    arrows: [["line", 108, 56, 96, 42]],
  },
  "legs-quad-set": {
    pose: "sitting_leg_out",
    props: ["chair_side", "floor"],
    arrows: [["press", 116, 84, 116, 98]],
  },
  "main-mini-squat": {
    pose: "standing_side",
    props: ["support_bar", "floor"],
    arrows: [["both", 56, 60, 56, 96]],
  },
  "gen-step-touch": {
    pose: "standing_front",
    arrows: [["both", 44, 100, 116, 100]],
  },
  "gen-jumping-jacks": {
    pose: "standing_front",
    arrows: [
      ["both", 56, 44, 34, 16],
      ["both", 104, 44, 126, 16],
      ["both", 56, 108, 24, 108],
      ["both", 104, 108, 136, 108],
    ],
  },
  "massage-glutes-ball": {
    pose: "sitting_side",
    props: ["floor"],
    arrows: [["both", 60, 100, 100, 100], ["circle", 80, 96, 7]],
  },
};

/** Есть ли для упражнения схема движения. */
export function hasScheme(slug: string | null | undefined): boolean {
  return !!slug && slug in SCHEMES;
}

/* ------------------------------- отрисовка ------------------------------- */

function arrowPath(a: Arrow): { d: string; head: boolean; tail: boolean; bold?: boolean; dashed?: boolean } {
  switch (a[0]) {
    case "line":
      return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: true, tail: false };
    case "press":
      return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: true, tail: false, bold: true };
    case "hold":
      return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: false, tail: false, dashed: true };
    case "both":
      return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: true, tail: true };
    case "arc":
      return { d: arcPath(a[1], a[2], a[3], a[4], a[5]), head: true, tail: false };
    case "circle":
      // Не замкнутый круг: разрыв нужен, чтобы поместился наконечник.
      return { d: arcPath(a[1], a[2], a[3], 80, -250), head: true, tail: false };
  }
}

/**
 * Схема движения. `id` нужен, чтобы маркеры-наконечники не конфликтовали,
 * когда на странице несколько схем сразу (каталог).
 */
export function ExerciseScheme({
  slug,
  className,
  compact,
}: {
  slug: string;
  className?: string;
  /** Значок в списке: линии толще, иначе на 44 пикселях схема еле видна. */
  compact?: boolean;
}) {
  const scheme = SCHEMES[slug];
  if (!scheme) return null;

  const k = compact ? 1.7 : 1;

  const pose = POSES[scheme.pose];
  const markerId = `arrowhead-${slug}${compact ? "-s" : ""}`;
  const props = (scheme.props ?? []).flatMap((p) => PROPS[p]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-hidden
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth={compact ? 4 : 5}
          markerHeight={compact ? 4 : 5}
          orient="auto-start-reverse"
        >
          <path d="M0 1 L9 5 L0 9 z" fill="currentColor" className="text-primary" />
        </marker>
      </defs>

      <g transform={scheme.flip ? `translate(${W} 0) scale(-1 1)` : undefined}>
        {/* Опоры — тоньше и бледнее фигурки: это обстановка, а не движение. */}
        <g className="text-foreground/25" stroke="currentColor" strokeWidth={2 * k}>
          {props.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>

        <g className="text-foreground/70" stroke="currentColor" strokeWidth={3.4 * k}>
          <circle cx={pose.head[0]} cy={pose.head[1]} r={pose.head[2]} />
          {pose.segments.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>

        {(scheme.hands ?? []).map(([hx, hy], i) => (
          <rect
            key={`hand-${i}`}
            x={hx - 3}
            y={hy - 5}
            width={6}
            height={10}
            rx={3}
            className="text-foreground/70"
            stroke="currentColor"
            strokeWidth={2.6 * k}
          />
        ))}

        <g className="text-primary" stroke="currentColor">
          {scheme.arrows.map((a, i) => {
            const { d, head, tail, bold, dashed } = arrowPath(a);
            return (
              <path
                key={i}
                d={d}
                strokeWidth={(bold ? 4 : 3) * k}
                strokeDasharray={dashed ? "5 4" : undefined}
                markerEnd={head ? `url(#${markerId})` : undefined}
                markerStart={tail ? `url(#${markerId})` : undefined}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}

/** Схема в рамке карточки — тот же размер и фон, что у живых картинок. */
export function ExerciseSchemeCard({ slug, type }: { slug: string; type?: ExerciseType }) {
  void type;
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-primary/8">
      <ExerciseScheme slug={slug} className="size-full p-3" />
    </div>
  );
}
