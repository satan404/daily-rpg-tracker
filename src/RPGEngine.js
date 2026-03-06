// Simple RPG Engine for Daily Tracker

const MONSTER_NAMES = [
    "拖延史萊姆",
    "分心哥布林",
    "懶骨頭骷髏",
    "瞌睡蟲精靈",
    "混亂小惡魔",
    "壓力山大食人魔",
    "健忘幽靈",
    "沙發馬鈴薯獸",
    "網購黑洞惡龍",
    "明天再說巫師",
    "半途而廢騎士",
    "完美主義巨像",
    "三分鐘熱度盜賊",
    "無頭蒼蠅精怪",
    "摸魚美人魚",
    "眼皮沉重熊",
    "焦慮章魚",
    "手機成癮猿",
    "糖分暴走鼠",
    "遲到大王蝸牛",
    "藉口多多鸚鵡"
];

const ENCOURAGEMENTS = [
    "別放棄！每一次努力都有用！",
    "魔王正在回血，但你一定能贏！",
    "哎呀沒打中... 但你已經摸清它的套路了！",
    "休息一下也無妨。英雄明天會繼續戰鬥！",
    "日常生活的地下城很艱難，但你更強大！"
];

export class RPGEngine {
    static getDailyBoss(offset = 0) {
        // Generate consistent boss for the day using current date
        const today = new Date().toDateString();

        // Simple hash function to pick a monster consistently
        let hash = 0;
        const seedStr = today + offset;
        for (let i = 0; i < seedStr.length; i++) {
            hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
        }

        const index = Math.abs(hash) % MONSTER_NAMES.length;
        const baseHp = 100 + (offset * 20); // HP scales with how many you defeated today

        const allEmojis = [
            '🦠', '👺', '💀', '💨', '👾', '👹', '👻', '🥔', '🐉', '🧙‍♂️',
            '🤺', '🗿', '🥷', '🦟', '🧜‍♀️', '🐻', '🐙', '🦧', '🐭', '🐌', '🦜'
        ];

        return {
            id: `${today}-${offset}`,
            offset: offset,
            name: MONSTER_NAMES[index],
            maxHp: baseHp,
            hp: baseHp, // Need to restore current hp from local storage in components
            emoji: allEmojis[index]
        };
    }

    static calculateDamage(taskDurationMinutes = 30) {
        // Damage scales heavily with task duration to feel rewarding. 
        // Base damage is 60 for a typical 30-min task.
        return Math.floor(40 + (taskDurationMinutes));
    }

    static getEncouragement() {
        // Return a random encouraging message
        const index = Math.floor(Math.random() * ENCOURAGEMENTS.length);
        return ENCOURAGEMENTS[index];
    }
}
