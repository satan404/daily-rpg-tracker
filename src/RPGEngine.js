// Simple RPG Engine for Daily Tracker

const MONSTER_PREFIXES = [
    "拖延", "分心", "懶骨頭", "瞌睡蟲", "混亂", "壓力山大", "健忘",
    "網購", "明天再說", "半途而廢", "完美主義", "三分鐘熱度", "無頭蒼蠅", "摸魚",
    "眼皮沉重", "焦慮", "手機成癮", "糖分暴走", "遲到大王", "藉口多多",
    "隨便啦", "不想面對", "情緒勒索", "自暴自棄", "過度反思"
];

const MONSTER_NOUNS = [
    { name: "史萊姆", emoji: '🦠' },
    { name: "哥布林", emoji: '👺' },
    { name: "骷髏", emoji: '💀' },
    { name: "精靈", emoji: '🧚‍♂️' },
    { name: "小惡魔", emoji: '👿' },
    { name: "食人魔", emoji: '👹' },
    { name: "幽靈", emoji: '👻' },
    { name: "馬鈴薯獸", emoji: '🥔' },
    { name: "惡龍", emoji: '🐉' },
    { name: "巫師", emoji: '🧙‍♂️' },
    { name: "騎士", emoji: '🤺' },
    { name: "巨像", emoji: '🗿' },
    { name: "盜賊", emoji: '🥷' },
    { name: "精怪", emoji: '👾' },
    { name: "美人魚", emoji: '🧜‍♀️' },
    { name: "巨大熊", emoji: '🐻' },
    { name: "大章魚", emoji: '🐙' },
    { name: "猿猴", emoji: '🦧' },
    { name: "巨鼠", emoji: '🐭' },
    { name: "蝸牛精", emoji: '🐌' },
    { name: "鸚鵡獸", emoji: '🦜' },
    { name: "外星人", emoji: '👽' },
    { name: "機械兵", emoji: '🤖' },
    { name: "食人花", emoji: '🥀' }
];

export class RPGEngine {
    static getDailyBoss(offset = 0) {
        // Generate consistent boss for the day using current date
        const today = new Date().toDateString();

        // Simple hash function to pick a monster consistently
        let hash1 = 0;
        let hash2 = 0;
        const seedStr = today + offset;
        for (let i = 0; i < seedStr.length; i++) {
            hash1 = seedStr.charCodeAt(i) + ((hash1 << 5) - hash1);
            hash2 = seedStr.charCodeAt(seedStr.length - 1 - i) + ((hash2 << 5) - hash2);
        }

        const prefixIndex = Math.abs(hash1) % MONSTER_PREFIXES.length;
        const nounIndex = Math.abs(hash2) % MONSTER_NOUNS.length;

        const baseHp = 100 + (offset * 20); // HP scales with how many you defeated today

        const nounObj = MONSTER_NOUNS[nounIndex];

        return {
            id: `${today}-${offset}`,
            offset: offset,
            name: `${MONSTER_PREFIXES[prefixIndex]}${nounObj.name}`,
            maxHp: baseHp,
            hp: baseHp,
            emoji: nounObj.emoji
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
