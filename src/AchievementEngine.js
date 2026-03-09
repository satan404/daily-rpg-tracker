import { isSameDay, differenceInDays, parseISO, format } from 'date-fns';

export const AchievementEngine = {
    // Badges Definitions
    BADGES: {
        EARLY_BIRD: { id: 'early_bird', name: '早鳥先鋒', description: '完成今天的第一個任務', emoji: '🌅' },
        COMBO_STRIKER: { id: 'combo_striker', name: '連擊大師', description: '單日連續完成 3 個任務以上', emoji: '🔥' },
        CONSISTENT_HERO_3: { id: 'consistent_3', name: '見習勇者', description: '連續 3 天完成任務', emoji: '🥉' },
        CONSISTENT_HERO_7: { id: 'consistent_7', name: '可靠勇者', description: '連續 7 天完成任務', emoji: '🥈' },
        CONSISTENT_HERO_30: { id: 'consistent_30', name: '傳說勇者', description: '連續 30 天完成任務', emoji: '🥇' },
    },

    getProfileState() {
        const defaultProfile = {
            heroName: '冒險者',
            totalBossesDefeated: 0,
            totalTasksCompleted: 0,
            currentCombo: 0,
            maxCombo: 0,
            lastActiveDate: null,
            currentDailyStreak: 0,
            maxDailyStreak: 0,
            unlockedBadges: [], // array of badge IDs
            sp: 0, // Skill Points for Ultimate Attacks
            spProgress: 0 // Tasks completed since last SP (0-2)
        };

        const saved = localStorage.getItem('rpgProfile');
        if (saved) {
            return { ...defaultProfile, ...JSON.parse(saved) };
        }
        return defaultProfile;
    },

    saveProfileState(profile) {
        localStorage.setItem('rpgProfile', JSON.stringify(profile));
    },

    // Called whenever a task is successfully completed
    onTaskCompleted(taskId, tasks) {
        let profile = this.getProfileState();
        let newlyUnlocked = []; // Keep track of badges newly unlocked in this transaction
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        // 1. Update basic stats
        profile.totalTasksCompleted += 1;
        profile.currentCombo += 1;
        if (profile.currentCombo > profile.maxCombo) {
            profile.maxCombo = profile.currentCombo;
        }

        // SP Logic: 1 SP every 3 tasks completed
        profile.spProgress += 1;
        let gainedSp = false;
        if (profile.spProgress >= 3) {
            profile.sp += 1;
            profile.spProgress = 0;
            gainedSp = true;
        }

        // 2. Daily Streak Logic
        if (profile.lastActiveDate) {
            const lastDate = parseISO(profile.lastActiveDate);
            const diff = differenceInDays(new Date(), lastDate);

            if (diff === 1) {
                // Next consecutive day
                profile.currentDailyStreak += 1;
            } else if (diff > 1) {
                // Streak broken
                profile.currentDailyStreak = 1;
            }
            // If diff === 0, it's the same day, streak doesn't increase but doesn't break
        } else {
            // First time completing a task ever
            profile.currentDailyStreak = 1;
        }

        if (profile.currentDailyStreak > profile.maxDailyStreak) {
            profile.maxDailyStreak = profile.currentDailyStreak;
        }
        profile.lastActiveDate = todayStr;

        // 3. Process Badges Unlock

        const grantBadge = (badgeId) => {
            if (!profile.unlockedBadges.includes(badgeId)) {
                profile.unlockedBadges.push(badgeId);
                newlyUnlocked.push(this.BADGES[badgeId]);
            }
        };

        // Early Bird: Did they complete their first task today?
        const tasksCompletedToday = tasks.filter(t => t.completed && t.lastCompletedDate === todayStr).length;
        // Note: 'tasks' passed here is BEFORE the current task is fully saved into state sometimes, 
        // or we can just say if this is the first one being completed today
        if (tasksCompletedToday === 0 || (tasksCompletedToday === 1 && tasks.find(t => t.id === taskId)?.completed)) { // Depending on when this is called
            grantBadge('EARLY_BIRD');
        }

        // Combo Striker: 3 combo reached
        if (profile.currentCombo >= 3) {
            grantBadge('COMBO_STRIKER');
        }

        // Consecutive Days Badges
        if (profile.currentDailyStreak >= 3) grantBadge('CONSISTENT_HERO_3');
        if (profile.currentDailyStreak >= 7) grantBadge('CONSISTENT_HERO_7');
        if (profile.currentDailyStreak >= 30) grantBadge('CONSISTENT_HERO_30');

        this.saveProfileState(profile);
        return { profile, newlyUnlocked };
    },

    // Called when a task is skipped/failed (Loss aversion)
    onTaskFailed() {
        let profile = this.getProfileState();
        // Break combo
        profile.currentCombo = 0;
        this.saveProfileState(profile);
        return profile;
    },

    onBossDefeated() {
        let profile = this.getProfileState();
        profile.totalBossesDefeated += 1;
        this.saveProfileState(profile);
        return profile;
    },

    useSp() {
        let profile = this.getProfileState();
        if (profile.sp > 0) {
            profile.sp -= 1;
            this.saveProfileState(profile);
            return { success: true, profile };
        }
        return { success: false, profile };
    }
};
