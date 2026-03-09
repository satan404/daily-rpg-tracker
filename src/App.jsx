import React, { useState, useEffect } from 'react';
import { Sword, Plus, Trash2, Clock, Flame, BarChart2, X } from 'lucide-react';
import { parse, differenceInMinutes, isWithinInterval, isBefore, format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { RPGEngine } from './RPGEngine';
import { AchievementEngine } from './AchievementEngine';
import './App.css';

function App() {
  const [boss, setBoss] = useState(RPGEngine.getDailyBoss());
  const [tasks, setTasks] = useState([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskStartTime, setNewTaskStartTime] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState('15'); // default 15 mins
  const [newTaskDays, setNewTaskDays] = useState([new Date().getDay()]); // Default to today only
  const [message, setMessage] = useState('出現了一隻新魔王！完成任務來打敗它吧！');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [view, setView] = useState('game'); // 'game', 'stats', 'profile'
  const [statsData, setStatsData] = useState([]);
  const [attackEffect, setAttackEffect] = useState(null); // { type: 'fire', emoji: '🔥' }
  const [ultimateEffect, setUltimateEffect] = useState(null); // { type: 'meteor', emoji: '☄️' }
  const [particles, setParticles] = useState([]); // Array of particle objects
  const [isHit, setIsHit] = useState(false);
  const [profile, setProfile] = useState(AchievementEngine.getProfileState());

  const openStats = async () => {
    const { StatsEngine } = await import('./StatsEngine');
    setStatsData(StatsEngine.getMonthlyStats());
    setView('stats');
  };

  // Load data from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('dailyRPGTasks');
    if (savedTasks) {
      let parsedTasks = JSON.parse(savedTasks);

      // Reset recurring tasks if it's a new day
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      parsedTasks = parsedTasks.map(t => {
        if (t.lastCompletedDate !== todayStr && t.daysOfWeek) {
          return {
            ...t,
            completed: false,
            failed: false,
            startReminded: false,
            endReminded: false
          };
        }
        return t;
      });

      setTasks(parsedTasks);
    }
    const savedBoss = localStorage.getItem(`boss_${boss.id}`);
    if (savedBoss) {
      setBoss(JSON.parse(savedBoss));
    }
  }, [boss.id]);

  // Save to localStorage when tasks/boss change
  useEffect(() => {
    localStorage.setItem('dailyRPGTasks', JSON.stringify(tasks));
    localStorage.setItem(`boss_${boss.id}`, JSON.stringify(boss));

    // Save to daily stats
    import('./StatsEngine').then(({ StatsEngine }) => {
      StatsEngine.saveDailyRecord(tasks);
    });
  }, [tasks, boss]);

  // Failsafe: if boss is dead for more than 5 seconds, auto-respawn
  useEffect(() => {
    let timeoutId;
    if (boss.hp <= 0) {
      timeoutId = setTimeout(() => {
        setBoss(prevBoss => {
          if (prevBoss.hp <= 0) {
            const nextOffset = (prevBoss.offset || 0) + 1;
            const nextBoss = RPGEngine.getDailyBoss(nextOffset);
            setMessage(`野生的 ${nextBoss.name} 出現了！`);
            return nextBoss;
          }
          return prevBoss;
        });
      }, 5000);
    }
    return () => clearTimeout(timeoutId);
  }, [boss.hp]);

  // Real-time tracker for Audio & Burning effect
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now); // Update UI state for burning effect

      tasks.forEach(task => {
        if (!task.completed && !task.failed && task.startTime) {
          const startTimeDate = parse(task.startTime, 'HH:mm', now);
          let endTimeDate = task.endTime ? parse(task.endTime, 'HH:mm', now) : null;
          if (endTimeDate && isBefore(endTimeDate, startTimeDate)) {
            endTimeDate = new Date(endTimeDate.getTime() + 24 * 3600000); // cross midnight
          }

          // Audio Reminder at start time
          const startDiffMs = now.getTime() - startTimeDate.getTime();
          if (startDiffMs >= 0 && startDiffMs < 10000 && !task.startReminded) {
            playAudioAlarm(false);
            markAsReminded(task.id, 'startReminded');
          }

          // Urgent Audio Reminder 1 min before end time
          if (endTimeDate) {
            const endDiffMs = endTimeDate.getTime() - now.getTime();
            // If we are between 0 and 60 seconds from the end
            if (endDiffMs <= 60000 && endDiffMs > 50000 && !task.endReminded) {
              playAudioAlarm(true);
              markAsReminded(task.id, 'endReminded');
            }
          }
        }
      });
    }, 5000); // Check every 5 secs for tighter audio trigger
    return () => clearInterval(interval);
  }, [tasks]);

  const playAudioAlarm = (isUrgent = false) => {
    // Generate a simple pleasant chime using Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playNote = (freq, startTime, duration) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = isUrgent ? 'sawtooth' : 'sine';
      oscillator.frequency.value = freq;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;

    // Play the sequence 4 times to make it sound longer (about 4 seconds total)
    for (let i = 0; i < 4; i++) {
      const offset = now + (i * 0.9); // repeat every 0.9s
      if (isUrgent) {
        // Fast, urgent sound
        playNote(880, offset, 0.1); // A5
        playNote(880, offset + 0.15, 0.1);
        playNote(880, offset + 0.3, 0.1);
        playNote(1046.50, offset + 0.45, 0.3); // C6
      } else {
        // Normal chime
        playNote(523.25, offset, 0.4); // C5
        playNote(659.25, offset + 0.1, 0.4); // E5
        playNote(783.99, offset + 0.2, 0.8); // G5
      }
    }
  };

  const markAsReminded = (id, field) => {
    setTasks(tasks => tasks.map(t => t.id === id ? { ...t, [field]: true } : t));
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !newTaskStartTime) return;

    const parsedStart = parse(newTaskStartTime, 'HH:mm', new Date());
    const durationMins = parseInt(newTaskDuration, 10) || 15;
    const endTime = format(new Date(parsedStart.getTime() + durationMins * 60000), 'HH:mm');

    const newTask = {
      id: Date.now().toString(),
      title: newTaskName,
      startTime: newTaskStartTime,
      endTime: endTime,
      completed: false,
      failed: false,
      startReminded: false,
      endReminded: false,
      daysOfWeek: [...newTaskDays] // array of selected day indices (0-6)
    };

    setTasks([...tasks, newTask].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setNewTaskName('');
    setNewTaskStartTime('');
    setNewTaskDays([new Date().getDay()]); // Reset to today
  };

  const calculateTaskDurationMinutes = (start, end) => {
    if (!start || !end) return 15;
    const t1 = parse(start, 'HH:mm', new Date());
    let t2 = parse(end, 'HH:mm', new Date());
    if (isBefore(t2, t1)) {
      // Handle跨夜 / next day scenario simply by adding 24 hours
      t2 = new Date(t2.getTime() + 24 * 60 * 60000);
    }
    const diff = differenceInMinutes(t2, t1);
    return diff > 0 ? diff : 15;
  };

  const completeTask = (id) => {
    // 1. Scroll up immediately
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 2. Mark task as completed immediately for UI responsiveness
    const task = tasks.find(t => t.id === id);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const newTasks = tasks.map(t => t.id === id ? { ...t, completed: true, lastCompletedDate: todayStr } : t);
    setTasks(newTasks);

    // 2.5 Trigger Achievement Engine
    const { profile: newProfile, newlyUnlocked } = AchievementEngine.onTaskCompleted(id, newTasks);
    setProfile(newProfile);

    // 3. Delay the attack effect and damage calculation to wait for scroll (400ms)
    setTimeout(() => {
      // Choose random magic attack (10 types)
      const effects = [
        { type: 'lightning', emoji: '⚡' },
        { type: 'fire', emoji: '🔥' },
        { type: 'freeze', emoji: '🧊' },
        { type: 'tornado', emoji: '🌪️' },
        { type: 'earth', emoji: '🪨' },
        { type: 'light', emoji: '✨' },
        { type: 'dark', emoji: '🌑' },
        { type: 'poison', emoji: '🧪' },
        { type: 'star', emoji: '🌠' },
        { type: 'water', emoji: '🌊' }
      ];
      const randomEffect = effects[Math.floor(Math.random() * effects.length)];
      setAttackEffect(randomEffect);
      setIsHit(true);

      // Clear effect and hit state after animation (1s max to cover all animations)
      setTimeout(() => {
        setAttackEffect(null);
        setIsHit(false);
      }, 1000);

      if (boss.hp > 0 && task) {
        const duration = calculateTaskDurationMinutes(task.startTime, task.endTime);
        const damage = RPGEngine.calculateDamage(duration);
        const newHp = Math.max(0, boss.hp - damage);
        setBoss({ ...boss, hp: newHp });

        if (newHp === 0) {
          AchievementEngine.onBossDefeated();
          setProfile(AchievementEngine.getProfileState());

          let unlockMsg = newlyUnlocked.length > 0 ? ` 獲得勳章：${newlyUnlocked.map(b => b.emoji).join(' ')}` : '';
          setMessage(`勝利！你用 ${randomEffect.emoji} 打敗了 ${boss.name}！ 🏆${unlockMsg} 新的魔王即將出現...`);

          // Spawn next boss after 2 seconds
          setTimeout(() => {
            const nextOffset = (boss.offset || 0) + 1;
            const nextBoss = RPGEngine.getDailyBoss(nextOffset);
            setBoss(nextBoss);
            setMessage(`野生的 ${nextBoss.name} 出現了！`);
          }, 2000);

        } else {
          let unlockMsg = newlyUnlocked.length > 0 ? ` 獲得勳章：${newlyUnlocked.map(b => b.emoji).join(' ')}` : '';
          setMessage(`強擊！魔王受到 ${damage} 點傷害。${unlockMsg} 繼續保持！ ⚔️`);
        }
      }
    }, 400); // Wait 400ms for smooth scroll to finish
  };

  const castUltimate = () => {
    if (profile.sp <= 0 || boss.hp <= 0) return;

    // 1. Deduct SP
    const { success, profile: newProfile } = AchievementEngine.useSp();
    if (!success) return;
    setProfile(newProfile);

    // 2. Scroll up immediately
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 3. Trigger Ultimate Effect
    setTimeout(() => {
      const ultimateTypes = [
        { type: 'meteor', emoji: '☄️', name: '隕石墜落' },
        { type: 'laser', emoji: '💫', name: '雷射加農砲' },
        { type: 'satellite', emoji: '🛸', name: '衛星武器砲擊' },
        { type: 'blackhole', emoji: '🌌', name: '黑洞墜擊' },
        { type: 'evil', emoji: '👿', name: '惡之波動' },
        { type: 'slash', emoji: '🗡️', name: '烈風亂斬' }
      ];
      const randomUlt = ultimateTypes[Math.floor(Math.random() * ultimateTypes.length)];
      // Generate Particles
      const newParticles = [];
      const particleEmojis = ['✨', '💥', '⚡', '💫', '🔥', '🌟', '💨'];
      for (let i = 0; i < 40; i++) {
        newParticles.push({
          id: i,
          emoji: particleEmojis[Math.floor(Math.random() * particleEmojis.length)],
          tx: (Math.random() - 0.5) * 400 + 'px', // Random X translation (-200px to +200px)
          ty: (Math.random() - 0.5) * 400 + 'px', // Random Y translation
          delay: Math.random() * 0.5 + 's', // Staggered start
          duration: (Math.random() * 1 + 1) + 's', // 1s to 2s
          scale: Math.random() * 1.5 + 0.5,
          color: `hsl(${Math.random() * 360}, 100%, 70%)`
        });
      }
      setParticles(newParticles);
      setUltimateEffect(randomUlt);
      setIsHit(true);

      const ultimateDamage = 300; // Massive damage

      // Longer timeout to allow complex animations to play out (2.5 seconds)
      setTimeout(() => {
        setUltimateEffect(null);
        setParticles([]);
        setIsHit(false);
      }, 2500);

      const newHp = Math.max(0, boss.hp - ultimateDamage);
      setBoss({ ...boss, hp: newHp });

      if (newHp === 0) {
        AchievementEngine.onBossDefeated();
        setProfile(AchievementEngine.getProfileState());
        setMessage(`太神啦！你用終極大招【${randomUlt.name}】秒殺了 ${boss.name}！ 🌟🌟🌟 新的魔王即將出現...`);

        // Wait a bit longer before spawning the next boss so they can see the full effect
        setTimeout(() => {
          const nextOffset = (boss.offset || 0) + 1;
          const nextBoss = RPGEngine.getDailyBoss(nextOffset);
          setBoss(nextBoss);
          setMessage(`野生的 ${nextBoss.name} 出現了！`);
        }, 2500);
      } else {
        setMessage(`毀天滅地！【${randomUlt.name}】造成了 ${ultimateDamage} 點巨大傷害！ 💥`);
      }
    }, 400); // 400ms delay to wait for scrolling up
  };

  const failTask = (id) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: true, failed: true, lastCompletedDate: todayStr } : t));

    // Break Combo
    setProfile(AchievementEngine.onTaskFailed());

    setMessage(RPGEngine.getEncouragement());
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const hpPercentage = (boss.hp / boss.maxHp) * 100;

  // Process tasks before rendering
  const todayDayOfWeek = currentTime.getDay();
  const processedTasks = [...tasks]
    .filter(t => !t.daysOfWeek || t.daysOfWeek.includes(todayDayOfWeek))
    .map(task => {
      let isBurning = false;
      let progressPercent = 0;

      if (!task.completed && !task.failed && task.startTime && task.endTime) {
        const s = parse(task.startTime, 'HH:mm', currentTime);
        let e = parse(task.endTime, 'HH:mm', currentTime);
        if (isBefore(e, s)) e = new Date(e.getTime() + 24 * 3600000);

        isBurning = isWithinInterval(currentTime, { start: s, end: e });

        if (isBurning) {
          const totalDurationMs = e.getTime() - s.getTime();
          const elapsedMs = currentTime.getTime() - s.getTime();
          progressPercent = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));
        } else if (isBefore(e, currentTime)) {
          progressPercent = 100;
        }
      }
      return { ...task, isBurning, progressPercent };
    });

  const burningTasks = processedTasks.filter(t => t.isBurning && !t.completed && !t.failed).sort((a, b) => {
    if (a.startTime && b.startTime) {
      return parse(a.startTime, 'HH:mm', currentTime).getTime() - parse(b.startTime, 'HH:mm', currentTime).getTime();
    }
    return 0;
  });

  const otherTasks = processedTasks.filter(t => !t.isBurning || t.completed || t.failed).sort((a, b) => {
    const aDone = a.completed || a.failed;
    const bDone = b.completed || b.failed;
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;
    if (a.startTime && b.startTime) {
      return parse(a.startTime, 'HH:mm', currentTime).getTime() - parse(b.startTime, 'HH:mm', currentTime).getTime();
    }
    return 0;
  });

  const renderTask = (task) => (
    <div key={task.id} className={`glass-panel task-item ${task.completed ? 'completed' : ''} ${task.isBurning ? 'burning' : ''}`}>
      {task.isBurning && <div className="task-progress-bg" style={{ width: `${task.progressPercent}%` }}></div>}
      <div className="task-item-content">
        <div className="task-info">
          <h3 style={{ display: 'flex', alignItems: 'center' }}>
            {task.title}
            {task.isBurning && <Flame size={18} color="#ff6b81" className="flame-icon" style={{ marginLeft: '8px' }} />}
          </h3>
          {task.startTime && (
            <p><Clock size={14} style={{ verticalAlign: 'middle', marginRight: '4px', marginBottom: '2px' }} />
              {task.startTime} - {task.endTime} ({calculateTaskDurationMinutes(task.startTime, task.endTime)} 分鐘)
            </p>
          )}
        </div>
        <div className="action-buttons">
          {!task.completed && (
            <>
              <button type="button" onClick={() => completeTask(task.id)} style={{ backgroundColor: 'var(--success)' }} title="完成">
                <Sword size={18} />
              </button>
              <button type="button" onClick={() => failTask(task.id)} style={{ backgroundColor: '#666', border: '1px solid #888' }} title="跳過/未完成">
                <Clock size={18} />
              </button>
            </>
          )}
          <button type="button" onClick={() => deleteTask(task.id)} style={{ backgroundColor: 'var(--danger)' }} title="刪除">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  if (view === 'stats') {
    return (
      <div className="app-container">
        <div className="glass-panel" style={{ position: 'relative' }}>
          <button onClick={() => setView('game')} style={{ position: 'absolute', top: 10, right: 10, background: 'transparent' }}><X color="white" /></button>

          <h2 style={{ textAlign: 'center' }}>本月活躍度</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', margin: '20px 0' }}>
            {statsData.map((day, i) => (
              <div key={i} style={{
                width: '35px', height: '35px',
                backgroundColor: day.hasData ? `rgba(74, 222, 128, ${Math.max(0.2, day.rate / 100)})` : 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold',
                border: day.date === format(new Date(), 'yyyy-MM-dd') ? '2px solid white' : 'none'
              }} title={`${day.date}: ${day.hasData ? day.rate + '% 完成率' : '無資料'}`}>
                {day.dayOfMonth}
              </div>
            ))}
          </div>

          <h2 style={{ textAlign: 'center', marginTop: '40px' }}>完成率趨勢</h2>
          <div style={{ width: '100%', height: 250, marginTop: '20px' }}>
            <ResponsiveContainer>
              <LineChart data={statsData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="dayOfMonth" stroke="#fff" tick={{ fill: '#ddd' }} />
                <YAxis stroke="#fff" tick={{ fill: '#ddd' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                  labelFormatter={(label) => `本月 ${label} 日`}
                  formatter={(value) => [`${value}%`, '完成率']}
                />
                <Line type="monotone" dataKey="rate" stroke="#4ade80" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'profile') {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todaysTasks = tasks.filter(t => t.lastCompletedDate === todayStr && t.completed && !t.failed);

    return (
      <div className="app-container">
        <div className="glass-panel" style={{ position: 'relative' }}>
          <button onClick={() => setView('game')} style={{ position: 'absolute', top: 10, right: 10, background: 'transparent' }}><X color="white" /></button>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '10px' }}>👑</div>
            <h2 style={{ margin: 0 }}>{profile.heroName} 的英雄手冊</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <div className="glass-panel" style={{ padding: '15px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '1.5rem', color: '#4ade80' }}>{profile.totalBossesDefeated}</div>
              <div style={{ fontSize: '0.8rem', color: '#aaa' }}>擊敗魔王</div>
            </div>
            <div className="glass-panel" style={{ padding: '15px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '1.5rem', color: '#60a5fa' }}>{profile.totalTasksCompleted}</div>
              <div style={{ fontSize: '0.8rem', color: '#aaa' }}>完成任務</div>
            </div>
            <div className="glass-panel" style={{ padding: '15px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '1.5rem', color: '#fbbf24' }}>{profile.currentDailyStreak} 天</div>
              <div style={{ fontSize: '0.8rem', color: '#aaa' }}>連續登入 (最高:{profile.maxDailyStreak})</div>
            </div>
            <div className="glass-panel" style={{ padding: '15px', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '1.5rem', color: '#ff6b81' }}>{profile.currentCombo}</div>
              <div style={{ fontSize: '0.8rem', color: '#aaa' }}>連擊數 (最高:{profile.maxCombo})</div>
            </div>
          </div>

          <h3>🏅 獲得勳章</h3>
          {profile.unlockedBadges.length === 0 ? (
            <p style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center' }}>尚未獲得勳章，繼續努力！</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
              {profile.unlockedBadges.map(bId => {
                const badge = AchievementEngine.BADGES[bId];
                return (
                  <div key={bId} className="glass-panel" style={{ padding: '10px', textAlign: 'center', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', width: '80px' }} title={badge.description}>
                    <div style={{ fontSize: '2rem' }}>{badge.emoji}</div>
                    <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>{badge.name}</div>
                  </div>
                );
              })}
            </div>
          )}

          <h3 style={{ marginTop: '30px' }}>📜 今日戰績</h3>
          {todaysTasks.length === 0 ? (
            <p style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center' }}>今天還沒有完成任務。</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {todaysTasks.map(t => (
                <li key={t.id} style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{t.title}</span>
                  <span style={{ color: '#4ade80' }}>✔ 完成</span>
                </li>
              ))}
            </ul>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <button onClick={() => setView('profile')} style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }} title="英雄手冊">
          <span style={{ marginRight: '5px' }}>👑</span> 我的手冊
        </button>
        <button onClick={openStats} style={{ background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }} title="查看統計">
          <BarChart2 size={18} style={{ marginRight: '5px' }} /> 統計
        </button>
      </div>
      <div className="glass-panel boss-area">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>{boss.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '5px' }}>
              <span style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: 'bold' }}>
                SP: {Array(profile.sp || 0).fill('★').join('')}{Array(Math.max(0, 3 - (profile.sp || 0))).fill('☆').join('')}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#4ade80', marginTop: '2px' }} title="完成3個任務可獲得1點SP">
                能量: {Array(profile.spProgress || 0).fill('🟢').join('')}{Array(Math.max(0, 3 - (profile.spProgress || 0))).fill('⚪').join('')}
              </span>
            </div>
            {(profile.sp || 0) > 0 && boss.hp > 0 && (
              <button
                onClick={castUltimate}
                style={{
                  background: 'linear-gradient(45deg, #ff007f, #7928ca)',
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  border: '1px solid white',
                  animation: 'pulse 1.5s infinite'
                }}
                className="ultimate-btn"
              >
                施放終極大招！ 🌟
              </button>
            )}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div className={`boss-emoji ${isHit ? 'hit' : ''}`}>{boss.hp > 0 ? boss.emoji : '☠️'}</div>
          {attackEffect && (
            <div className={`magic-effect effect-${attackEffect.type}`}>{attackEffect.emoji}</div>
          )}
          {ultimateEffect && (
            <div className={`magic-effect ultimate-${ultimateEffect.type}`} style={{ zIndex: 10 }}>{ultimateEffect.emoji}</div>
          )}
          {particles.map(p => (
            <div
              key={p.id}
              className="ult-particle"
              style={{
                '--tx': p.tx,
                '--ty': p.ty,
                '--dur': p.duration,
                '--del': p.delay,
                '--sc': p.scale,
                filter: `drop-shadow(0 0 5px ${p.color})`,
                zIndex: 11
              }}
            >
              {p.emoji}
            </div>
          ))}
        </div>

        <div className="hp-bar-container">
          <div className="hp-bar-fill" style={{ width: `${hpPercentage}%`, backgroundColor: hpPercentage > 30 ? 'var(--text-main)' : 'var(--danger)' }}></div>
        </div>
        <p style={{ margin: '5px 0', fontWeight: 'bold' }}>HP: {boss.hp} / {boss.maxHp}</p>
        <div className="message-box" style={{ backgroundColor: boss.hp === 0 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)' }}>
          {message}
        </div>
      </div>

      {burningTasks.length > 0 && (
        <div className="task-list" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#ff6b81', textAlign: 'center' }}>🔥 執行中任務</h3>
          {burningTasks.map(renderTask)}
        </div>
      )}

      <div className="glass-panel">
        <form onSubmit={addTask} className="add-task-form">
          <div className="form-row">
            <input
              type="text"
              className="input-field"
              placeholder="接下來要做什麼呢？"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
            />
          </div>
          <div className="form-row">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>開始時間</label>
              <input
                type="time"
                className="input-field"
                value={newTaskStartTime}
                onChange={e => setNewTaskStartTime(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>持續時間 (自訂分鐘)</label>
              <input
                type="number"
                list="duration-presets"
                className="input-field"
                value={newTaskDuration}
                onClick={e => e.target.select()}
                onChange={e => setNewTaskDuration(e.target.value)}
                min="1"
              />
              <datalist id="duration-presets">
                <option value="5" label="+5 分鐘"></option>
                <option value="15" label="+15 分鐘"></option>
                <option value="30" label="+30 分鐘"></option>
                <option value="60" label="+1 小時"></option>
                <option value="120" label="+2 小時"></option>
              </datalist>
            </div>
          </div>
          <div className="form-row">
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>重複設定</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
                {['一', '二', '三', '四', '五', '六', '日'].map((day, index) => {
                  const dayIdx = index === 6 ? 0 : index + 1; // map visually to Date.getDay()
                  const isSelected = newTaskDays.includes(dayIdx);
                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      onClick={() => {
                        if (isSelected && newTaskDays.length > 1) {
                          setNewTaskDays(newTaskDays.filter(d => d !== dayIdx));
                        } else if (!isSelected) {
                          setNewTaskDays([...newTaskDays, dayIdx]);
                        }
                      }}
                      style={{
                        padding: '10px 4px',
                        minWidth: '40px',
                        margin: '2px',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        backgroundColor: isSelected ? 'var(--text-main)' : 'rgba(255,255,255,0.1)',
                        color: isSelected ? 'var(--bg-color)' : 'white',
                        border: 'none'
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="submit" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '12px', minWidth: '40px' }}><Plus size={20} /></button>
          </div>
        </form>

        <div className="task-list">
          {processedTasks.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', margin: '20px 0' }}>今天還沒有任務。在上方新增一個開始吧！</p>
          ) : (
            otherTasks.map(renderTask)
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
