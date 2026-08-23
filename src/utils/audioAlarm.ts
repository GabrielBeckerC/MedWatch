class AudioAlarmManager {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private timerId: number | null = null;

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public async startAlarmSound() {
    try {
      this.initContext();
      if (!this.audioCtx) return;
      if (this.isPlaying) return;

      this.isPlaying = true;
      let step = 0;

      const playPulse = () => {
        if (!this.isPlaying || !this.audioCtx) return;

        const now = this.audioCtx.currentTime;
        const freq1 = step % 2 === 0 ? 880 : 1046.5;
        const freq2 = step % 2 === 0 ? 1174.66 : 1318.51;

        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq1, now);

        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);

        osc1.start(now);
        osc1.stop(now + 0.38);

        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq2, now);

        gain2.gain.setValueAtTime(0, now);
        gain2.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);

        osc2.start(now + 0.08);
        osc2.stop(now + 0.4);

        step++;
      };

      playPulse();
      this.timerId = window.setInterval(playPulse, 600);
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
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.32);
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

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // ignore
    }
  }

  public vibrateMobile() {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 800]);
      } catch {
        // ignore
      }
    }
  }

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
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

  public async sendNativeNotification(title: string, body: string) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      try {
        await LocalNotifications.createChannel({
          id: 'medwatch_alarm_channel',
          name: 'Alarmes de Medicamentos MedWatch',
          description: 'Canal de alta prioridade com alarme sonoro e vibração',
          importance: 5,
          visibility: 1,
          vibration: true,
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
            channelId: 'medwatch_alarm_channel',
            actionTypeId: '',
            extra: null,
          },
        ],
      });

      this.startAlarmSound();
      this.vibrateMobile();
    } catch {
      if ('Notification' in window && Notification.permission === 'granted') {
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
