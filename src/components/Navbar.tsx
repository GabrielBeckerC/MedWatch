import { useState, useEffect } from 'react';
import { Pill, Bell, BellOff, Volume2, Plus, Calendar, ListFilter, History } from 'lucide-react';
import { alarmAudio } from '../utils/audioAlarm';

interface NavbarProps {
  activeTab: 'timeline' | 'medications' | 'history';
  setActiveTab: (tab: 'timeline' | 'medications' | 'history') => void;
  onOpenAddModal: () => void;
  onTestAlarm: () => void;
  pendingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onTestAlarm,
  pendingCount,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ('Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  const handleEnableAudioAndNotifications = async () => {
    alarmAudio.playClickBeep();
    const perm = await alarmAudio.requestNotificationPermission();
    setHasNotificationPermission(perm === 'granted');
  };

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand-section">
          <div className="brand-logo">
            <Pill className="brand-icon" />
            <span className="brand-pulse"></span>
          </div>
          <div>
            <div className="brand-title-group">
              <h1 className="brand-title">MedWatch</h1>
              <span className="brand-badge">PRO</span>
            </div>
            <p className="brand-subtitle">Gestão Inteligente de Medicamentos</p>
          </div>
        </div>

        <div className="header-center-info">
          <div className="clock-card">
            <div className="clock-time">{currentTime || '--:--:--'}</div>
            <div className="clock-date">{currentDate}</div>
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={handleEnableAudioAndNotifications}
            className={`header-btn ${hasNotificationPermission ? 'btn-perm-active' : 'btn-perm-needed'}`}
            title={hasNotificationPermission ? 'Notificações e som ativados' : 'Clique para ativar som e notificações nativas'}
          >
            {hasNotificationPermission ? <Bell className="icon-sm text-emerald" /> : <BellOff className="icon-sm text-amber" />}
            <span className="btn-label-desktop">
              {hasNotificationPermission ? 'Som & Notificações OK' : 'Ativar Alerta'}
            </span>
          </button>

          <button onClick={onTestAlarm} className="header-btn btn-secondary" title="Simular disparo de alarme na tela">
            <Volume2 className="icon-sm text-sky" />
            <span className="btn-label-desktop">Testar Alarme</span>
          </button>

          <button onClick={onOpenAddModal} className="header-btn btn-primary-action">
            <Plus className="icon-sm" />
            <span>Cadastrar Remédio</span>
          </button>
        </div>
      </div>

      <nav className="header-nav">
        <button
          onClick={() => {
            alarmAudio.playClickBeep();
            setActiveTab('timeline');
          }}
          className={`nav-tab ${activeTab === 'timeline' ? 'active' : ''}`}
        >
          <Calendar className="nav-icon" />
          <span>Agenda de Hoje</span>
          {pendingCount > 0 && <span className="nav-counter">{pendingCount}</span>}
        </button>

        <button
          onClick={() => {
            alarmAudio.playClickBeep();
            setActiveTab('medications');
          }}
          className={`nav-tab ${activeTab === 'medications' ? 'active' : ''}`}
        >
          <ListFilter className="nav-icon" />
          <span>Meus Remédios</span>
        </button>

        <button
          onClick={() => {
            alarmAudio.playClickBeep();
            setActiveTab('history');
          }}
          className={`nav-tab ${activeTab === 'history' ? 'active' : ''}`}
        >
          <History className="nav-icon" />
          <span>Histórico</span>
        </button>
      </nav>
    </header>
  );
};
