class AudioAlarmManager {
  private audioCtx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying = false;
  private timerId: number | null = null;
  private isUnlocked = false;

  constructor() {
    this.setupInteractionUnlock();
  }

  public isAudioUnlocked(): boolean {
    return this.isUnlocked;
  }

  /**
   * Registers global window touch/click/keydown listeners to unlock AudioContext
   * as soon as the user interacts with the app (bypassing browser autoplay policies).
   */
  private setupInteractionUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.initContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().then(() => {
          this.isUnlocked = true;
        }).catch(() => {
          // ignore
        });
      } else if (this.audioCtx) {
        this.isUnlocked = true;
      }

    };

    const events = ['pointerdown', 'touchstart', 'click', 'keydown'];
    events.forEach((event) => {
      window.addEventListener(event, unlock, { once: true, capture: true });
    });
  }

  private initContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  /**
   * Starts a loud, high-clarity musical alarm melody sequence.
   * Plays continuous audio file + dual-oscillator musical notes with high volume gain.
   */
  public async startAlarmSound() {
    try {
      this.initContext();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Try playing HTML5 Audio element with /alarm_sound.wav
      try {
        if (!this.audioElement && typeof window !== 'undefined') {
          this.audioElement = new Audio('alarm_sound.wav');
          this.audioElement.loop = true;
          this.audioElement.volume = 1.0;
        }
        if (this.audioElement) {
          this.audioElement.currentTime = 0;
          const playPromise = this.audioElement.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Ignore autoplay restrictions, oscillator fallback will play
            });
          }
        }
      } catch {
        // ignore HTML5 Audio failure
      }

      if (this.isPlaying) return;
      this.isPlaying = true;
      let step = 0;

      // Musical note frequencies for a loud, clear, pleasant alarm chime melody:
      const melodyNotes = [
        { freq1: 523.25, freq2: 1046.5 },   // C5 + C6
        { freq1: 659.25, freq2: 1318.51 },  // E5 + E6
        { freq1: 783.99, freq2: 1567.98 },  // G5 + G6
        { freq1: 1046.5, freq2: 2093.0 },   // C6 + C7 high chime
      ];

      const playPulse = () => {
        if (!this.isPlaying || !this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        const noteIndex = step % melodyNotes.length;
        const { freq1, freq2 } = melodyNotes[noteIndex];

        // Main tone oscillator (Triangle for warm loud body)
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq1, now);

        // High volume envelope (up to 0.8 gain)
        gain1.gain.setValueAtTime(0.01, now);
        gain1.gain.linearRampToValueAtTime(0.8, now + 0.04);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);

        osc1.start(now);
        osc1.stop(now + 0.35);

        // Harmonic shimmer oscillator (Sine for crisp high ring tone)
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq2, now + 0.05);

        gain2.gain.setValueAtTime(0.01, now + 0.05);
        gain2.gain.linearRampToValueAtTime(0.5, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);

        osc2.start(now + 0.05);
        osc2.stop(now + 0.35);

        step++;
      };

      playPulse();
      this.timerId = window.setInterval(playPulse, 380);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  public stopAlarmSound() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }

  public playSuccessChime() {
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];

      notes.forEach((freq, idx) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.38);
      });
    } catch (e) {
      console.warn('Success chime error:', e);
    }
  }

  public playClickBeep() {
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // ignore
    }
  }

  public vibrateMobile() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([500, 200, 500, 200, 1000]);
      } catch {
        // ignore
      }
    }
  }

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }

  public async sendNativeNotification(title: string, body: string, extraData?: Record<string, unknown>) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      try {
        await LocalNotifications.deleteChannel({ id: 'medwatch_alarm_channel' });
      } catch {
        // ignore
      }

      try {
        await LocalNotifications.createChannel({
          id: 'medwatch_alarm_channel_v3',
          name: 'Alarmes de Medicamentos MedWatch',
          description: 'Canal de alta prioridade com som sonoro forte e vibração',
          importance: 5,
          visibility: 1,
          vibration: true,
          sound: 'alarm_sound.wav',
        });
      } catch {
        // channel error fallback
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 100000) + 1,
            schedule: { at: new Date(Date.now() + 100) },
            channelId: 'medwatch_alarm_channel_v3',
            sound: 'alarm_sound.wav',
            actionTypeId: '',
            extra: extraData || null,
          },
        ],
      });

      this.startAlarmSound();
      this.vibrateMobile();
    } catch {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification(title, {
            body,
            icon: 'favicon.svg',
            tag: 'medwatch-alarm',
            requireInteraction: true,
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
          this.startAlarmSound();
          this.vibrateMobile();
        } catch (e) {
          console.warn('Native notification failed:', e);
        }
      }
    }
  }
}

export const alarmAudio = new AudioAlarmManager();


